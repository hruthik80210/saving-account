"""
Main FastAPI Application Entrypoint.
"""
from contextlib import asynccontextmanager
from datetime import date
from decimal import Decimal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import settings
from backend.app.database import engine, Base, SessionLocal
from backend.app.models.models import Profile, Account, InterestSlab, Transaction
from backend.app.api import (
    auth,
    accounts,
    transactions,
    interest,
    slabs,
    statement,
    csv_import,
    database_admin,
)


def init_db_and_seed():
    """Initializes tables and seeds demo account & interest slabs if empty.

    Static/demo seeding can be disabled entirely by setting AUTO_SEED_DEMO_DATA=false
    in the environment, which leaves the business tables empty so only records you
    create yourself are kept.
    """
    Base.metadata.create_all(bind=engine)

    if not settings.AUTO_SEED_DEMO_DATA:
        return

    db = SessionLocal()
    try:
        # 1. Seed Slabs
        if settings.SEED_DEFAULT_SLABS and db.query(InterestSlab).count() == 0:
            default_slabs = [
                InterestSlab(
                    id="11111111-1111-1111-1111-111111111111",
                    min_balance=Decimal("0.00"),
                    max_balance=Decimal("100000.00"),
                    annual_rate=Decimal("3.0000"),
                    tier_type="TIERED",
                    effective_from=date(2025, 1, 1),
                    effective_to=None,
                    status="ACTIVE",
                ),
                InterestSlab(
                    id="22222222-2222-2222-2222-222222222222",
                    min_balance=Decimal("100000.01"),
                    max_balance=Decimal("500000.00"),
                    annual_rate=Decimal("3.5000"),
                    tier_type="TIERED",
                    effective_from=date(2025, 1, 1),
                    effective_to=None,
                    status="ACTIVE",
                ),
                InterestSlab(
                    id="33333333-3333-3333-3333-333333333333",
                    min_balance=Decimal("500000.01"),
                    max_balance=None,
                    annual_rate=Decimal("4.0000"),
                    tier_type="TIERED",
                    effective_from=date(2025, 1, 1),
                    effective_to=None,
                    status="ACTIVE",
                ),
            ]
            db.add_all(default_slabs)
            db.commit()

        # 2. Seed Demo User
        demo_user = db.query(Profile).filter(Profile.id == "00000000-0000-0000-0000-000000000001").first()
        if not demo_user:
            demo_user = Profile(
                id="00000000-0000-0000-0000-000000000001",
                full_name="Rajesh Sharma",
                email="demo.user@antigravitybank.com"
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)

        # 3. Seed Demo Account
        demo_account = db.query(Account).filter(Account.id == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa").first()
        if not demo_account:
            demo_account = Account(
                id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                user_id=demo_user.id,
                account_number="SB-50982341092",
                account_type="SAVINGS",
                currency="INR",
                status="ACTIVE"
            )
            db.add(demo_account)
            db.commit()
            db.refresh(demo_account)

        # 4. Seed Sample Transactions (Requirement 21)
        if db.query(Transaction).filter(Transaction.account_id == demo_account.id).count() == 0:
            sample_txs = [
                Transaction(
                    id="bbbbbbbb-bbbb-bbbb-bbbb-000000000001",
                    account_id=demo_account.id,
                    transaction_date=date(2026, 7, 1),
                    value_date=date(2026, 7, 1),
                    transaction_type="OPENING_BALANCE",
                    amount=Decimal("50000.00"),
                    description="Initial Opening Balance",
                    reference="OPN-20260701-01",
                ),
                Transaction(
                    id="bbbbbbbb-bbbb-bbbb-bbbb-000000000002",
                    account_id=demo_account.id,
                    transaction_date=date(2026, 7, 5),
                    value_date=date(2026, 7, 5),
                    transaction_type="DEPOSIT",
                    amount=Decimal("10000.00"),
                    description="Cash Deposit Branch 04",
                    reference="DEP-20260705-02",
                ),
                Transaction(
                    id="bbbbbbbb-bbbb-bbbb-bbbb-000000000003",
                    account_id=demo_account.id,
                    transaction_date=date(2026, 7, 12),
                    value_date=date(2026, 7, 12),
                    transaction_type="WITHDRAWAL",
                    amount=Decimal("5000.00"),
                    description="ATM Cash Withdrawal",
                    reference="WDL-20260712-03",
                ),
                Transaction(
                    id="bbbbbbbb-bbbb-bbbb-bbbb-000000000004",
                    account_id=demo_account.id,
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

    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB tables and seed data
    init_db_and_seed()
    yield
    # Shutdown


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Full-stack Savings Account Interest Calculator using Daily Closing Balance Method",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(interest.router)
app.include_router(slabs.router)
app.include_router(statement.router)
app.include_router(csv_import.router)
app.include_router(database_admin.router)


@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
