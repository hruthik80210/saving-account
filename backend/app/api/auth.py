"""
Authentication API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas.schemas import ProfileResponse, RegisterRequest, LoginRequest
from backend.app.services.auth_service import (
    get_current_user, get_or_create_demo_user, DEMO_USER_ID,
    hash_password, verify_password, create_local_token,
)
from backend.app.models.models import Profile

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
    if db.query(Profile).filter(Profile.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")
    user = Profile(full_name=payload.full_name.strip(), email=email, password_hash=hash_password(payload.password), role="CUSTOMER")
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_local_token(user), "token_type": "bearer", "user": {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}}


@router.post("/login", response_model=dict)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Profile).filter(Profile.email == payload.email.strip().lower()).first()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    return {"access_token": create_local_token(user), "token_type": "bearer", "user": {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}}


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully."}
