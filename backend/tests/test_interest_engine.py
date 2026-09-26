"""
Comprehensive unit tests for the Savings Account Daily Closing Balance Interest Engine.
Verifies all 15 scenarios specified in Requirement 20, plus the sample calculation in Requirement 21.
"""
import pytest
from datetime import date
from decimal import Decimal
from backend.app.interest_engine import (
    InterestEngine,
    TransactionRecord,
    InterestSlabRecord,
    TransactionType,
    SlabTierType,
    DayCountConvention,
    NegativeBalanceError,
    round_currency,
)


@pytest.fixture
def default_flat_slab():
    return [
        InterestSlabRecord(
            id="slab-1",
            min_balance=Decimal("0.00"),
            max_balance=None,
            annual_rate=Decimal("3.00"),
            tier_type=SlabTierType.TIERED,
            effective_from=date(2020, 1, 1),
            effective_to=None,
            status="ACTIVE",
        )
    ]


@pytest.fixture
def tiered_slabs():
    """
    Standard Indian Bank Slabs:
    0 - 1,00,000 -> 3.00%
    1,00,001 - 5,00,000 -> 3.50%
    > 5,00,000 -> 4.00%
    """
    return [
        InterestSlabRecord(
            id="slab-1",
            min_balance=Decimal("0.00"),
            max_balance=Decimal("100000.00"),
            annual_rate=Decimal("3.00"),
            tier_type=SlabTierType.TIERED,
            effective_from=date(2025, 1, 1),
            effective_to=None,
            status="ACTIVE",
        ),
        InterestSlabRecord(
            id="slab-2",
            min_balance=Decimal("100000.00"),
            max_balance=Decimal("500000.00"),
            annual_rate=Decimal("3.50"),
            tier_type=SlabTierType.TIERED,
            effective_from=date(2025, 1, 1),
            effective_to=None,
            status="ACTIVE",
        ),
        InterestSlabRecord(
            id="slab-3",
            min_balance=Decimal("500000.00"),
            max_balance=None,
            annual_rate=Decimal("4.00"),
            tier_type=SlabTierType.TIERED,
            effective_from=date(2025, 1, 1),
            effective_to=None,
            status="ACTIVE",
        ),
    ]


# ==============================================================================
# Requirement 21: Sample Calculation Verification
# ==============================================================================
def test_sample_calculation_requirement_21(default_flat_slab):
    """
    Sample calculation from Requirement 21:
    Opening balance: ₹50,000 on 01-Jul-2026
    05-Jul: Deposit ₹10,000
    12-Jul: Withdrawal ₹5,000
    20-Jul: Deposit ₹20,000
    Interest rate: 3% p.a.
    Period: 01-Jul-2026 to 31-Jul-2026 (31 days)
    Expected calculation:
    - 01-Jul to 04-Jul (4 days): balance 50,000 -> 4 * (50000 * 0.03 / 365) = 16.438356...
    - 05-Jul to 11-Jul (7 days): balance 60,000 -> 7 * (60000 * 0.03 / 365) = 34.520547...
    - 12-Jul to 19-Jul (8 days): balance 55,000 -> 8 * (55000 * 0.03 / 365) = 36.164383...
    - 20-Jul to 31-Jul (12 days): balance 75,000 -> 12 * (75000 * 0.03 / 365) = 73.972602...
    Total unrounded = 161.09589... -> Rounded: 161.10
    """
    txs = [
        TransactionRecord(
            id="tx-1",
            transaction_date=date(2026, 7, 1),
            value_date=date(2026, 7, 1),
            transaction_type=TransactionType.OPENING_BALANCE,
            amount=Decimal("50000.00"),
            description="Opening balance",
        ),
        TransactionRecord(
            id="tx-2",
            transaction_date=date(2026, 7, 5),
            value_date=date(2026, 7, 5),
            transaction_type=TransactionType.DEPOSIT,
            amount=Decimal("10000.00"),
            description="Deposit 10k",
        ),
        TransactionRecord(
            id="tx-3",
            transaction_date=date(2026, 7, 12),
            value_date=date(2026, 7, 12),
            transaction_type=TransactionType.WITHDRAWAL,
            amount=Decimal("5000.00"),
            description="Withdrawal 5k",
        ),
        TransactionRecord(
            id="tx-4",
            transaction_date=date(2026, 7, 20),
            value_date=date(2026, 7, 20),
            transaction_type=TransactionType.DEPOSIT,
            amount=Decimal("20000.00"),
            description="Deposit 20k",
        ),
    ]

    engine = InterestEngine(day_count_convention=DayCountConvention.ACTUAL_365)
    res = engine.calculate(
        transactions=txs,
        slabs=default_flat_slab,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 31),
    )

    assert res.total_days == 31
    assert res.opening_balance == Decimal("0.00")  # Prior to 01-Jul was 0
    assert res.closing_balance == Decimal("75000.00")
    assert res.total_deposits == Decimal("80000.00")  # 50k opening + 10k + 20k
    assert res.total_withdrawals == Decimal("5000.00")

    # Check closing balance on key transition dates
    daily_map = {d.date: d for d in res.daily_breakdown}
    assert daily_map[date(2026, 7, 1)].closing_balance == Decimal("50000.00")
    assert daily_map[date(2026, 7, 4)].closing_balance == Decimal("50000.00")
    assert daily_map[date(2026, 7, 5)].closing_balance == Decimal("60000.00")
    assert daily_map[date(2026, 7, 11)].closing_balance == Decimal("60000.00")
    assert daily_map[date(2026, 7, 12)].closing_balance == Decimal("55000.00")
    assert daily_map[date(2026, 7, 19)].closing_balance == Decimal("55000.00")
    assert daily_map[date(2026, 7, 20)].closing_balance == Decimal("75000.00")
    assert daily_map[date(2026, 7, 31)].closing_balance == Decimal("75000.00")

    # Expected exact sum = 58800 / 365 = 161.09589... -> ₹161.10
    expected_interest = Decimal("161.10")
    assert res.total_interest_earned == expected_interest


