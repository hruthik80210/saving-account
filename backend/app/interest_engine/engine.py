"""
Core Daily Closing Balance Interest Calculation Engine.
Strictly uses Decimal arithmetic and configurable banking rounding.
"""
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Dict, Optional, Tuple
import calendar

from .models import (
    TransactionRecord,
    InterestSlabRecord,
    DailyCalculationItem,
    MonthlySummaryItem,
    CalculationResult,
    TransactionType,
    SlabTierType,
)
from .conventions import (
    DayCountConvention,
    RoundingMode,
    get_denominator,
    round_currency,
)


class InterestEngineError(Exception):
    """Base exception for interest engine errors."""
    pass


class NegativeBalanceError(InterestEngineError):
    """Raised when an operation would result in an illegal negative closing balance."""
    def __init__(self, target_date: date, balance: Decimal, message: Optional[str] = None):
        self.target_date = target_date
        self.balance = balance
        msg = message or f"Insufficient funds: Balance would become negative ({balance}) on {target_date.isoformat()}."
        super().__init__(msg)


class NoActiveSlabError(InterestEngineError):
    """Raised when no active interest slab covers a calculation date."""
    def __init__(self, target_date: date):
        super().__init__(f"No active interest rate slab configured for date {target_date.isoformat()}.")


def get_transaction_net_effect(tx: TransactionRecord) -> Decimal:
    """
    Returns signed impact on balance (+ for credits, - for debits).
    """
    tt = tx.transaction_type
    amt = abs(tx.amount)
    if tt in (TransactionType.OPENING_BALANCE, TransactionType.DEPOSIT, TransactionType.INTEREST_CREDIT):
        return amt
    elif tt == TransactionType.WITHDRAWAL:
        return -amt
    elif tt == TransactionType.ADJUSTMENT:
        # If adjustment amount was passed as negative, respect it, otherwise treat as positive
        return tx.amount
    return amt


def validate_historical_balances(
    transactions: List[TransactionRecord],
    allow_negative: bool = False
) -> Dict[date, Decimal]:
    """
    Sorts all transactions by value_date and derives the daily closing balance for every
    date with transactions, verifying that balance never goes negative unless allowed.
    Returns map of date -> closing balance.
    """
    if not transactions:
        return {}

    # Sort primarily by value_date, then by priority of type (Opening first, Deposit second, etc.)
    type_priority = {
        TransactionType.OPENING_BALANCE: 0,
        TransactionType.DEPOSIT: 1,
        TransactionType.INTEREST_CREDIT: 2,
        TransactionType.ADJUSTMENT: 3,
        TransactionType.WITHDRAWAL: 4,
    }
    
    sorted_txs = sorted(
        transactions,
        key=lambda tx: (tx.value_date, type_priority.get(tx.transaction_type, 5), tx.id)
    )

    daily_closing: Dict[date, Decimal] = {}
    current_balance = Decimal("0.00")
    
    for tx in sorted_txs:
        net = get_transaction_net_effect(tx)
        current_balance += net
        daily_closing[tx.value_date] = current_balance

        if not allow_negative and current_balance < Decimal("0.00"):
            raise NegativeBalanceError(
                target_date=tx.value_date,
                balance=current_balance,
                message=f"Transaction '{tx.description or tx.id}' with value date {tx.value_date.isoformat()} causes negative balance of {current_balance}."
            )

    return daily_closing


def calculate_balance_on_date(
    transactions: List[TransactionRecord],
    target_date: date
) -> Decimal:
    """
    Computes exact closing balance as of target_date (considering all transactions with value_date <= target_date).
    """
    balance = Decimal("0.00")
    for tx in transactions:
        if tx.value_date <= target_date:
            balance += get_transaction_net_effect(tx)
    return balance


def get_active_slabs_for_date(
    slabs: List[InterestSlabRecord],
    target_date: date
) -> List[InterestSlabRecord]:
    """
    Returns active slabs applicable for target_date.
    """
    active = [
        s for s in slabs
        if s.status.upper() == "ACTIVE"
        and s.effective_from <= target_date
        and (s.effective_to is None or s.effective_to >= target_date)
    ]
    return sorted(active, key=lambda s: s.min_balance)


