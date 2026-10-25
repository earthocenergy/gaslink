# CNGx F2 Trip Rate-Limit Ingress and Retention Contract

## Status

This document records the I3-SEC-002 review remediation contract.

It does not authorize production migration application, deployment, routing activation or integration merge.

## Trusted production ingress

Production anonymous-network identity is derived from `x-vercel-forwarded-for`.

Vercel documents that:

- `x-forwarded-for` contains the public client IP;
- Vercel overwrites `X-Forwarded-For` when requests reach Vercel directly, specifically to prevent IP spoofing;
- `x-vercel-forwarded-for` is identical to `x-forwarded-for`;
- a proxy placed in front of Vercel can affect the ordinary `x-forwarded-for` value.

Source:

https://vercel.com/docs/headers/request-headers

Application code therefore consumes only `x-vercel-forwarded-for` for production network fingerprinting and ignores ordinary client forwarding headers.

### Deployment prerequisite

Before I3-SEC-002 production activation, Launch Ops / QA must verify that the CNGx production API is reached through the intended Vercel ingress and that no upstream proxy or alternate origin path allows an external caller to inject the effective network identity consumed by the limiter.

If trusted production network identity cannot be established, rate limiting fails closed.

## Counter retention

Quota rows store only HMAC fingerprints. Raw network addresses are not persisted.

Rejected requests continue incrementing both applicable counters. This is intentional and preserves abuse/load accounting after a quota is exceeded.

The enforcement window remains one fixed minute.

Inactive counter cleanup is separate from request enforcement:

`public.cleanup_trip_rate_limit_counters(interval)`

Rules:

- service-role execution only;
- PUBLIC, anon and authenticated execution revoked;
- minimum cleanup age: five minutes;
- default cleanup age: one day;
- maximum accepted cleanup age: thirty days;
- cleanup uses the existing `updated_at` index;
- cleanup is not performed inside the quota-check request path;
- cleanup failure cannot cause a request to be allowed.

The invocation cadence is a deployment-operations concern and does not require a paid service for F2 acceptance.

## RPC decision cardinality

The application accepts a quota decision only when Supabase returns exactly one result row with an unambiguous shape.

Allowed:
- `allowed = true`
- `retry_after_seconds = null`

Rejected:
- `allowed = false`
- integer `retry_after_seconds` from 1 through 60

Empty, multi-row, object-only, malformed or contradictory responses fail closed through the existing Trip rate-limit unavailable contract.
