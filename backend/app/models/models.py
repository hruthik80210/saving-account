"""
SQLAlchemy ORM models mirroring the Supabase PostgreSQL database schema.
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    Column,
    String,
    Date,
    DateTime,
    Numeric,
    ForeignKey,
    UniqueConstraint,
    Index,
    Text,
    Integer,
    Uuid,
)
from sqlalchemy.orm import relationship
from backend.app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(20), nullable=False, default="CUSTOMER")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(Uuid(as_uuid=False), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    account_number = Column(String(50), nullable=False, unique=True, index=True)
    account_type = Column(String(50), nullable=False, default="SAVINGS")
    currency = Column(String(10), nullable=False, default="INR")
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("Profile", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
    calculations = relationship("InterestCalculation", back_populates="account", cascade="all, delete-orphan")
    postings = relationship("InterestPosting", back_populates="account", cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    account_id = Column(Uuid(as_uuid=False), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_date = Column(Date, nullable=False, index=True)
    value_date = Column(Date, nullable=False, index=True)
    transaction_type = Column(String(50), nullable=False)  # OPENING_BALANCE, DEPOSIT, WITHDRAWAL, INTEREST_CREDIT, ADJUSTMENT
    amount = Column(Numeric(15, 2), nullable=False)
    description = Column(Text, nullable=True)
    reference = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    account = relationship("Account", back_populates="transactions")


class InterestSlab(Base):
    __tablename__ = "interest_slabs"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    min_balance = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    max_balance = Column(Numeric(15, 2), nullable=True)  # NULL indicates no upper limit
    annual_rate = Column(Numeric(6, 4), nullable=False)  # Stored as percentage, e.g. 3.50 for 3.50%
    tier_type = Column(String(20), nullable=False, default="TIERED")  # TIERED or FLAT
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class InterestCalculation(Base):
    __tablename__ = "interest_calculations"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    account_id = Column(Uuid(as_uuid=False), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    day_count_convention = Column(String(30), nullable=False, default="ACTUAL_365")
    average_daily_balance = Column(Numeric(15, 2), nullable=False)
    interest_amount = Column(Numeric(15, 2), nullable=False)
    calculation_status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT, POSTED, SUPERSEDED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    account = relationship("Account", back_populates="calculations")
    breakdowns = relationship("InterestDailyBreakdown", back_populates="calculation", cascade="all, delete-orphan")
    posting = relationship("InterestPosting", back_populates="calculation", uselist=False)


class InterestDailyBreakdown(Base):
    __tablename__ = "interest_daily_breakdown"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    calculation_id = Column(Uuid(as_uuid=False), ForeignKey("interest_calculations.id", ondelete="CASCADE"), nullable=False, index=True)
    calculation_date = Column(Date, nullable=False, index=True)
    opening_balance = Column(Numeric(15, 2), nullable=False)
    transactions_total = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    closing_balance = Column(Numeric(15, 2), nullable=False)
    interest_rate = Column(Numeric(6, 4), nullable=False)
    daily_interest = Column(Numeric(15, 6), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    calculation = relationship("InterestCalculation", back_populates="breakdowns")


class InterestPosting(Base):
    __tablename__ = "interest_postings"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=generate_uuid)
    account_id = Column(Uuid(as_uuid=False), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    calculation_id = Column(Uuid(as_uuid=False), ForeignKey("interest_calculations.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(Uuid(as_uuid=False), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    period_quarter = Column(String(10), nullable=False)  # Q1, Q2, Q3, Q4
    period_year = Column(Integer, nullable=False)
    posted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("account_id", "period_year", "period_quarter", name="uq_account_period"),
    )

    account = relationship("Account", back_populates="postings")
    calculation = relationship("InterestCalculation", back_populates="posting")
    transaction = relationship("Transaction")