def calculate_daily_interest_for_balance(
    closing_balance: Decimal,
    target_date: date,
    active_slabs: List[InterestSlabRecord],
    denominator: Decimal,
    default_tier_type: SlabTierType = SlabTierType.TIERED
) -> Tuple[Decimal, Decimal]:
    """
    Calculates (daily_interest, effective_rate) for a given daily closing balance.
    Handles both TIERED (bracket/marginal) and FLAT (whole-balance) calculations.
    """
    if closing_balance <= Decimal("0.00") or not active_slabs:
        return Decimal("0.00"), Decimal("0.00")

    # Determine tier type from slabs or default
    tier_type = active_slabs[0].tier_type if active_slabs else default_tier_type

    if tier_type == SlabTierType.TIERED:
        daily_interest = Decimal("0.00")
        for s in active_slabs:
            if closing_balance > s.min_balance:
                upper = s.max_balance if s.max_balance is not None else closing_balance
                taxable_in_tier = min(closing_balance, upper) - s.min_balance
                if taxable_in_tier > Decimal("0.00"):
                    rate_factor = (s.annual_rate / Decimal("100.0")) / denominator
                    daily_interest += taxable_in_tier * rate_factor

        effective_rate = (daily_interest * denominator / closing_balance) * Decimal("100.0")
        return daily_interest, round_currency(effective_rate, places=4)

    else:
        # FLAT (whole-balance) slab
        matched_slab = None
        for s in active_slabs:
            if s.min_balance <= closing_balance:
                if s.max_balance is None or closing_balance <= s.max_balance:
                    matched_slab = s
                    break

        if matched_slab:
            rate_factor = (matched_slab.annual_rate / Decimal("100.0")) / denominator
            daily_interest = closing_balance * rate_factor
            return daily_interest, matched_slab.annual_rate
        else:
            return Decimal("0.00"), Decimal("0.00")


