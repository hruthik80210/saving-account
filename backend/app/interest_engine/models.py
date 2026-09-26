"""
Data models for the interest engine.
All monetary amounts are strictly Decimal.
"""
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import List, Optional
from enum import Enum


class TransactionType(str, Enum):
    OPENING_BALANCE = "OPENING_BALANCE"
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"
    INTEREST_CREDIT = "INTEREST_CREDIT"
    ADJUSTMENT = "ADJUSTMENT"


class SlabTierType(str, Enum):
    TIERED = "TIERED"  # Marginal slab (e.g. first 1L at 3%, next 4L at 3.5%)
    FLAT = "FLAT"      # Whole-balance slab (entire balance earns rate of matching slab)


@dataclass
class TransactionRecord:
    id: str
    transaction_date: date
    value_date: date
    transaction_type: TransactionType
    amount: Decimal
    description: Optional[str] = None
    reference: Optional[str] = None

    def __post_init__(self):
        if not isinstance(self.amount, Decimal):
            self.amount = Decimal(str(self.amount))
        if isinstance(self.transaction_type, str):
            self.transaction_type = TransactionType(self.transaction_type.upper())


@dataclass
class InterestSlabRecord:
    id: str
    min_balance: Decimal
    max_balance: Optional[Decimal]  # None means infinity (Above X)
    annual_rate: Decimal            # Percentage e.g. Decimal("3.50") for 3.50%
    tier_type: SlabTierType = SlabTierType.TIERED
    effective_from: date = field(default_factory=date.today)
    effective_to: Optional[date] = None
    status: str = "ACTIVE"

    def __post_init__(self):
        if not isinstance(self.min_balance, Decimal):
            self.min_balance = Decimal(str(self.min_balance))
        if self.max_balance is not None and not isinstance(self.max_balance, Decimal):
            self.max_balance = Decimal(str(self.max_balance))
        if not isinstance(self.annual_rate, Decimal):
            self.annual_rate = Decimal(str(self.annual_rate))
        if isinstance(self.tier_type, str):
            self.tier_type = SlabTierType(self.tier_type.upper())


@dataclass
class DailyCalculationItem:
    date: date
    opening_balance: Decimal
    transactions_total: Decimal
    closing_balance: Decimal
    interest_rate: Decimal          # Effective rate for this day
    daily_interest: Decimal         # High precision interest
    daily_interest_rounded: Decimal # Rounded to 2 decimals for display
    transactions: List[TransactionRecord] = field(default_factory=list)


@dataclass
class MonthlySummaryItem:
    month: str                      # e.g. "2026-07"
    month_name: str                 # e.g. "July 2026"
    opening_balance: Decimal
    total_deposits: Decimal
    total_withdrawals: Decimal
    closing_balance: Decimal
    interest_earned: Decimal


@dataclass
class CalculationResult:
    account_id: Optional[str]
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
    daily_breakdown: List[DailyCalculationItem]
    monthly_summary: List[MonthlySummaryItem]
