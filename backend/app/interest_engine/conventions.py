"""
Day-count conventions and banking financial rounding rules.
"""
from enum import Enum
import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN


class DayCountConvention(str, Enum):
    ACTUAL_365 = "ACTUAL_365"
    ACTUAL_366 = "ACTUAL_366"
    ACTUAL_ACTUAL = "ACTUAL_ACTUAL"


class RoundingMode(str, Enum):
    HALF_UP = "HALF_UP"       # Standard Indian Banking (paise >= 0.5 rounds up)
    HALF_EVEN = "HALF_EVEN"   # Banker's Rounding


def get_denominator(convention: DayCountConvention | str, current_date: date) -> Decimal:
    """
    Returns the year denominator based on convention and date.
    - ACTUAL_365: Fixed 365 days.
    - ACTUAL_366: Fixed 366 days.
    - ACTUAL_ACTUAL: 366 if leap year, 365 if non-leap year.
    """
    conv_val = convention.value if isinstance(convention, DayCountConvention) else str(convention)
    conv_str = conv_val.upper().replace("-", "_").replace("/", "_")
    if conv_str in ("ACTUAL_366", "366"):
        return Decimal("366")
    elif conv_str in ("ACTUAL_ACTUAL", "ACTUAL_365_366"):
        is_leap = calendar.isleap(current_date.year)
        return Decimal("366") if is_leap else Decimal("365")
    else:
        # Default Actual/365
        return Decimal("365")


def round_currency(value: Decimal, places: int = 2, mode: RoundingMode = RoundingMode.HALF_UP) -> Decimal:
    """
    Rounds a Decimal value according to banking convention.
    Default: ROUND_HALF_UP to 2 decimal places (paise/cents).
    """
    quantize_target = Decimal("10") ** -places
    round_rule = ROUND_HALF_UP if mode == RoundingMode.HALF_UP else ROUND_HALF_EVEN
    return value.quantize(quantize_target, rounding=round_rule)
