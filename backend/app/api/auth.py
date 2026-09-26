"""
Authentication API endpoints.
"""
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas.schemas import ProfileResponse, RegisterRequest, LoginRequest
from backend.app.services.auth_service import (
    get_current_user, get_or_create_demo_user, DEMO_USER_ID,
    hash_password, verify_password, create_local_token,
    supabase_password_login, supabase_create_user,
)
from backend.app.models.models import Account, Profile

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(current_user: Profile = Depends(get_current_user)):
    return current_user


@router.post("/demo-login", response_model=dict)
def demo_login(db: Session = Depends(get_db)):
    """
    Returns demo user session token for instant testing without requiring Supabase cloud login.
    """
    user = get_or_create_demo_user(db)
    return {
        "access_token": "demo-token",
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        }
    }


@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    full_name = payload.full_name.strip()
    try:
        supabase_user = supabase_create_user(email, payload.password, full_name)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))

    existing_profile = db.query(Profile).filter(Profile.email == email).first()
    if existing_profile:
        if not supabase_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
        # Supabase Auth accepted the new user, so this is an orphaned profile
        # left behind by an earlier Auth deletion. Remove its dependent data.
        db.delete(existing_profile)
        db.commit()

    user = Profile(
        id=supabase_user.get("id") or None,
        full_name=full_name,
        email=email,
        password_hash=hash_password(payload.password),
        role="CUSTOMER",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    account_number = None
    while not account_number or db.query(Account).filter(Account.account_number == account_number).first():
        account_number = f"SB-{secrets.randbelow(90000000000) + 10000000000}"
    account = Account(user_id=user.id, account_number=account_number, account_type="SAVINGS", currency="INR", status="ACTIVE")
    db.add(account)
    db.commit()

    access_token = supabase_user.get("access_token") or create_local_token(user)
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}, "account": {"id": account.id, "account_number": account.account_number}}


@router.post("/login", response_model=dict)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(Profile).filter(Profile.email == email).first()

    supabase_session = supabase_password_login(email, payload.password)
    if supabase_session:
        auth_user = supabase_session.get("user") or {}
        user_id = auth_user.get("id")
        if not user and user_id:
            metadata = auth_user.get("user_metadata") or {}
            user = Profile(
                id=user_id,
                full_name=metadata.get("full_name", email.split("@")[0]),
                email=email,
                role="CUSTOMER",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        if user:
            return {"access_token": supabase_session["access_token"], "token_type": "bearer", "user": {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}}

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    return {"access_token": create_local_token(user), "token_type": "bearer", "user": {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}}


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully."}