class InterestEngine:
    """
    High-precision Savings Account Daily Closing Balance Interest Engine.
    """

    def __init__(
        self,
        day_count_convention: DayCountConvention | str = DayCountConvention.ACTUAL_365,
        rounding_mode: RoundingMode = RoundingMode.HALF_UP,
        allow_negative_balance: bool = False
    ):
        self.day_count_convention = day_count_convention
        self.rounding_mode = rounding_mode
        self.allow_negative_balance = allow_negative_balance

    def calculate(
        self,
        transactions: List[TransactionRecord],
        slabs: List[InterestSlabRecord],
        start_date: date,
        end_date: date,
        account_id: Optional[str] = None
    ) -> CalculationResult:
        """
        Executes daily closing balance calculation for the date range [start_date, end_date].
        """
        if start_date > end_date:
            raise ValueError(f"start_date ({start_date}) cannot be after end_date ({end_date}).")

        # 1. Validate full historical balance integrity
        validate_historical_balances(transactions, allow_negative=self.allow_negative_balance)

        # 2. Derive opening balance on start_date
        # Opening balance on start_date is the closing balance of (start_date - 1 day)
        prior_date = start_date - timedelta(days=1)
        running_balance = calculate_balance_on_date(transactions, prior_date)
        initial_opening_balance = running_balance

        # 3. Group transactions by value_date
        tx_by_value_date: Dict[date, List[TransactionRecord]] = {}
        for tx in transactions:
            if tx.value_date not in tx_by_value_date:
                tx_by_value_date[tx.value_date] = []
            tx_by_value_date[tx.value_date].append(tx)

        # Priority sorting for transactions on the same value date
        type_priority = {
            TransactionType.OPENING_BALANCE: 0,
            TransactionType.DEPOSIT: 1,
            TransactionType.INTEREST_CREDIT: 2,
            TransactionType.ADJUSTMENT: 3,
            TransactionType.WITHDRAWAL: 4,
        }
        for v_date in tx_by_value_date:
            tx_by_value_date[v_date].sort(
                key=lambda tx: (type_priority.get(tx.transaction_type, 5), tx.id)
            )

        # 4. Iterate every calendar day in the period
        total_days = (end_date - start_date).days + 1
        daily_breakdown: List[DailyCalculationItem] = []

        total_deposits = Decimal("0.00")
        total_withdrawals = Decimal("0.00")
        total_interest_credited = Decimal("0.00")
        sum_closing_balances = Decimal("0.00")
        sum_daily_interest = Decimal("0.00")

        curr_date = start_date
        while curr_date <= end_date:
            day_opening = running_balance
            day_txs = tx_by_value_date.get(curr_date, [])
            
            day_net = Decimal("0.00")
            for tx in day_txs:
                net = get_transaction_net_effect(tx)
                day_net += net
                if tx.transaction_type in (TransactionType.DEPOSIT, TransactionType.OPENING_BALANCE):
                    total_deposits += tx.amount
                elif tx.transaction_type == TransactionType.WITHDRAWAL:
                    total_withdrawals += tx.amount
                elif tx.transaction_type == TransactionType.INTEREST_CREDIT:
                    total_interest_credited += tx.amount

            day_closing = day_opening + day_net
            if not self.allow_negative_balance and day_closing < Decimal("0.00"):
                raise NegativeBalanceError(curr_date, day_closing)

            running_balance = day_closing
            sum_closing_balances += day_closing

            # Determine rate and interest
            denominator = get_denominator(self.day_count_convention, curr_date)
            active_slabs = get_active_slabs_for_date(slabs, curr_date)
            
            if not active_slabs and day_closing > Decimal("0.00"):
                raise NoActiveSlabError(curr_date)

            daily_interest, effective_rate = calculate_daily_interest_for_balance(
                closing_balance=day_closing,
                target_date=curr_date,
                active_slabs=active_slabs,
                denominator=denominator
            )

            sum_daily_interest += daily_interest
            daily_interest_rounded = round_currency(daily_interest, places=2, mode=self.rounding_mode)

            daily_breakdown.append(DailyCalculationItem(
                date=curr_date,
                opening_balance=day_opening,
                transactions_total=day_net,
                closing_balance=day_closing,
                interest_rate=effective_rate,
                daily_interest=daily_interest,
                daily_interest_rounded=daily_interest_rounded,
                transactions=day_txs
            ))

            curr_date += timedelta(days=1)

        # 5. Aggregate calculations
        adb = round_currency(sum_closing_balances / Decimal(str(total_days)), places=2, mode=self.rounding_mode)
        total_interest_earned = round_currency(sum_daily_interest, places=2, mode=self.rounding_mode)
        final_closing_balance = running_balance

        # 6. Monthly summary
        monthly_summary = self._build_monthly_summary(daily_breakdown)

        return CalculationResult(
            account_id=account_id,
            period_start=start_date,
            period_end=end_date,
            day_count_convention=str(self.day_count_convention),
            total_days=total_days,
            opening_balance=initial_opening_balance,
            closing_balance=final_closing_balance,
            total_deposits=total_deposits,
            total_withdrawals=total_withdrawals,
            total_interest_credited=total_interest_credited,
            average_daily_balance=adb,
            total_interest_earned=total_interest_earned,
            daily_breakdown=daily_breakdown,
            monthly_summary=monthly_summary,
        )

    def _build_monthly_summary(self, daily_breakdown: List[DailyCalculationItem]) -> List[MonthlySummaryItem]:
        """
        Groups daily calculation items by month and generates month-by-month summary.
        """
        if not daily_breakdown:
            return []

        months_map: Dict[str, List[DailyCalculationItem]] = {}
        for item in daily_breakdown:
            m_key = item.date.strftime("%Y-%m")
            if m_key not in months_map:
                months_map[m_key] = []
            months_map[m_key].append(item)

        summaries: List[MonthlySummaryItem] = []
        for m_key, items in months_map.items():
            first_day = items[0]
            last_day = items[-1]
            
            m_deposits = Decimal("0.00")
            m_withdrawals = Decimal("0.00")
            m_interest_sum = Decimal("0.00")

            for it in items:
                m_interest_sum += it.daily_interest
                for tx in it.transactions:
                    if tx.transaction_type in (TransactionType.DEPOSIT, TransactionType.OPENING_BALANCE, TransactionType.INTEREST_CREDIT):
                        m_deposits += tx.amount
                    elif tx.transaction_type == TransactionType.WITHDRAWAL:
                        m_withdrawals += tx.amount

            month_name = items[0].date.strftime("%B %Y")
            summaries.append(MonthlySummaryItem(
                month=m_key,
                month_name=month_name,
                opening_balance=first_day.opening_balance,
                total_deposits=m_deposits,
                total_withdrawals=m_withdrawals,
                closing_balance=last_day.closing_balance,
                interest_earned=round_currency(m_interest_sum, places=2, mode=self.rounding_mode)
            ))

        return summaries
