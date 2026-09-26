"""
Accounts API endpoints.
"""
from typing import List
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import Account, Profile, Transaction
from backend.app.schemas.schemas import AccountCreate, AccountResponse, AccountSummaryResponse
from backend.app.services.auth_service import get_current_user, require_admin
from backend.app.services.transaction_service import to_engine_record
from backend.app.interest_engine.engine import calculate_balance_on_date, InterestEngine
from backend.app.services.interest_service import to_engine_slab
from backend.app.models.models import InterestSlab

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


@router.get("", response_model=List[AccountResponse])
def get_user_accounts(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    return accounts


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(Account).filter(Account.account_number == payload.account_number).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account number already exists.")

    new_acc = Account(
        user_id=current_user.id,
        account_number=payload.account_number,
        account_type=payload.account_type,
        currency=payload.currency,
        status=payload.status,
    )
    db.add(new_acc)
    db.commit()
    db.refresh(new_acc)
    return new_acc


@router.get("/{account_id}", response_model=AccountResponse)
def get_account_by_id(
    account_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
    return acc


@router.delete("/{account_id}")
def delete_account(
    account_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")

    db.delete(acc)
    db.commit()
    return {"message": f"Account {acc.account_number} deleted successfully."}


@router.get("/{account_id}/summary", response_model=AccountSummaryResponse)
def get_account_summary(
    account_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    acc = db.query(Account).filter(Account.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")

    txs = db.query(Transaction).filter(Transaction.account_id == account_id).all()
    engine_txs = [to_engine_record(t) for t in txs]

    today = date.today()
    current_balance = calculate_balance_on_date(engine_txs, today)

    # Opening balance is earliest transaction or 0
    opening_balance = Decimal("0.00")
    total_deposits = Decimal("0.00")
    total_withdrawals = Decimal("0.00")
    total_interest_credited = Decimal("0.00")

    sorted_txs = sorted(txs, key=lambda t: t.value_date)
    if sorted_txs:
        for t in sorted_txs:
            amt = Decimal(str(t.amount))
            if t.transaction_type == "OPENING_BALANCE":
                opening_balance += amt
                total_deposits += amt
            elif t.transaction_type in ("DEPOSIT", "ADJUSTMENT"):
                total_deposits += amt
            elif t.transaction_type == "WITHDRAWAL":
                total_withdrawals += amt
            elif t.transaction_type == "INTEREST_CREDIT":
                total_interest_credited += amt

    # Calculate average daily balance (ADB) and accrued interest for current year or last 90 days
    slabs = db.query(InterestSlab).filter(InterestSlab.status == "ACTIVE").all()
    engine_slabs = [to_engine_slab(s) for s in slabs]

    adb = Decimal("0.00")
    accrued_interest_ytd = Decimal("0.00")
    if engine_txs and engine_slabs:
        start_of_year = date(today.year, 1, 1)
        try:
            engine = InterestEngine()
            res = engine.calculate(
                transactions=engine_txs,
                slabs=engine_slabs,
                start_date=start_of_year,
                end_date=today,
                account_id=account_id
            )
            adb = res.average_daily_balance
            accrued_interest_ytd = res.total_interest_earned
        except Exception:
            adb = current_balance
            accrued_interest_ytd = Decimal("0.00")

    return AccountSummaryResponse(
        account=acc,
        current_balance=current_balance,
        opening_balance=opening_balance,
        total_deposits=total_deposits,
        total_withdrawals=total_withdrawals,
        total_interest_credited=total_interest_credited,
        average_daily_balance=adb,
        accrued_interest_ytd=accrued_interest_ytd
    )