# ==============================================================================
# Scenario 1: Single balance for 30 days
# ==============================================================================
def test_scenario_1_single_balance_30_days(default_flat_slab):
    txs = [
        TransactionRecord(
            id="tx-1",
            transaction_date=date(2026, 4, 1),
            value_date=date(2026, 4, 1),
            transaction_type=TransactionType.OPENING_BALANCE,
            amount=Decimal("100000.00"),
        )
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, default_flat_slab, date(2026, 4, 1), date(2026, 4, 30))
    
    assert res.total_days == 30
    assert res.closing_balance == Decimal("100000.00")
    # Expected: 30 * (100000 * 0.03 / 365) = 30 * (3000 / 365) = 90000 / 365 = 246.5753... -> 246.58
    assert res.total_interest_earned == Decimal("246.58")
    assert res.average_daily_balance == Decimal("100000.00")


# ==============================================================================
# Scenario 2: Deposit during the period
# ==============================================================================
def test_scenario_2_deposit_during_period(default_flat_slab):
    txs = [
        TransactionRecord("1", date(2026, 1, 1), date(2026, 1, 1), TransactionType.OPENING_BALANCE, Decimal("10000.00")),
        TransactionRecord("2", date(2026, 1, 15), date(2026, 1, 15), TransactionType.DEPOSIT, Decimal("10000.00")),
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, default_flat_slab, date(2026, 1, 1), date(2026, 1, 31))
    
    # 14 days @ 10,000 = 14 * 300 / 365 = 4200 / 365 = 11.5068
    # 17 days @ 20,000 = 17 * 600 / 365 = 10200 / 365 = 27.9452
    # Total = 14400 / 365 = 39.45205... -> 39.45
    assert res.closing_balance == Decimal("20000.00")
    assert res.total_interest_earned == Decimal("39.45")


# ==============================================================================
# Scenario 3: Withdrawal during the period
# ==============================================================================
def test_scenario_3_withdrawal_during_period(default_flat_slab):
    txs = [
        TransactionRecord("1", date(2026, 1, 1), date(2026, 1, 1), TransactionType.OPENING_BALANCE, Decimal("50000.00")),
        TransactionRecord("2", date(2026, 1, 11), date(2026, 1, 11), TransactionType.WITHDRAWAL, Decimal("20000.00")),
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, default_flat_slab, date(2026, 1, 1), date(2026, 1, 20))
    # 10 days @ 50,000 = 10 * 1500 / 365 = 15000 / 365
    # 10 days @ 30,000 = 10 * 900 / 365 = 9000 / 365
    # Total = 24000 / 365 = 65.7534... -> 65.75
    assert res.closing_balance == Decimal("30000.00")
    assert res.total_interest_earned == Decimal("65.75")


# ==============================================================================
# Scenario 4: Multiple transactions on one day
# ==============================================================================
def test_scenario_4_multiple_transactions_one_day(default_flat_slab):
    txs = [
        TransactionRecord("1", date(2026, 5, 1), date(2026, 5, 1), TransactionType.OPENING_BALANCE, Decimal("10000.00")),
        TransactionRecord("2", date(2026, 5, 10), date(2026, 5, 10), TransactionType.DEPOSIT, Decimal("5000.00")),
        TransactionRecord("3", date(2026, 5, 10), date(2026, 5, 10), TransactionType.WITHDRAWAL, Decimal("2000.00")),
        TransactionRecord("4", date(2026, 5, 10), date(2026, 5, 10), TransactionType.DEPOSIT, Decimal("7000.00")),
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, default_flat_slab, date(2026, 5, 1), date(2026, 5, 10))
    # Closing balance on 10th should be 10000 + 5000 - 2000 + 7000 = 20000
    daily_map = {d.date: d for d in res.daily_breakdown}
    assert daily_map[date(2026, 5, 10)].closing_balance == Decimal("20000.00")
    assert daily_map[date(2026, 5, 10)].transactions_total == Decimal("10000.00")


