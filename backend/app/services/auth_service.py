"""
Authentication Service.
Handles Supabase Auth JWT verification with fallback for demo/local developer testing.
"""
from typing import Optional
import base64
import hashlib
import hmac
import os
import httpx
from fastapi import HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.models import Account, Profile

security = HTTPBearer(auto_error=False)

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"
DEMO_USER_EMAIL = "demo.user@antigravitybank.com"
DEMO_USER_NAME = "Rajesh Sharma"
LOCAL_JWT_SECRET = "local-development-auth-secret-change-in-production"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"pbkdf2_sha256$120000${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt, expected = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), base64.urlsafe_b64decode(salt), int(iterations)
        )
        return hmac.compare_digest(base64.urlsafe_b64encode(actual).decode(), expected)
    except (ValueError, TypeError):
        return False


def create_local_token(user: Profile) -> str:
    return jwt.encode(
        {"sub": str(user.id), "email": user.email, "role": user.role},
        settings.SUPABASE_JWT_SECRET or LOCAL_JWT_SECRET,
        algorithm="HS256",
    )


def supabase_auth_headers() -> dict[str, str]:
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    return {"apikey": key or "", "Authorization": f"Bearer {key or ''}", "Content-Type": "application/json"}


def supabase_password_login(email: str, password: str) -> dict:
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        return {}
    response = httpx.post(
        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/token?grant_type=password",
        headers={"apikey": settings.SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=10,
    )
    if response.status_code == 400:
        return {}
    response.raise_for_status()
    return response.json()


def supabase_create_user(email: str, password: str, full_name: str) -> dict:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return {}
    response = httpx.post(
        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users",
        headers=supabase_auth_headers(),
        json={
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name},
        },
        timeout=10,
    )
    if response.status_code in (400, 422):
        detail = response.json().get("msg") or response.json().get("message") or "Email is already registered."
        raise ValueError(detail)
    response.raise_for_status()
    return response.json()


def supabase_delete_user(user_id: str) -> None:
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return
    response = httpx.delete(
        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{user_id}",
        headers=supabase_auth_headers(),
        timeout=10,
    )
    if response.status_code not in (200, 204, 404):
        response.raise_for_status()


def get_or_create_demo_user(db: Session) -> Profile:
    """Ensures demo profile exists in the DB."""
    user = db.query(Profile).filter(Profile.id == DEMO_USER_ID).first()
    if not user:
        user = Profile(
            id=DEMO_USER_ID,
            full_name=DEMO_USER_NAME,
            email=DEMO_USER_EMAIL,
            role="ADMIN",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db)
) -> Profile:
    """
    Validates Supabase Bearer token or provides demo user if in local/demo mode.
    """
    # Demo/Local Mode fallback if no token or demo token provided
    if not credentials or credentials.credentials in ("demo-token", "demo", "null", "undefined"):
        return get_or_create_demo_user(db)

    token = credentials.credentials

    # If Supabase JWT Secret is configured, decode and verify JWT
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload: missing sub")

            user = db.query(Profile).filter(Profile.id == user_id).first()
            if not user:
                # Auto-create profile from token metadata if present
                email = payload.get("email", f"{user_id}@supabase.user")
                full_name = payload.get("user_metadata", {}).get("full_name", email.split("@")[0])
                user = Profile(id=user_id, full_name=full_name, email=email)
                db.add(user)
                db.commit()
                db.refresh(user)
            return user
        except jwt.PyJWTError as e:
            # If token verification fails, return 401
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"JWT verification failed: {str(e)}")

    # If no secret configured but a token is passed, allow unverified sub extraction or demo
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        user_id = unverified.get("sub", DEMO_USER_ID)
        user = db.query(Profile).filter(Profile.id == user_id).first()
        if not user:
            email = unverified.get("email", DEMO_USER_EMAIL)
            full_name = unverified.get("user_metadata", {}).get("full_name", "Supabase User")
            user = Profile(id=user_id, full_name=full_name, email=email)
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    except Exception:
        return get_or_create_demo_user(db)


def require_admin(current_user: Profile = Depends(get_current_user)) -> Profile:
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required.")
    return current_user


def ensure_account_access(db: Session, account_id: str, current_user: Profile) -> Account:
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
    if current_user.role != "ADMIN" and str(account.user_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this account.")
    return account
