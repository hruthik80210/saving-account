"""
Transactions API endpoints.
"""
from typing import List, Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import Transaction, Profile
from backend.app.schemas.schemas import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
)
from backend.app.services.auth_service import get_current_user, require_admin
from backend.app.services.transaction_service import TransactionService

router = APIRouter(prefix="/api", tags=["Transactions"])


@router.post("/transactions", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    created = TransactionService.create_transaction(db, payload)
    return created


@router.get("/accounts/{account_id}/transactions", response_model=dict)
def get_transactions(
    account_id: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    transaction_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Retrieve all matched transactions with chronological running balances
    all_acc_txs = TransactionService.get_account_transactions(
        db=db,
        account_id=account_id,
        start_date=None,
        end_date=None
    )
    with_running = TransactionService.calculate_running_balances(all_acc_txs)

    # Filter according to query params
    filtered = []
    for tx, bal in with_running:
        if start_date and tx.value_date < start_date:
            continue
        if end_date and tx.value_date > end_date:
            continue
        if transaction_type and transaction_type.upper() != "ALL" and tx.transaction_type != transaction_type.upper():
            continue
        if search:
            s_lower = search.lower()
            desc_match = tx.description and s_lower in tx.description.lower()
            ref_match = tx.reference and s_lower in tx.reference.lower()
            if not (desc_match or ref_match):
                continue
        
        # Attach running balance attribute for response serialization
        tx_dict = {
            "id": str(tx.id),
            "account_id": str(tx.account_id),
            "transaction_date": tx.transaction_date,
            "value_date": tx.value_date,
            "transaction_type": tx.transaction_type,
            "amount": tx.amount,
            "description": tx.description,
            "reference": tx.reference,
            "running_balance": bal,
            "created_at": tx.created_at,
            "updated_at": tx.updated_at,
        }
        filtered.append(tx_dict)

    # Reverse for newest first view or standard display
    # Sorting by value_date desc for typical transaction list
    filtered_sorted = sorted(filtered, key=lambda x: (x["value_date"], x["created_at"]), reverse=True)

    total_count = len(filtered_sorted)
    offset = (page - 1) * limit
    paginated = filtered_sorted[offset : offset + limit]

    return {
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if limit > 0 else 1,
        "data": paginated,
    }


@router.put("/transactions/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    updated = TransactionService.update_transaction(db, transaction_id, payload)
    return updated


@router.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    TransactionService.delete_transaction(db, transaction_id)
    return {"message": "Transaction deleted successfully"}