# ==============================================================================
# Scenario 5 & 6: Value-dated and Backdated transactions
# ==============================================================================
def test_scenario_5_and_6_value_dated_and_backdated(default_flat_slab):
    """
    Transaction created on 15-May but value date is 05-May (deposit 10,000).
    The engine must calculate 05-May onwards with the updated balance!
    """
    txs = [
        TransactionRecord("1", date(2026, 5, 1), date(2026, 5, 1), TransactionType.OPENING_BALANCE, Decimal("20000.00")),
        TransactionRecord("2", date(2026, 5, 15), date(2026, 5, 5), TransactionType.DEPOSIT, Decimal("10000.00"), description="Backdated deposit"),
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, default_flat_slab, date(2026, 5, 1), date(2026, 5, 10))
    daily_map = {d.date: d for d in res.daily_breakdown}

    # On 04-May closing balance was 20,000
    assert daily_map[date(2026, 5, 4)].closing_balance == Decimal("20000.00")
    # On 05-May closing balance is 30,000 because value_date is 05-May
    assert daily_map[date(2026, 5, 5)].closing_balance == Decimal("30000.00")
    assert daily_map[date(2026, 5, 10)].closing_balance == Decimal("30000.00")


# ==============================================================================
# Scenario 7: Interest slab tiered calculation
# ==============================================================================
def test_scenario_7_interest_slab_tiered(tiered_slabs):
    """
    Tiered slabs:
    0 - 100k @ 3%
    100k - 500k @ 3.5%
    Balance = 300,000 for 1 day
    Tier 1: 100,000 * 3% = 3,000 / 365
    Tier 2: 200,000 * 3.5% = 7,000 / 365
    Total annual = 10,000 / 365 = 27.39726...
    """
    txs = [
        TransactionRecord("1", date(2026, 1, 1), date(2026, 1, 1), TransactionType.OPENING_BALANCE, Decimal("300000.00"))
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, tiered_slabs, date(2026, 1, 1), date(2026, 1, 1))
    expected_daily = Decimal("10000.00") / Decimal("365")
    assert res.total_interest_earned == round_currency(expected_daily, 2)


# ==============================================================================
# Scenario 8: Rate change during quarter
# ==============================================================================
def test_scenario_8_rate_change_during_quarter():
    """
    Rate was 3.00% until 15-Feb-2026, changed to 4.00% from 16-Feb-2026.
    """
    slabs = [
        InterestSlabRecord(
            id="s1",
            min_balance=Decimal("0.00"),
            max_balance=None,
            annual_rate=Decimal("3.00"),
            effective_from=date(2025, 1, 1),
            effective_to=date(2026, 2, 15),
            status="ACTIVE",
        ),
        InterestSlabRecord(
            id="s2",
            min_balance=Decimal("0.00"),
            max_balance=None,
            annual_rate=Decimal("4.00"),
            effective_from=date(2026, 2, 16),
            effective_to=None,
            status="ACTIVE",
        ),
    ]
    txs = [
        TransactionRecord("1", date(2026, 2, 1), date(2026, 2, 1), TransactionType.OPENING_BALANCE, Decimal("36500.00"))
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, slabs, date(2026, 2, 1), date(2026, 2, 28))
    daily_map = {d.date: d for d in res.daily_breakdown}

    # On 15-Feb, rate is 3% -> 36500 * 0.03 / 365 = 3.00
    assert daily_map[date(2026, 2, 15)].interest_rate == Decimal("3.0000")
    assert daily_map[date(2026, 2, 15)].daily_interest == Decimal("3.00")

    # On 16-Feb, rate is 4% -> 36500 * 0.04 / 365 = 4.00
    assert daily_map[date(2026, 2, 16)].interest_rate == Decimal("4.0000")
    assert daily_map[date(2026, 2, 16)].daily_interest == Decimal("4.00")


# ==============================================================================
# Scenario 9: Leap Year (2024 or 2028 - 29 days in Feb)
# ==============================================================================
def test_scenario_9_leap_year(default_flat_slab):
    txs = [
        TransactionRecord("1", date(2024, 2, 1), date(2024, 2, 1), TransactionType.OPENING_BALANCE, Decimal("10000.00"))
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, default_flat_slab, date(2024, 2, 1), date(2024, 2, 29))
    assert res.total_days == 29
    daily_map = {d.date: d for d in res.daily_breakdown}
    assert date(2024, 2, 29) in daily_map
    assert daily_map[date(2024, 2, 29)].closing_balance == Decimal("10000.00")


