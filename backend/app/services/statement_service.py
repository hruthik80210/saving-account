"""
Passbook Statement Service.
Generates chronological passbook statements with debit/credit breakdown and exportable formats.
"""
from datetime import date
from decimal import Decimal
from typing import Optional, List
import io
import csv
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.app.models.models import Account, Transaction
from backend.app.schemas.schemas import StatementResponse, StatementEntryResponse
from backend.app.services.transaction_service import TransactionService, to_engine_record
from backend.app.interest_engine.engine import calculate_balance_on_date, get_transaction_net_effect


class StatementService:

    @classmethod
    def generate_statement(
        cls,
        db: Session,
        account_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> StatementResponse:
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

        all_txs = db.query(Transaction).filter(Transaction.account_id == account_id).all()
        engine_records = [to_engine_record(t) for t in all_txs]

        # Calculate opening balance prior to start_date
        if start_date:
            from datetime import timedelta
            prior_date = start_date - timedelta(days=1)
            opening_balance = calculate_balance_on_date(engine_records, prior_date)
        else:
            opening_balance = Decimal("0.00")

        # Get filtered transactions in chronological order of value_date
        filtered_txs = TransactionService.get_account_transactions(
            db=db,
            account_id=account_id,
            start_date=start_date,
            end_date=end_date
        )

        entries: List[StatementEntryResponse] = []
        running_balance = opening_balance
        total_credits = Decimal("0.00")
        total_debits = Decimal("0.00")

        for tx in filtered_txs:
            amt = Decimal(str(tx.amount))
            is_debit = (tx.transaction_type == "WITHDRAWAL")
            
            debit_val = amt if is_debit else None
            credit_val = amt if not is_debit else None

            if is_debit:
                total_debits += amt
                running_balance -= amt
            else:
                total_credits += amt
                running_balance += amt

            entries.append(StatementEntryResponse(
                transaction_id=str(tx.id),
                transaction_date=tx.transaction_date,
                value_date=tx.value_date,
                description=tx.description or tx.transaction_type.replace("_", " ").title(),
                reference=tx.reference,
                transaction_type=tx.transaction_type,
                debit=debit_val,
                credit=credit_val,
                balance=running_balance,
            ))

        return StatementResponse(
            account_id=str(account.id),
            account_number=account.account_number,
            currency=account.currency,
            period_start=start_date,
            period_end=end_date,
            opening_balance=opening_balance,
            closing_balance=running_balance,
            total_credits=total_credits,
            total_debits=total_debits,
            entries=entries,
        )

    @classmethod
    def export_csv(cls, statement: StatementResponse) -> str:
        """
        Generates CSV format string from statement response.
        """
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header info
        writer.writerow(["Savings Account Statement"])
        writer.writerow(["Account Number", statement.account_number])
        writer.writerow(["Currency", statement.currency])
        writer.writerow(["Opening Balance", f"{statement.opening_balance:.2f}"])
        writer.writerow(["Closing Balance", f"{statement.closing_balance:.2f}"])
        writer.writerow([])

        # Table header
        writer.writerow(["Transaction Date", "Value Date", "Description", "Reference", "Type", "Debit", "Credit", "Balance"])

        for e in statement.entries:
            writer.writerow([
                e.transaction_date.isoformat(),
                e.value_date.isoformat(),
                e.description,
                e.reference or "",
                e.transaction_type,
                f"{e.debit:.2f}" if e.debit is not None else "",
                f"{e.credit:.2f}" if e.credit is not None else "",
                f"{e.balance:.2f}",
            ])

        return output.getvalue()
