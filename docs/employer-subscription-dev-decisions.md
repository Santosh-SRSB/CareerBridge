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
- Catalogue + public plans API; job/view metering from active subscription
- Verification gate before checkout; Razorpay webhook event ledger (idempotency)
- Employer Billing portal + welcome landing plans strip (additive)
- Recruiter seat enforcement on KYC join (company-scoped; OD-07 owner counts)

## Still building (todo order)

1. Entitlement flags (e.g. Starter DB shortlist) + expired vs never-paid messages
2. Enterprise offer + Super Admin grant/revenue basics
3. Expiry / low-usage notifications
4. Admin metering alignment to `sub:*` periods
