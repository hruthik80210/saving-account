"""
Transaction Service.
Handles validation, backdated recalculation checks, running balances, and database transactions.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.app.models.models import Transaction, Account
from backend.app.schemas.schemas import TransactionCreate, TransactionUpdate
from backend.app.interest_engine.models import (
    TransactionRecord,
    TransactionType as EngineTxType
)
from backend.app.interest_engine.engine import (
    validate_historical_balances,
    NegativeBalanceError,
    get_transaction_net_effect,
)


def to_engine_record(tx: Transaction) -> TransactionRecord:
    """Converts ORM Transaction to Engine TransactionRecord."""
    return TransactionRecord(
        id=str(tx.id),
        transaction_date=tx.transaction_date,
        value_date=tx.value_date,
        transaction_type=EngineTxType(tx.transaction_type),
        amount=Decimal(str(tx.amount)),
        description=tx.description,
        reference=tx.reference,
    )


class TransactionService:

    @staticmethod
    def get_account_transactions(
        db: Session,
        account_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        transaction_type: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Transaction]:
        """
        Retrieves transactions for an account sorted chronologically by value_date.
        """
        query = db.query(Transaction).filter(Transaction.account_id == account_id)
        if start_date:
            query = query.filter(Transaction.value_date >= start_date)
        if end_date:
            query = query.filter(Transaction.value_date <= end_date)
        if transaction_type and transaction_type.upper() != "ALL":
            query = query.filter(Transaction.transaction_type == transaction_type.upper())
        if search:
            search_fmt = f"%{search}%"
            query = query.filter(
                (Transaction.description.ilike(search_fmt)) |
                (Transaction.reference.ilike(search_fmt))
            )
        
        # Sort by value_date, then created_at
        return query.order_by(Transaction.value_date.asc(), Transaction.created_at.asc()).all()

    @staticmethod
    def calculate_running_balances(transactions: List[Transaction]) -> List[Tuple[Transaction, Decimal]]:
        """
        Sorts transactions by value_date and computes running balance after each transaction.
        """
        type_priority = {
            "OPENING_BALANCE": 0,
            "DEPOSIT": 1,
            "INTEREST_CREDIT": 2,
            "ADJUSTMENT": 3,
            "WITHDRAWAL": 4,
        }
        
        sorted_txs = sorted(
            transactions,
            key=lambda t: (t.value_date, type_priority.get(t.transaction_type, 5), str(t.id))
        )

        running_balance = Decimal("0.00")
        results = []
        for tx in sorted_txs:
            engine_rec = to_engine_record(tx)
            running_balance += get_transaction_net_effect(engine_rec)
            results.append((tx, running_balance))

        return results

    @staticmethod
    def validate_simulation(
        existing_txs: List[Transaction],
        candidate_tx: TransactionRecord,
        exclude_tx_id: Optional[str] = None
    ) -> None:
        """
        Simulates applying candidate_tx to the account history.
        Raises HTTPException if any future date would drop below zero balance.
        """
        all_records: List[TransactionRecord] = [
            to_engine_record(tx) for tx in existing_txs
            if exclude_tx_id is None or str(tx.id) != exclude_tx_id
        ]
        all_records.append(candidate_tx)

        try:
            validate_historical_balances(all_records, allow_negative=False)
        except NegativeBalanceError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

    @classmethod
    def create_transaction(cls, db: Session, payload: TransactionCreate) -> Transaction:
        """
        Validates and records a new transaction.
        Performs full historical simulation to prevent negative balances.
        """
        account = db.query(Account).filter(Account.id == payload.account_id).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

        existing_txs = db.query(Transaction).filter(Transaction.account_id == payload.account_id).all()

        candidate = TransactionRecord(
            id="candidate",
            transaction_date=payload.transaction_date,
            value_date=payload.value_date,
            transaction_type=EngineTxType(payload.transaction_type),
            amount=payload.amount,
            description=payload.description,
            reference=payload.reference,
        )

        # Validate backdated effect
        cls.validate_simulation(existing_txs, candidate)

        new_tx = Transaction(
            account_id=payload.account_id,
            transaction_date=payload.transaction_date,
            value_date=payload.value_date,
            transaction_type=payload.transaction_type,
            amount=payload.amount,
            description=payload.description,
            reference=payload.reference,
        )
        db.add(new_tx)
        db.commit()
        db.refresh(new_tx)
        return new_tx

    @classmethod
    def update_transaction(cls, db: Session, transaction_id: str, payload: TransactionUpdate) -> Transaction:
        """
        Updates an existing transaction and ensures historical integrity.
        """
        tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not tx:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

        # Prepare updated values
        new_tx_date = payload.transaction_date or tx.transaction_date
        new_val_date = payload.value_date or tx.value_date
        new_type = payload.transaction_type or tx.transaction_type
        new_amount = payload.amount if payload.amount is not None else tx.amount
        new_desc = payload.description if payload.description is not None else tx.description
        new_ref = payload.reference if payload.reference is not None else tx.reference

        candidate = TransactionRecord(
            id=str(tx.id),
            transaction_date=new_tx_date,
            value_date=new_val_date,
            transaction_type=EngineTxType(new_type),
            amount=Decimal(str(new_amount)),
            description=new_desc,
            reference=new_ref,
        )

        existing_txs = db.query(Transaction).filter(Transaction.account_id == tx.account_id).all()
        cls.validate_simulation(existing_txs, candidate, exclude_tx_id=str(tx.id))

        tx.transaction_date = new_tx_date
        tx.value_date = new_val_date
        tx.transaction_type = new_type
        tx.amount = new_amount
        tx.description = new_desc
        tx.reference = new_ref

        db.commit()
        db.refresh(tx)
        return tx

    @classmethod
    def delete_transaction(cls, db: Session, transaction_id: str) -> bool:
        """
        Deletes a transaction and ensures remaining transactions do not violate balance constraints.
        """
        tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not tx:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

        existing_txs = db.query(Transaction).filter(Transaction.account_id == tx.account_id).all()
        remaining_records = [
            to_engine_record(t) for t in existing_txs if str(t.id) != str(tx.id)
        ]

        try:
            validate_historical_balances(remaining_records, allow_negative=False)
        except NegativeBalanceError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete transaction: {str(e)}"
            )

        db.delete(tx)
        db.commit()
        return True
