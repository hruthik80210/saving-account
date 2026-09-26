"""
Authentication API endpoints.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas.schemas import ProfileResponse
from backend.app.services.auth_service import get_current_user, get_or_create_demo_user, DEMO_USER_ID
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
        }
    }
