# How It Works

This document explains the banking logic behind the calculator: how daily balances are
derived, how interest accrues, how quarters are posted, and how the trickier edge cases are
handled.

---

## 1. Why Daily Closing Balance (DCB)?

Savings interest is **not** paid on the minimum or average balance you happen to report. It
accrues on the **closing balance of every single calendar day**. Money that sits for one day
earns that day's interest; money credited and withdrawn the same effective day does not.

---

## 2. Deriving the Daily Closing Balance

For every calendar date `t` in the requested period:

```text
Opening Balanceₜ = Closing Balanceₜ₋₁
Closing Balanceₜ = Opening Balanceₜ + Σ Creditsₜ − Σ Debitsₜ
```

- **Credits:** `OPENING_BALANCE`, `DEPOSIT`, `INTEREST_CREDIT`, positive `ADJUSTMENT`.
- **Debits:** `WITHDRAWAL`, negative `ADJUSTMENT`.
- A transaction takes effect on its **Value Date**, not its booking date.

When a transaction is backdated (`value_date < transaction_date`), every daily balance from the
value date onward is recomputed. Nothing is stored as a "current balance" — balances are always
derived from the ledger, so history is fully reproducible.

---

## 3. Daily Interest

For each day `t`:

```text
Daily Interestₜ = (Closing Balanceₜ × Applicable Annual Rateₜ) / Day-Count Denominator
```

### Day-count conventions

| Convention | Denominator | When it applies |
| :--- | :--- | :--- |
| `ACTUAL_365` (default) | 365 | All days. |
| `ACTUAL_366` | 366 | All days. |
| `ACTUAL_ACTUAL` | 366 in leap years, else 365 | Leap-year aware. |

### Applicable rate resolution

Rates come from **interest slabs**. A slab is eligible for day `t` when
`effective_from <= t <= effective_to` (or `effective_to IS NULL`) and `status = ACTIVE`.
This is why historical runs stay identical even after an administrator announces a new rate:
the old slab simply no longer matches the newer dates.

---

## 4. Tiered (Marginal) vs Flat Slabs

- **FLAT** — the whole closing balance earns the slab's single rate.
- **TIERED** — the balance is partitioned across brackets and each part earns its own rate:

```text
Daily Interestₜ = Σₖ (Balance in Tier k × Rateₖ) / Denominator
```

Example with ₹2,50,000 closing balance:

| Bracket | Amount | Rate | Contribution basis |
| :--- | ---: | ---: | :--- |
| ₹0 – ₹1,00,000 | ₹1,00,000 | 3.00% | ₹1,00,000 × 3.00% |
| ₹1,00,001 – ₹5,00,000 | ₹1,50,000 | 3.50% | ₹1,50,000 × 3.50% |
| Above ₹5,00,000 | ₹0 | 4.00% | — |

---

## 5. Aggregation & Rounding

```text
Quarterly Interest = Round( Σ Daily Interestₜ )     → nearest paise, ROUND_HALF_UP
```

All arithmetic uses Python's `decimal.Decimal`; the final posting is quantized to `0.01` with
`ROUND_HALF_UP`. No `float` ever touches a money value, so there is no binary representation
error (the reason `0.1 + 0.2 ≠ 0.3` in naive float code).

---

## 6. Worked Example — Requirement 21 (July 2026)

- Opening balance **₹50,000** on 01-Jul-2026
- 05-Jul: deposit **₹10,000** → closing ₹60,000
- 12-Jul: withdrawal **₹5,000** → closing ₹55,000
- 20-Jul: deposit **₹20,000** → closing ₹75,000
- Annual rate **3.00%**, period 01-Jul to 31-Jul (31 days), Actual/365

| Date range | Days | Closing balance | Daily interest (₹50,000 × 3% / 365 etc.) | Period interest |
| :--- | :---: | :---: | :---: | :---: |
| 01-Jul → 04-Jul | 4 | ₹50,000 | 4.109589 | ₹16.438356 |
| 05-Jul → 11-Jul | 7 | ₹60,000 | 4.931507 | ₹34.520548 |
| 12-Jul → 19-Jul | 8 | ₹55,000 | 4.520548 | ₹36.164384 |
| 20-Jul → 31-Jul | 12 | ₹75,000 | 6.164384 | ₹73.972603 |
| **July total** | **31** | **₹75,000** | | **₹161.09589… → ₹161.10** |

Automated test: `backend/tests/test_interest_engine.py::test_sample_calculation_requirement_21`.

---

## 7. Quarterly Posting Lifecycle

1. **Preview** — compute interest for the quarter (no writes).
2. **Post** — on confirmation:
   - reject if the quarter was already posted (database `UNIQUE(account_id, year, quarter)`),
   - persist an `interest_calculations` row and its per-day breakdown,
   - create an `INTEREST_CREDIT` transaction on the quarter's last day,
   - record an `interest_postings` row.
3. The frontend refreshes postings and the account summary; the credit now participates in
   future daily balances like any other transaction.

---

## 8. Same-Day Ordering

When several transactions share a value date they are applied deterministically:

```text
OPENING_BALANCE → DEPOSIT → INTEREST_CREDIT → WITHDRAWAL
```

so that credits settle before debits on the same day.

---

## 9. CSV Import Flow

1. **Validate** — the uploaded file is parsed (multiple date formats accepted); each row is
   checked for a valid type, positive amount and parseable dates. Balances are *simulated*
   (including any overdraft that a withdrawal would cause) and per-row errors are returned.
2. **Confirm** — only rows marked valid are committed; invalid rows are skipped and reported.

No partial/unsafe state is written during validation.

---

## 10. Edge Cases Handled

| Case | Behaviour |
| :--- | :--- |
| Backdated / value-dated entries | Balances and interest recomputed from the value date. |
| Withdrawal that would overdraw | Rejected with HTTP 400 before any write. |
| Multiple transactions, one day | Applied in the fixed same-day order above. |
| Duplicate quarter posting | Blocked by a unique constraint → HTTP 409. |
| Leap year (29 Feb) | Fully supported; `ACTUAL_ACTUAL` switches to a 366 denominator. |
| Rate change mid-quarter | Each day uses the slab effective on that day. |
| Zero balance | Accrues zero interest, no errors. |
| Quarter boundaries | Correct 90/91/92-day ranges per calendar quarter. |
| Static/demo data | Can be purged at runtime; see [Deployment](DEPLOYMENT.md). |
