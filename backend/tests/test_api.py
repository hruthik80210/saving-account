"""
Integration and End-to-End API tests for Savings Account Interest Calculator.
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from backend.app.main import app, init_db_and_seed
from backend.app.database import engine, Base

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    # Recreate tables and seed before tests
    Base.metadata.drop_all(bind=engine)
    init_db_and_seed()
    yield


def test_health_check():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_auth_demo_login():
    res = client.post("/api/auth/demo-login")
    assert res.status_code == 200
    data = res.json()
    assert data["access_token"] == "demo-token"
    assert data["user"]["email"] == "demo.user@antigravitybank.com"


def test_accounts_endpoints():
    res = client.get("/api/accounts", headers={"Authorization": "Bearer demo-token"})
    assert res.status_code == 200
    accounts = res.json()
    assert len(accounts) >= 1
    acc_id = accounts[0]["id"]

    # Check summary
    res_sum = client.get(f"/api/accounts/{acc_id}/summary", headers={"Authorization": "Bearer demo-token"})
    assert res_sum.status_code == 200
    sum_data = res_sum.json()
    assert float(sum_data["current_balance"]) >= 0


def test_sample_july_2026_calculation_api():
    """
    Checks that calling /api/interest/calculate for July 2026 returns ₹161.10
    as calculated by the Python engine.
    """
    res_acc = client.get("/api/accounts", headers={"Authorization": "Bearer demo-token"})
    acc_id = res_acc.json()[0]["id"]

    calc_payload = {
        "account_id": acc_id,
        "start_date": "2026-07-01",
        "end_date": "2026-07-31",
        "day_count_convention": "ACTUAL_365",
        "rounding_mode": "HALF_UP"
    }
    res = client.post("/api/interest/calculate", json=calc_payload, headers={"Authorization": "Bearer demo-token"})
    assert res.status_code == 200
    data = res.json()
    assert data["total_days"] == 31
    assert float(data["closing_balance"]) == 75000.0
    assert float(data["total_interest_earned"]) == 161.10
    assert len(data["daily_breakdown"]) == 31


def test_invalid_negative_withdrawal_rejected_by_api():
    res_acc = client.get("/api/accounts", headers={"Authorization": "Bearer demo-token"})
    acc_id = res_acc.json()[0]["id"]

    # Attempt to withdraw 10,000,000 (exceeding balance)
    tx_payload = {
        "account_id": acc_id,
        "transaction_date": "2026-07-25",
        "value_date": "2026-07-25",
        "transaction_type": "WITHDRAWAL",
        "amount": 10000000.00,
        "description": "Excessive withdrawal"
    }
    res = client.post("/api/transactions", json=tx_payload, headers={"Authorization": "Bearer demo-token"})
    assert res.status_code == 400
    assert "causes negative balance" in res.json()["detail"] or "Insufficient funds" in res.json()["detail"]


def test_quarterly_posting_and_duplicate_prevention():
    res_acc = client.get("/api/accounts", headers={"Authorization": "Bearer demo-token"})
    acc_id = res_acc.json()[0]["id"]

    post_payload = {
        "account_id": acc_id,
        "year": 2026,
        "quarter": "Q3",
        "day_count_convention": "ACTUAL_365"
    }

    # 1. First posting should succeed
    res1 = client.post("/api/interest/post", json=post_payload, headers={"Authorization": "Bearer demo-token"})
    assert res1.status_code == 201
    post_data = res1.json()
    assert post_data["period_quarter"] == "Q3"
    assert post_data["period_year"] == 2026
    assert float(post_data["interest_amount"]) > 0

    # 2. Second posting attempt for SAME quarter must return 409 Conflict (Duplicate prevention)
    res2 = client.post("/api/interest/post", json=post_payload, headers={"Authorization": "Bearer demo-token"})
    assert res2.status_code == 409
    assert "already been posted" in res2.json()["detail"]


def test_statement_generation():
    res_acc = client.get("/api/accounts", headers={"Authorization": "Bearer demo-token"})
    acc_id = res_acc.json()[0]["id"]

    res = client.get(f"/api/accounts/{acc_id}/statement", headers={"Authorization": "Bearer demo-token"})
    assert res.status_code == 200
    st_data = res.json()
    assert len(st_data["entries"]) >= 4
    assert st_data["entries"][0]["transaction_type"] == "OPENING_BALANCE"
