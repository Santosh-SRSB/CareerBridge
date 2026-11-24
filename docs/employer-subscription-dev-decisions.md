# Employer subscription — DEV decision log (interim)

Source: Employer Persona & Subscription Monetization guide. **DEV only** — prod unchanged until promotion.

## Assumed for DEV implementation (open decisions still ownable by Product/Finance)

| ID | Interim rule on DEV |
|----|---------------------|
| OD-01 | Display catalogue prices as listed (₹999 / ₹2,999 / ₹5,999); tax wording deferred |
| OD-04 | Early renewal starts a new period from payment time (no proration) |
| OD-05 | No unused-value proration on upgrade |
| OD-06 | One candidate DB view charge per employer–candidate pair **per subscription period** |
| OD-07 | Company owner **counts** toward recruiter seat limit |
| OD-08 | After expiry: retain jobs/applications; block publish/reactivate; billing history readable |
| OD-11 | Starter: own-job applicant management yes; **database** shortlist no |
| BR-02 | Unused candidate views do **not** roll over |
| BR-03 | Own-job applicant profile opens do **not** consume DB views |

## Already shipped on DEV (partial)

- Razorpay order + verify + UPI sync + webhook activate `EmployerSubscription`
- Pricing / buy UI + post-job client gate
- Deploy DEV green for subscription commits

## Still building (todo order)

1. Catalogue prices + feature entitlements + public plans API
2. Usage periods / wire limits from active subscription
3. Verification gate + webhook event idempotency
4. Enforce jobs / seats / views
5. Employer portal usage UI
6. Welcome plans section
7. Enterprise offer + admin basics
