"""
Passbook Statement API endpoints.
"""
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import Profile
from backend.app.schemas.schemas import StatementResponse
from backend.app.services.auth_service import ensure_account_access, get_current_user
from backend.app.services.statement_service import StatementService

router = APIRouter(prefix="/api/accounts", tags=["Statement / Passbook"])


@router.get("/{account_id}/statement", response_model=StatementResponse)
def get_account_statement(
    account_id: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_account_access(db, account_id, current_user)
    statement = StatementService.generate_statement(
        db=db,
        account_id=account_id,
        start_date=start_date,
        end_date=end_date
    )
    return statement


@router.get("/{account_id}/statement/csv")
def download_statement_csv(
    account_id: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_account_access(db, account_id, current_user)
    statement = StatementService.generate_statement(
        db=db,
        account_id=account_id,
        start_date=start_date,
        end_date=end_date
    )
    csv_data = StatementService.export_csv(statement)
    filename = f"statement_{statement.account_number}_{start_date or 'all'}_to_{end_date or 'latest'}.csv"
    
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
