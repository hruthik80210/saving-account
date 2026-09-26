"""
Interest Calculation & Posting API endpoints.
"""
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import Profile, InterestPosting
from backend.app.schemas.schemas import (
    InterestCalculateRequest,
    InterestCalculateResponse,
    InterestPostQuarterRequest,
    InterestPostResponse,
    DailyBreakdownResponse,
    MonthlySummaryResponse,
)
from backend.app.services.auth_service import get_current_user
from backend.app.services.interest_service import InterestService, get_quarter_dates

router = APIRouter(prefix="/api/interest", tags=["Interest Calculation"])


@router.post("/calculate", response_model=InterestCalculateResponse)
def calculate_interest(
    payload: InterestCalculateRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = InterestService.run_calculation(
        db=db,
        account_id=payload.account_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        day_count_convention=payload.day_count_convention,
        rounding_mode=payload.rounding_mode,
    )

    daily_responses = [
        DailyBreakdownResponse(
            date=d.date,
            opening_balance=d.opening_balance,
            transactions_total=d.transactions_total,
            closing_balance=d.closing_balance,
            interest_rate=d.interest_rate,
            daily_interest=d.daily_interest,
            daily_interest_rounded=d.daily_interest_rounded,
        )
        for d in result.daily_breakdown
    ]

    monthly_responses = [
        MonthlySummaryResponse(
            month=m.month,
            month_name=m.month_name,
            opening_balance=m.opening_balance,
            total_deposits=m.total_deposits,
            total_withdrawals=m.total_withdrawals,
            closing_balance=m.closing_balance,
            interest_earned=m.interest_earned,
        )
        for m in result.monthly_summary
    ]

    return InterestCalculateResponse(
        account_id=payload.account_id,
        period_start=result.period_start,
        period_end=result.period_end,
        day_count_convention=result.day_count_convention,
        total_days=result.total_days,
        opening_balance=result.opening_balance,
        closing_balance=result.closing_balance,
        total_deposits=result.total_deposits,
        total_withdrawals=result.total_withdrawals,
        total_interest_credited=result.total_interest_credited,
        average_daily_balance=result.average_daily_balance,
        total_interest_earned=result.total_interest_earned,
        daily_breakdown=daily_responses,
        monthly_summary=monthly_responses,
    )


@router.get("/quarter-preview", response_model=InterestCalculateResponse)
def preview_quarterly_interest(
    account_id: str,
    year: int = Query(..., ge=2000, le=2100),
    quarter: str = Query(..., pattern="^(?i)(Q1|Q2|Q3|Q4)$"),
    day_count_convention: str = "ACTUAL_365",
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    start_date, end_date = get_quarter_dates(year, quarter)
    req = InterestCalculateRequest(
        account_id=account_id,
        start_date=start_date,
        end_date=end_date,
        day_count_convention=day_count_convention,
    )
    return calculate_interest(req, current_user, db)


@router.post("/post", response_model=InterestPostResponse, status_code=status.HTTP_201_CREATED)
def post_interest(
    payload: InterestPostQuarterRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    posting = InterestService.post_quarterly_interest(
        db=db,
        account_id=payload.account_id,
        year=payload.year,
        quarter=payload.quarter,
        day_count_convention=payload.day_count_convention,
    )

    return InterestPostResponse(
        message=f"Interest for {payload.quarter.upper()} {payload.year} successfully posted to account.",
        posting_id=str(posting.id),
        transaction_id=str(posting.transaction_id),
        account_id=str(posting.account_id),
        period_quarter=posting.period_quarter,
        period_year=posting.period_year,
        interest_amount=posting.calculation.interest_amount if posting.calculation else Decimal("0.00"),
        posted_at=posting.posted_at,
    )


@router.get("/postings/{account_id}")
def get_account_postings(
    account_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    postings = db.query(InterestPosting).filter(InterestPosting.account_id == account_id).order_by(InterestPosting.posted_at.desc()).all()
    return [
        {
            "id": str(p.id),
            "account_id": str(p.account_id),
            "calculation_id": str(p.calculation_id),
            "transaction_id": str(p.transaction_id),
            "period_quarter": p.period_quarter,
            "period_year": p.period_year,
            "interest_amount": p.calculation.interest_amount if p.calculation else Decimal("0.00"),
            "posted_at": p.posted_at,
        }
        for p in postings
    ]
