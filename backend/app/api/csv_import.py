"""
CSV Import API endpoints.
"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import Profile
from backend.app.schemas.schemas import CSVValidateResponse, CSVConfirmRequest
from backend.app.services.auth_service import get_current_user, require_admin
from backend.app.services.csv_import_service import CSVImportService

router = APIRouter(prefix="/api/import", tags=["CSV Import"])


@router.post("/csv/validate", response_model=CSVValidateResponse)
async def validate_csv_upload(
    account_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must be a .csv file.")

    contents = await file.read()
    try:
        decoded = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            decoded = contents.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to decode file. Please ensure UTF-8 encoding.")

    return CSVImportService.validate_csv(decoded, account_id, db)


@router.post("/csv/confirm")
def confirm_csv_import(
    payload: CSVConfirmRequest,
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    imported_count = CSVImportService.confirm_import(db, payload.account_id, payload.valid_rows)
    return {
        "message": f"Successfully imported {imported_count} transactions.",
        "imported_count": imported_count,
    }
