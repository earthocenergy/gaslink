# CNGx shared rate / abuse foundation

## Protected write classes

The shared layer must cover station reports, station claims, station registration, marketplace listings, marketplace enquiries, provider onboarding, service enquiries, business enquiries, and auth-sensitive flows.

## Reusable decision model

Each protected write is evaluated server-side before the business write. The limiter receives: `action`, authenticated `user_id` when present, privacy-preserving network/device keys when available, a normalized duplicate fingerprint, and the current time. The client never decides whether a write is permitted.

Controls are composable rather than feature-specific:

1. **Per-user window** for authenticated callers.
2. **Per-network/device window** for anonymous or abuse-prone flows. Store only a keyed/HMAC-derived identifier, not raw IP, when persistence is required.
3. **Burst bucket** to reject rapid repeated writes.
4. **Duplicate suppression** using an action-specific normalized fingerprint and time window.
5. **Audit event** for allow/reject decisions with reason code and expiry, avoiding unnecessary PII.
6. **Clear response contract**: stable reason (`rate_limited`, `duplicate`, `temporarily_blocked`) and retry-after seconds where appropriate.

## Enforcement placement

Important writes must be routed through a server action/route handler or database RPC that invokes the shared limiter in the same trusted path as the write. RLS remains authoritative for authorization. A browser-only timer or disabled button is never enforcement.

## Initial policy proposal

Exact thresholds require staging/load evidence. Start conservatively in staging and tune per action rather than invent production numbers. Registration/onboarding and enquiry flows should have longer duplicate windows than transient station-condition reports. Auth provider-native rate limits remain additive, not a substitute for application abuse controls.

## CAPTCHA

Do not add CAPTCHA by default. Introduce it only when observed automated abuse persists after server-side limits, duplicate suppression and provider-native auth protections.

## L1 implementation status

Architecture is established and source-controlled. Enforcement is **not yet integrated into the existing write paths** because there is no isolated staging environment in which to validate thresholds and false-positive behavior. Production launch therefore still has a rate-limit enforcement blocker.
