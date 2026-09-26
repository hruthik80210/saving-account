"""
CSV Import Service.
Validates uploaded transaction CSV files, detects formatting and financial balance errors,
and safely imports validated rows after user confirmation.
"""
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import List
import csv
import io
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.app.schemas.schemas import CSVRowData, CSVValidateResponse, VALID_TRANSACTION_TYPES
from backend.app.models.models import Transaction, Account
from backend.app.interest_engine.models import TransactionRecord, TransactionType as EngineTxType
from backend.app.services.transaction_service import TransactionService, to_engine_record


def parse_date_flexible(val: str) -> date:
    """Attempts to parse common bank date formats."""
    val = val.strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d-%b-%Y", "%d %b %Y"):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Invalid date format '{val}'. Expected YYYY-MM-DD or DD-MM-YYYY.")


class CSVImportService:

    @classmethod
    def validate_csv(cls, content: str, account_id: str, db: Session) -> CSVValidateResponse:
        """
        Parses CSV, checks each row for valid columns, data types, and simulates balance impact.
        Expected headers: transaction_date, value_date, type, amount, description, reference
        """
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty or corrupted.")

        # Normalize header keys
        header_map = {name.strip().lower().replace(" ", "_"): name for name in reader.fieldnames}
        
        req_fields = ["transaction_date", "value_date", "type", "amount"]
        missing = [f for f in req_fields if f not in header_map]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required CSV column(s): {', '.join(missing)}. Expected: transaction_date, value_date, type, amount, description, reference."
            )

        rows: List[CSVRowData] = []
        valid_candidates: List[TransactionRecord] = []
        row_num = 1

        for row in reader:
            row_num += 1
            errors = []

            raw_tx_date = row.get(header_map.get("transaction_date", ""), "").strip()
            raw_val_date = row.get(header_map.get("value_date", ""), "").strip()
            raw_type = row.get(header_map.get("type", ""), "").strip().upper()
            raw_amount = row.get(header_map.get("amount", ""), "").strip().replace(",", "")
            raw_desc = row.get(header_map.get("description", ""), "").strip()
            raw_ref = row.get(header_map.get("reference", ""), "").strip()

            parsed_tx_date = None
            try:
                parsed_tx_date = parse_date_flexible(raw_tx_date)
            except Exception as e:
                errors.append(str(e))

            parsed_val_date = None
            try:
                parsed_val_date = parse_date_flexible(raw_val_date)
            except Exception as e:
                errors.append(str(e))

            if raw_type not in VALID_TRANSACTION_TYPES:
                errors.append(f"Invalid type '{raw_type}'. Allowed: {', '.join(VALID_TRANSACTION_TYPES)}.")

            parsed_amount = None
            try:
                amt = Decimal(raw_amount)
                if amt <= Decimal("0.00"):
                    errors.append("Amount must be positive.")
                else:
                    parsed_amount = amt
            except (InvalidOperation, ValueError):
                errors.append(f"Invalid amount '{raw_amount}'. Must be a valid positive number.")

            is_valid = len(errors) == 0
            if is_valid and parsed_tx_date and parsed_val_date and parsed_amount:
                valid_candidates.append(TransactionRecord(
                    id=f"csv-row-{row_num}",
                    transaction_date=parsed_tx_date,
                    value_date=parsed_val_date,
                    transaction_type=EngineTxType(raw_type),
                    amount=parsed_amount,
                    description=raw_desc,
                    reference=raw_ref,
                ))

            rows.append(CSVRowData(
                row_number=row_num,
                transaction_date=raw_tx_date,
                value_date=raw_val_date,
                type=raw_type,
                amount=raw_amount,
                description=raw_desc,
                reference=raw_ref,
                is_valid=is_valid,
                errors=errors
            ))

        # Check whole account historical simulation with all valid candidate rows
        if valid_candidates:
            existing_txs = db.query(Transaction).filter(Transaction.account_id == account_id).all()
            all_records = [to_engine_record(t) for t in existing_txs] + valid_candidates
            try:
                from backend.app.interest_engine.engine import validate_historical_balances
                validate_historical_balances(all_records, allow_negative=False)
            except Exception as e:
                # Mark candidates that contributed to negative balance
                for r in rows:
                    if r.is_valid:
                        r.is_valid = False
                        r.errors.append(f"Balance check error: {str(e)}")

        valid_count = sum(1 for r in rows if r.is_valid)
        invalid_count = len(rows) - valid_count

        return CSVValidateResponse(
            total_rows=len(rows),
            valid_rows_count=valid_count,
            invalid_rows_count=invalid_count,
            rows=rows
        )

    @classmethod
    def confirm_import(cls, db: Session, account_id: str, valid_rows: List[CSVRowData]) -> int:
        """
        Commits valid rows to the database.
        """
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

        imported_count = 0
        for r in valid_rows:
            if not r.is_valid:
                continue

            tx_date = parse_date_flexible(r.transaction_date)
            val_date = parse_date_flexible(r.value_date)
            amt = Decimal(r.amount.replace(",", ""))

            new_tx = Transaction(
                account_id=account_id,
                transaction_date=tx_date,
                value_date=val_date,
                transaction_type=r.type.upper(),
                amount=amt,
                description=r.description,
                reference=r.reference,
            )
            db.add(new_tx)
            imported_count += 1

        db.commit()
        return imported_count
