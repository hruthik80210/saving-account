"""
Interest Engine Package for Savings Account Daily Closing Balance Method.
"""
from .conventions import DayCountConvention, RoundingMode, get_denominator, round_currency
from .models import (
    TransactionRecord,
    InterestSlabRecord,
    DailyCalculationItem,
    MonthlySummaryItem,
    CalculationResult,
    TransactionType,
    SlabTierType,
)
from .engine import (
    InterestEngine,
    InterestEngineError,
    NegativeBalanceError,
    NoActiveSlabError,
    calculate_balance_on_date,
    validate_historical_balances,
)

__all__ = [
    "DayCountConvention",
    "RoundingMode",
    "get_denominator",
    "round_currency",
    "TransactionRecord",
    "InterestSlabRecord",
    "DailyCalculationItem",
    "MonthlySummaryItem",
    "CalculationResult",
    "TransactionType",
    "SlabTierType",
    "InterestEngine",
    "InterestEngineError",
    "NegativeBalanceError",
    "NoActiveSlabError",
    "calculate_balance_on_date",
    "validate_historical_balances",
]
