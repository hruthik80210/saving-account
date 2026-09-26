"""
Interest Slabs API endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import InterestSlab, Profile
from backend.app.schemas.schemas import (
    InterestSlabCreate,
    InterestSlabUpdate,
    InterestSlabResponse,
)
from backend.app.services.auth_service import get_current_user, require_admin

router = APIRouter(prefix="/api/interest-slabs", tags=["Interest Slabs"])


@router.get("", response_model=List[InterestSlabResponse])
def get_interest_slabs(
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    slabs = db.query(InterestSlab).order_by(InterestSlab.effective_from.desc(), InterestSlab.min_balance.asc()).all()
    return slabs


@router.post("", response_model=InterestSlabResponse, status_code=status.HTTP_201_CREATED)
def create_interest_slab(
    payload: InterestSlabCreate,
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    new_slab = InterestSlab(
        min_balance=payload.min_balance,
        max_balance=payload.max_balance,
        annual_rate=payload.annual_rate,
        tier_type=payload.tier_type.upper(),
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        status=payload.status.upper(),
    )
    db.add(new_slab)
    db.commit()
    db.refresh(new_slab)
    return new_slab


@router.put("/{slab_id}", response_model=InterestSlabResponse)
def update_interest_slab(
    slab_id: str,
    payload: InterestSlabUpdate,
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    slab = db.query(InterestSlab).filter(InterestSlab.id == slab_id).first()
    if not slab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interest slab not found.")

    if payload.min_balance is not None:
        slab.min_balance = payload.min_balance
    if payload.max_balance is not None:
        slab.max_balance = payload.max_balance
    if payload.annual_rate is not None:
        slab.annual_rate = payload.annual_rate
    if payload.tier_type is not None:
        slab.tier_type = payload.tier_type.upper()
    if payload.effective_from is not None:
        slab.effective_from = payload.effective_from
    if payload.effective_to is not None:
        slab.effective_to = payload.effective_to
    if payload.status is not None:
        slab.status = payload.status.upper()

    db.commit()
    db.refresh(slab)
    return slab


@router.delete("/{slab_id}")
def delete_interest_slab(
    slab_id: str,
    current_user: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    slab = db.query(InterestSlab).filter(InterestSlab.id == slab_id).first()
    if not slab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interest slab not found.")

    db.delete(slab)
    db.commit()
    return {"message": "Interest slab deleted successfully."}
