"""
Database Admin & Data Purge Endpoints.

Allows complete removal of demo/static transactions and re-seeding strictly on
user demand. "Static" data here means anything the application seeds on startup
(demo profile, sample account & transactions, default interest slabs). Everything
you create yourself is treated as live database data.

Two levels of cleanup are offered:

* ``/purge-static`` -> removes only the seeded demo/static records, keeping the
  accounts and transactions you created yourself.
* ``/purge-all``    -> removes every business record across all tables, leaving a
  completely empty database (tables themselves are preserved).
"""
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import (
    Profile,
    Account,
    Transaction,
    InterestCalculation,
    InterestDailyBreakdown,
    InterestPosting,
    InterestSlab,
)
from backend.app.services.auth_service import require_admin, DEMO_USER_ID

router = APIRouter(prefix="/api/database", tags=["Database Management"])

# Well-known IDs used by the automatic startup seeder.
DEMO_ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
DEFAULT_SLAB_IDS = [
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222",
    "33333333-3333-3333-3333-333333333333",
]


def _purge_account_children(db: Session, account_ids: list[str]) -> dict:
    """Deletes postings, calculations, breakdowns and transactions for accounts."""
    counts = {"postings": 0, "calculations": 0, "breakdowns": 0, "transactions": 0}
    if not account_ids:
        return counts

    counts["postings"] = (
        db.query(InterestPosting)
        .filter(InterestPosting.account_id.in_(account_ids))
        .delete(synchronize_session=False)
    )

    calc_ids = [
        c.id
        for c in db.query(InterestCalculation)
        .filter(InterestCalculation.account_id.in_(account_ids))
        .all()
    ]
    if calc_ids:
        counts["breakdowns"] = (
            db.query(InterestDailyBreakdown)
            .filter(InterestDailyBreakdown.calculation_id.in_(calc_ids))
            .delete(synchronize_session=False)
        )
    counts["calculations"] = (
        db.query(InterestCalculation)
        .filter(InterestCalculation.account_id.in_(account_ids))
        .delete(synchronize_session=False)
    )
    counts["transactions"] = (
        db.query(Transaction)
        .filter(Transaction.account_id.in_(account_ids))
        .delete(synchronize_session=False)
    )
    return counts


@router.delete("/accounts/{account_id}/clear-transactions")
def clear_account_transactions(
    account_id: str,
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Purges all transactions, calculations, breakdowns, and postings for a specific account.
    Leaves the account completely clean (0 transactions).
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")

    _purge_account_children(db, [account_id])
    db.commit()

    return {
        "message": f"Successfully cleared all transactions and calculations for account {account.account_number}.",
        "deleted_count": 0,
    }


@router.delete("/purge-static")
def purge_static_data(
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Removes only the data seeded automatically by the application:
    the demo profile, the demo account with its sample transactions, and the
    three default interest slabs. Accounts/transactions you created are preserved.
    """
    demo_accounts = (
        db.query(Account)
        .filter(Account.id == DEMO_ACCOUNT_ID)
        .all()
    )
    demo_account_ids = [a.id for a in demo_accounts]

    counts = _purge_account_children(db, demo_account_ids)

    deleted_accounts = (
        db.query(Account).filter(Account.id.in_(demo_account_ids)).delete(synchronize_session=False)
        if demo_account_ids
        else 0
    )
    deleted_profiles = (
        db.query(Profile).filter(Profile.id == DEMO_USER_ID).delete(synchronize_session=False)
    )
    deleted_slabs = (
        db.query(InterestSlab)
        .filter(InterestSlab.id.in_(DEFAULT_SLAB_IDS))
        .delete(synchronize_session=False)
    )

    db.commit()

    return {
        "message": "Seeded static/demo data removed. Your own database records were kept.",
        "deleted_accounts": deleted_accounts,
        "deleted_profiles": deleted_profiles,
        "deleted_slabs": deleted_slabs,
        "deleted_transactions": counts["transactions"],
    }


@router.delete("/purge-all")
def purge_all_data(
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Wipes every business record across all tables, leaving a completely empty
    database. The schema/tables themselves are preserved.
    """
    deleted_breakdowns = db.query(InterestDailyBreakdown).delete(synchronize_session=False)
    deleted_postings = db.query(InterestPosting).delete(synchronize_session=False)
    deleted_calculations = db.query(InterestCalculation).delete(synchronize_session=False)
    deleted_transactions = db.query(Transaction).delete(synchronize_session=False)
    deleted_slabs = db.query(InterestSlab).delete(synchronize_session=False)
    deleted_accounts = db.query(Account).delete(synchronize_session=False)
    deleted_profiles = db.query(Profile).delete(synchronize_session=False)

    db.commit()

    return {
        "message": "All business data removed. The database is now empty.",
        "deleted": {
            "profiles": deleted_profiles,
            "accounts": deleted_accounts,
            "transactions": deleted_transactions,
            "slabs": deleted_slabs,
            "calculations": deleted_calculations,
            "breakdowns": deleted_breakdowns,
            "postings": deleted_postings,
        },
    }


@router.post("/seed-sample")
def seed_sample_data(
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Adds Requirement 21 sample transactions to the user's primary account on demand.
    """
    account = db.query(Account).filter(Account.user_id == current_user.id).first()
    if not account:
        account = Account(
            user_id=current_user.id,
            account_number="SB-50982341092",
            account_type="SAVINGS",
            currency="INR",
            status="ACTIVE"
        )
        db.add(account)
        db.commit()
        db.refresh(account)

    sample_txs = [
        Transaction(
            account_id=account.id,
            transaction_date=date(2026, 7, 1),
            value_date=date(2026, 7, 1),
            transaction_type="OPENING_BALANCE",
            amount=Decimal("50000.00"),
            description="Initial Opening Balance",
            reference="OPN-20260701-01",
        ),
        Transaction(
            account_id=account.id,
            transaction_date=date(2026, 7, 5),
            value_date=date(2026, 7, 5),
            transaction_type="DEPOSIT",
            amount=Decimal("10000.00"),
            description="Cash Deposit Branch 04",
            reference="DEP-20260705-02",
        ),
        Transaction(
            account_id=account.id,
            transaction_date=date(2026, 7, 12),
            value_date=date(2026, 7, 12),
            transaction_type="WITHDRAWAL",
            amount=Decimal("5000.00"),
            description="ATM Cash Withdrawal",
            reference="WDL-20260712-03",
        ),
        Transaction(
            account_id=account.id,
            transaction_date=date(2026, 7, 20),
            value_date=date(2026, 7, 20),
            transaction_type="DEPOSIT",
            amount=Decimal("20000.00"),
            description="NEFT Inward - Salary Topup",
            reference="NEFT-20260720-04",
        ),
    ]

    db.add_all(sample_txs)
    db.commit()

    return {
        "message": "Sample transactions from Requirement 21 seeded into account.",
        "account_id": account.id,
        "count": len(sample_txs),
    }
