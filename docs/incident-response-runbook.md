# CNGx incident-response runbook

## Severity

- **SEV-1 security/data exposure:** suspected unauthorized access, credential compromise, PII exposure, or destructive database activity.
- **SEV-1 total outage:** production unavailable or core station discovery/authentication broadly unusable.
- **SEV-2 major feature failure:** a major workflow is broken but the platform remains substantially available.

## First-response sequence

For every incident: assign an incident lead, timestamp detection, freeze risky releases, preserve logs/evidence, determine blast radius, and choose containment before remediation. Do not delete logs or rewrite history during response.

| Scenario | Immediate containment | Recovery path |
|---|---|---|
| Security/data exposure | Revoke/rotate affected credentials, restrict affected surface, preserve auth/database/Vercel logs | Patch cause, verify access controls, restore only if integrity is affected |
| Total outage | Freeze releases, inspect Vercel/Supabase health and last deployment | Roll back web release when schema-compatible; otherwise forward-fix |
| Major feature failure | Disable or isolate failing workflow where possible | Known-good deployment or forward repair |
| Database degradation | Stop nonessential writes, inspect locks/errors/performance | Index/query repair; restore only through approved non-destructive procedure |
| Notification flood/failure | Disable delivery credentials/jobs without deleting queue evidence | Correct configuration, drain safely, verify suppression/deduplication |
| Bad production release | Freeze main and production promotion | Follow `docs/launch-rollback-runbook.md` |
| Incorrect station publication | Stop further publication actions; preserve audit trail | Use authorized publication rollback workflow; never direct-edit audit history |
| Third-party routing outage | Disable affected routing calls/fallback UI | Restore provider integration or switch approved provider configuration |

## Communications

SEV-1: maintain a written timeline and provide factual status updates to internal stakeholders at meaningful state changes (identified, contained, recovering, resolved). External communication is approved by the designated business/security owner and must avoid speculation. SEV-2: notify affected product/operations owners and record remediation status.

## Evidence preservation

Retain deployment IDs, commit SHAs, migration head, audit rows, relevant sanitized logs, configuration changes, incident timestamps, and operator actions. Do not place tokens, passwords, private keys, raw auth-user exports, or unnecessary PII in tickets or repository files.

## Closure

After service restoration, document root cause, impact window, detection gap, containment, corrective actions, ownership and due dates. Re-open the launch gate when an incident exposes a failed foundation control.
