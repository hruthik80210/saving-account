"""
Pydantic Schemas for API requests, responses, and validation.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


# ==============================================================================
# Profile Schemas
# ==============================================================================
class ProfileBase(BaseModel):
    full_name: str
    email: str


class ProfileCreate(ProfileBase):
    id: Optional[str] = None


class ProfileResponse(ProfileBase):
    id: UUID
    role: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


# ==============================================================================
# Account Schemas
# ==============================================================================
class AccountBase(BaseModel):
    account_number: str
    account_type: str = "SAVINGS"
    currency: str = "INR"
    status: str = "ACTIVE"


class AccountCreate(AccountBase):
    pass


class AccountResponse(AccountBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AccountSummaryResponse(BaseModel):
    account: AccountResponse
    current_balance: Decimal
    opening_balance: Decimal
    total_deposits: Decimal
    total_withdrawals: Decimal
    total_interest_credited: Decimal
    average_daily_balance: Decimal
    accrued_interest_ytd: Decimal


# ==============================================================================
# Transaction Schemas
# ==============================================================================
VALID_TRANSACTION_TYPES = [
    "OPENING_BALANCE",
    "DEPOSIT",
    "WITHDRAWAL",
    "INTEREST_CREDIT",
    "ADJUSTMENT"
]


class TransactionBase(BaseModel):
    transaction_date: date
    value_date: date
    transaction_type: str
    amount: Decimal
    description: Optional[str] = None
    reference: Optional[str] = None

    @field_validator("transaction_type")
    def validate_type(cls, v):
        v_upper = v.upper()
        if v_upper not in VALID_TRANSACTION_TYPES:
            raise ValueError(f"Invalid transaction type: {v}. Must be one of {VALID_TRANSACTION_TYPES}")
        return v_upper

    @field_validator("amount")
    def validate_amount(cls, v):
        if v <= Decimal("0.00"):
            raise ValueError("Amount must be strictly positive.")
        return v


class TransactionCreate(TransactionBase):
    account_id: str


class TransactionUpdate(BaseModel):
    transaction_date: Optional[date] = None
    value_date: Optional[date] = None
    transaction_type: Optional[str] = None
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    reference: Optional[str] = None

    @field_validator("transaction_type")
    def validate_type(cls, v):
        if v is not None:
            v_upper = v.upper()
            if v_upper not in VALID_TRANSACTION_TYPES:
                raise ValueError(f"Invalid transaction type: {v}")
            return v_upper
        return v

    @field_validator("amount")
    def validate_amount(cls, v):
        if v is not None and v <= Decimal("0.00"):
            raise ValueError("Amount must be strictly positive.")
        return v


class TransactionResponse(TransactionBase):
    id: UUID
    account_id: UUID
    running_balance: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==============================================================================
# Interest Slab Schemas
# ==============================================================================
class InterestSlabBase(BaseModel):
    min_balance: Decimal = Decimal("0.00")
    max_balance: Optional[Decimal] = None
    annual_rate: Decimal
    tier_type: str = "TIERED"
    effective_from: date
    effective_to: Optional[date] = None
    status: str = "ACTIVE"

    @field_validator("annual_rate")
    def validate_rate(cls, v):
        if v < Decimal("0.00"):
            raise ValueError("Annual rate cannot be negative.")
        return v


class InterestSlabCreate(InterestSlabBase):
    pass


class InterestSlabUpdate(BaseModel):
    min_balance: Optional[Decimal] = None
    max_balance: Optional[Decimal] = None
    annual_rate: Optional[Decimal] = None
    tier_type: Optional[str] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    status: Optional[str] = None


class InterestSlabResponse(InterestSlabBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==============================================================================
# Interest Calculation Schemas
# ==============================================================================
class InterestCalculateRequest(BaseModel):
    account_id: str
    start_date: date
    end_date: date
    day_count_convention: str = "ACTUAL_365"
    rounding_mode: str = "HALF_UP"


class DailyBreakdownResponse(BaseModel):
    date: date
    opening_balance: Decimal
    transactions_total: Decimal
    closing_balance: Decimal
    interest_rate: Decimal
    daily_interest: Decimal
    daily_interest_rounded: Decimal


class MonthlySummaryResponse(BaseModel):
    month: str
    month_name: str
    opening_balance: Decimal
    total_deposits: Decimal
    total_withdrawals: Decimal
    closing_balance: Decimal
    interest_earned: Decimal


class InterestCalculateResponse(BaseModel):
    account_id: str
    period_start: date
    period_end: date
    day_count_convention: str
    total_days: int
    opening_balance: Decimal
    closing_balance: Decimal
    total_deposits: Decimal
    total_withdrawals: Decimal
    total_interest_credited: Decimal
    average_daily_balance: Decimal
    total_interest_earned: Decimal
    daily_breakdown: List[DailyBreakdownResponse]
    monthly_summary: List[MonthlySummaryResponse]


# ==============================================================================
# Interest Posting Schemas
# ==============================================================================
class InterestPostQuarterRequest(BaseModel):
    account_id: str
    year: int
    quarter: str  # Q1, Q2, Q3, Q4
    day_count_convention: str = "ACTUAL_365"


class InterestPostResponse(BaseModel):
    message: str
    posting_id: UUID
    transaction_id: UUID
    account_id: UUID
    period_quarter: str
    period_year: int
    interest_amount: Decimal
    posted_at: datetime


# ==============================================================================
# Passbook / Statement Schemas
# ==============================================================================
class StatementEntryResponse(BaseModel):
    transaction_id: UUID
    transaction_date: date
    value_date: date
    description: str
    reference: Optional[str]
    transaction_type: str
    debit: Optional[Decimal] = None
    credit: Optional[Decimal] = None
    balance: Decimal


class StatementResponse(BaseModel):
    account_id: UUID
    account_number: str
    currency: str
    period_start: Optional[date]
    period_end: Optional[date]
    opening_balance: Decimal
    closing_balance: Decimal
    total_credits: Decimal
    total_debits: Decimal
    entries: List[StatementEntryResponse]


# ==============================================================================
# CSV Import Schemas
# ==============================================================================
class CSVRowData(BaseModel):
    row_number: int
    transaction_date: str
    value_date: str
    type: str
    amount: str
    description: Optional[str] = ""
    reference: Optional[str] = ""
    is_valid: bool
    errors: List[str] = []


class CSVValidateResponse(BaseModel):
    total_rows: int
    valid_rows_count: int
    invalid_rows_count: int
    rows: List[CSVRowData]


class CSVConfirmRequest(BaseModel):
    account_id: str
    valid_rows: List[CSVRowData]