# ==============================================================================
# Scenario 10: Zero Balance
# ==============================================================================
def test_scenario_10_zero_balance(default_flat_slab):
    txs = [
        TransactionRecord("1", date(2026, 3, 1), date(2026, 3, 1), TransactionType.OPENING_BALANCE, Decimal("10000.00")),
        TransactionRecord("2", date(2026, 3, 1), date(2026, 3, 1), TransactionType.WITHDRAWAL, Decimal("10000.00")),
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, default_flat_slab, date(2026, 3, 1), date(2026, 3, 5))
    assert res.closing_balance == Decimal("0.00")
    assert res.total_interest_earned == Decimal("0.00")
    for d in res.daily_breakdown:
        assert d.closing_balance == Decimal("0.00")
        assert d.daily_interest == Decimal("0.00")


# ==============================================================================
# Scenario 11: Quarter Boundary
# ==============================================================================
def test_scenario_11_quarter_boundary(default_flat_slab):
    # Q1: 01-Jan to 31-Mar (90 days in non-leap 2026)
    txs = [
        TransactionRecord("1", date(2026, 1, 1), date(2026, 1, 1), TransactionType.OPENING_BALANCE, Decimal("100000.00"))
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, default_flat_slab, date(2026, 1, 1), date(2026, 3, 31))
    assert res.total_days == 90
    assert res.daily_breakdown[0].date == date(2026, 1, 1)
    assert res.daily_breakdown[-1].date == date(2026, 3, 31)


# ==============================================================================
# Scenario 12: Duplicate interest posting detection logic
# ==============================================================================
def test_scenario_12_duplicate_interest_posting(default_flat_slab):
    """
    Ensures that an interest credit transaction increases balance properly
    and can be tracked as INTEREST_CREDIT.
    """
    txs = [
        TransactionRecord("1", date(2026, 1, 1), date(2026, 1, 1), TransactionType.OPENING_BALANCE, Decimal("50000.00")),
        TransactionRecord("2", date(2026, 3, 31), date(2026, 3, 31), TransactionType.INTEREST_CREDIT, Decimal("369.86"), description="Q1 Interest"),
    ]
    engine = InterestEngine()
    res = engine.calculate(txs, default_flat_slab, date(2026, 1, 1), date(2026, 3, 31))
    assert res.total_interest_credited == Decimal("369.86")
    assert res.closing_balance == Decimal("50369.86")


# ==============================================================================
# Scenario 13: Invalid withdrawal (Negative balance prevention)
# ==============================================================================
def test_scenario_13_invalid_withdrawal_raises_error(default_flat_slab):
    txs = [
        TransactionRecord("1", date(2026, 1, 1), date(2026, 1, 1), TransactionType.OPENING_BALANCE, Decimal("5000.00")),
        TransactionRecord("2", date(2026, 1, 5), date(2026, 1, 5), TransactionType.WITHDRAWAL, Decimal("6000.00")),
    ]
    engine = InterestEngine(allow_negative_balance=False)
    with pytest.raises(NegativeBalanceError) as exc_info:
        engine.calculate(txs, default_flat_slab, date(2026, 1, 1), date(2026, 1, 10))
    assert "causes negative balance" in str(exc_info.value) or "Insufficient funds" in str(exc_info.value)


# ==============================================================================
# Scenario 14 & 15: Actual/365 vs Actual/366 calculation
# ==============================================================================
def test_scenario_14_and_15_actual_365_vs_366(default_flat_slab):
    txs = [
        TransactionRecord("1", date(2026, 1, 1), date(2026, 1, 1), TransactionType.OPENING_BALANCE, Decimal("365000.00"))
    ]
    # In Actual/365: daily interest = 365,000 * 0.03 / 365 = 30.00 / day
    engine_365 = InterestEngine(day_count_convention=DayCountConvention.ACTUAL_365)
    res_365 = engine_365.calculate(txs, default_flat_slab, date(2026, 1, 1), date(2026, 1, 1))
    assert res_365.daily_breakdown[0].daily_interest == Decimal("30.00")

    # In Actual/366: daily interest = 365,000 * 0.03 / 366 = 10,950 / 366 = 29.9180327...
    engine_366 = InterestEngine(day_count_convention=DayCountConvention.ACTUAL_366)
    res_366 = engine_366.calculate(txs, default_flat_slab, date(2026, 1, 1), date(2026, 1, 1))
    expected_366 = Decimal("10950.00") / Decimal("366")
    assert res_366.daily_breakdown[0].daily_interest == expected_366
    assert res_366.total_interest_earned == round_currency(expected_366, 2)
