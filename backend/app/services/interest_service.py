"""
Interest Service.
Orchestrates calculation runs, quarter boundary resolution, and interest posting.
"""
from datetime import date
from decimal import Decimal
from typing import Tuple, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.app.models.models import (
    Account,
    Transaction,
    InterestSlab,
    InterestCalculation,
    InterestDailyBreakdown,
    InterestPosting,
)
from backend.app.interest_engine.models import (
    TransactionRecord,
    InterestSlabRecord,
    CalculationResult,
    SlabTierType,
)
from backend.app.interest_engine.engine import (
    InterestEngine,
    InterestEngineError,
    NegativeBalanceError,
    NoActiveSlabError,
)
from backend.app.interest_engine.conventions import DayCountConvention, RoundingMode
from backend.app.services.transaction_service import to_engine_record


def get_quarter_dates(year: int, quarter: str) -> Tuple[date, date]:
    """
    Returns (start_date, end_date) for calendar quarters:
    Q1: Jan 01 - Mar 31
    Q2: Apr 01 - Jun 30
    Q3: Jul 01 - Sep 30
    Q4: Oct 01 - Dec 31
    """
    q_upper = quarter.upper()
    if q_upper == "Q1":
        return date(year, 1, 1), date(year, 3, 31)
    elif q_upper == "Q2":
        return date(year, 4, 1), date(year, 6, 30)
    elif q_upper == "Q3":
        return date(year, 7, 1), date(year, 9, 30)
    elif q_upper == "Q4":
        return date(year, 10, 1), date(year, 12, 31)
    else:
        raise ValueError(f"Invalid quarter: {quarter}. Must be one of Q1, Q2, Q3, Q4.")


def to_engine_slab(s: InterestSlab) -> InterestSlabRecord:
    return InterestSlabRecord(
        id=str(s.id),
        min_balance=Decimal(str(s.min_balance)),
        max_balance=Decimal(str(s.max_balance)) if s.max_balance is not None else None,
        annual_rate=Decimal(str(s.annual_rate)),
        tier_type=SlabTierType(s.tier_type.upper()),
        effective_from=s.effective_from,
        effective_to=s.effective_to,
        status=s.status,
    )


class InterestService:

    @classmethod
    def run_calculation(
        cls,
        db: Session,
        account_id: str,
        start_date: date,
        end_date: date,
        day_count_convention: str = "ACTUAL_365",
        rounding_mode: str = "HALF_UP"
    ) -> CalculationResult:
        """
        Runs calculation on account's transactions between start_date and end_date.
        """
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

        tx_models = db.query(Transaction).filter(Transaction.account_id == account_id).all()
        slab_models = db.query(InterestSlab).filter(InterestSlab.status == "ACTIVE").all()

        if not slab_models:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active interest rate slabs configured in the system.")

        engine_txs = [to_engine_record(t) for t in tx_models]
        engine_slabs = [to_engine_slab(s) for s in slab_models]

        engine = InterestEngine(
            day_count_convention=DayCountConvention(day_count_convention),
            rounding_mode=RoundingMode(rounding_mode),
            allow_negative_balance=False
        )

        try:
            result = engine.calculate(
                transactions=engine_txs,
                slabs=engine_slabs,
                start_date=start_date,
                end_date=end_date,
                account_id=account_id
            )
            return result
        except NegativeBalanceError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except NoActiveSlabError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except InterestEngineError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Calculation error: {str(e)}")

    @classmethod
    def post_quarterly_interest(
        cls,
        db: Session,
        account_id: str,
        year: int,
        quarter: str,
        day_count_convention: str = "ACTUAL_365"
    ) -> InterestPosting:
        """
        Calculates interest for quarter, creates INTEREST_CREDIT transaction, and logs posting.
        Prevents duplicate posting for the same account and period.
        """
        quarter_upper = quarter.upper()
        start_date, end_date = get_quarter_dates(year, quarter_upper)

        # 1. Prevent duplicate posting
        existing_posting = db.query(InterestPosting).filter(
            InterestPosting.account_id == account_id,
            InterestPosting.period_year == year,
            InterestPosting.period_quarter == quarter_upper,
        ).first()

        if existing_posting:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Interest for {quarter_upper} {year} has already been posted to account {account_id} on {existing_posting.posted_at.strftime('%Y-%m-%d')}."
            )

        # 2. Run official calculation
        calc_result = cls.run_calculation(
            db=db,
            account_id=account_id,
            start_date=start_date,
            end_date=end_date,
            day_count_convention=day_count_convention
        )

        interest_amount = calc_result.total_interest_earned

        # 3. Create persistent InterestCalculation record
        db_calc = InterestCalculation(
            account_id=account_id,
            period_start=start_date,
            period_end=end_date,
            day_count_convention=day_count_convention,
            average_daily_balance=calc_result.average_daily_balance,
            interest_amount=interest_amount,
            calculation_status="POSTED"
        )
        db.add(db_calc)
        db.flush()  # Generate db_calc.id

        # 4. Save daily breakdown items
        for item in calc_result.daily_breakdown:
            db_daily = InterestDailyBreakdown(
                calculation_id=db_calc.id,
                calculation_date=item.date,
                opening_balance=item.opening_balance,
                transactions_total=item.transactions_total,
                closing_balance=item.closing_balance,
                interest_rate=item.interest_rate,
                daily_interest=item.daily_interest,
            )
            db.add(db_daily)

        # 5. Create the INTEREST_CREDIT transaction on the last day of the quarter
        account = db.query(Account).filter(Account.id == account_id).first()
        acc_suffix = account.account_number[-4:] if account else "0000"

        credit_tx = Transaction(
            account_id=account_id,
            transaction_date=end_date,
            value_date=end_date,
            transaction_type="INTEREST_CREDIT",
            amount=interest_amount,
            description=f"Quarterly Interest Credit for {quarter_upper} {year}",
            reference=f"INT-{year}{quarter_upper}-{acc_suffix}",
        )
        db.add(credit_tx)
        db.flush()

        # 6. Create InterestPosting record
        posting = InterestPosting(
            account_id=account_id,
            calculation_id=db_calc.id,
            transaction_id=credit_tx.id,
            period_quarter=quarter_upper,
            period_year=year,
        )
        db.add(posting)
        db.commit()
        db.refresh(posting)

        return posting
