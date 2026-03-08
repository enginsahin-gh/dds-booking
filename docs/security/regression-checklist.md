# Security Regression Checklist — Bellure Booking

## Pre-release
- [ ] RLS policies reviewed against access model (owners/staff/anon)
- [ ] Public views (`public_salons`, `public_bookings_cache`) expose only safe columns
- [ ] Service role usage limited to server-side routes
- [ ] KV rate limiting active for public endpoints
- [ ] Webhook signature/token verification enabled (Mollie)
- [ ] Webhook idempotency checks in place
- [ ] Logs sanitized (no PII)
- [ ] CORS allowlist updated (no wildcard)
- [ ] Auth redirect allowlist updated
- [ ] Error boundary + user-facing error copy verified

## Post-release
- [ ] Sentry events flowing (admin/widget/worker)
- [ ] No spike in 4xx/5xx (Worker)
- [ ] Booking flow E2E smoke test
- [ ] Email delivery check (Resend)
