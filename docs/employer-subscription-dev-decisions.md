# Employer subscription — DEV decision log (interim)

Source: Employer Persona & Subscription Monetization guide. **DEV only** — prod unchanged until promotion.

## Assumed for DEV implementation (open decisions still ownable by Product/Finance)

| ID | Interim rule on DEV |
|----|---------------------|
| OD-01 | Display catalogue prices as listed (DEV test ₹1; restore ₹999 / ₹2,999 / ₹5,999 before prod); tax wording deferred |
| OD-04 | Early renewal starts a new period from payment time (no proration) |
| OD-05 | No unused-value proration on upgrade |
| OD-06 | One candidate DB view charge per employer–candidate pair **per subscription period** |
| OD-07 | Company owner **counts** toward recruiter seat limit |
| OD-08 | After expiry: retain jobs/applications; block publish/reactivate; billing history readable |
| OD-11 | Starter: own-job applicant management yes; **database** shortlist no |
| BR-02 | Unused candidate views do **not** roll over |
| BR-03 | Own-job applicant profile opens do **not** consume DB views |

## Already shipped on DEV

- Razorpay order + verify + UPI sync + webhook activate `EmployerSubscription`
- Pricing / buy UI + post-job client gate + verification gate before checkout
- Deploy DEV green for subscription commits
- Catalogue + public plans API; job/view metering from active subscription
- Verification gate before checkout; Razorpay webhook event ledger (idempotency)
- Employer Billing portal + welcome landing plans strip (additive)
- Recruiter seat enforcement on KYC join (company-scoped; OD-07 owner counts)
- OD-11 talent-pool shortlist entitlement; expired vs never-paid gate messages
- Advanced filters + job-performance report feature gates
- Guide §15.2 subscription error codes
- Admin revenue: gateway flag + subscription plan source bucket; views include `sub:*` periods
- Admin grant / extend / suspend subscription + drawer UI
- Enterprise offer table + admin create + employer online checkout by offerId
- Billing renew banner + in-app expiry/expiring + payment-success + enterprise-offer notifications
- Purchase entitlement snapshot (`entitlements_json`) for Enterprise/custom limits

## Still deferred / product-owned (not blocking DEV vertical slice)

1. Admin-editable plan catalogue CRUD in DB (catalogue remains shared package until Finance freezes OD-01)
2. Full Razorpay reconciliation UI vs gateway exports
3. Optional usage-event ledger beyond candidate views
4. Restore catalogue paise to ₹999 / ₹2,999 / ₹5,999 when exiting DEV ₹1 test mode
5. Razorpay Dashboard website allowlist for `https://www.srsbcareerbridge.co.in` (ops — required for live UPI)
6. Open decisions OD-01 tax, OD-02 invoices, OD-03 refunds, OD-09/10 Enterprise governance wording
