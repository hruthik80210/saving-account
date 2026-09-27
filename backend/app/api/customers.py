"""Administrator customer and customer-account management."""
import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import Account, Profile
from backend.app.schemas.schemas import (
    AccountCreate,
    AccountResponse,
    CustomerCreateRequest,
    CustomerUpdateRequest,
    ProfileResponse,
)
from backend.app.services.auth_service import (
    create_local_token,
    get_current_user,
    hash_password,
    require_admin,
    supabase_create_user,
    supabase_delete_user,
)

router = APIRouter(prefix="/api/admin/customers", tags=["Customer Management"])


def _new_account_number(db: Session) -> str:
    while True:
        account_number = f"SB-{secrets.randbelow(90000000000) + 10000000000}"
        if not db.query(Account).filter(Account.account_number == account_number).first():
            return account_number


@router.get("", response_model=List[ProfileResponse])
def list_customers(_: Profile = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(Profile).order_by(Profile.created_at.desc()).all()


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreateRequest,
    _: Profile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    email = payload.email.strip().lower()
    if db.query(Profile).filter(Profile.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
    try:
        supabase_user = supabase_create_user(email, payload.password, payload.full_name.strip())
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))

    customer = Profile(
        id=supabase_user.get("id") or None,
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role="CUSTOMER",
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    account = Account(
        user_id=customer.id,
        account_number=_new_account_number(db),
        account_type="SAVINGS",
        currency="INR",
        status="ACTIVE",
    )
    db.add(account)
    db.commit()
    return {"user": customer, "account": account, "access_token": supabase_user.get("access_token") or create_local_token(customer)}


@router.patch("/{customer_id}", response_model=ProfileResponse)
def update_customer(
    customer_id: str,
    payload: CustomerUpdateRequest,
    current_admin: Profile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    customer = db.query(Profile).filter(Profile.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
    if customer.id == current_admin.id and payload.role and payload.role.upper() != "ADMIN":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot remove your own administrator role.")
    if payload.full_name is not None:
        customer.full_name = payload.full_name.strip()
    if payload.role is not None:
        if payload.role.upper() not in ("CUSTOMER", "ADMIN"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role must be CUSTOMER or ADMIN.")
        customer.role = payload.role.upper()
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: str,
    current_admin: Profile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    customer = db.query(Profile).filter(Profile.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
    if customer.id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own administrator account.")
    user_id = str(customer.id)
    db.delete(customer)
    db.commit()
    supabase_delete_user(user_id)
    return {"message": "Customer and linked accounts deleted successfully."}


@router.post("/{customer_id}/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_customer_account(
    customer_id: str,
    payload: AccountCreate,
    _: Profile = Depends(require_admin),
    db: Session = Depends(get_db),
):
    customer = db.query(Profile).filter(Profile.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found.")
    account_number = payload.account_number or _new_account_number(db)
    if db.query(Account).filter(Account.account_number == account_number).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account number already exists.")
    account = Account(user_id=customer.id, account_number=account_number, account_type=payload.account_type, currency=payload.currency, status=payload.status)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account