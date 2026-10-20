# CNGx launch environment contract

Secret values are never committed. Public variables may contain only identifiers/keys explicitly intended for client exposure. `SUPABASE_SERVICE_ROLE_KEY`, signing credentials, routing secret keys, push credentials and monitoring write secrets are server-only.

| Environment | Supabase target | Public variables | Server-only | Routing / push / monitoring | Data classification |
|---|---|---|---|---|---|
| development | local or isolated non-production | non-prod URL + publishable key | dev-only secrets | sandbox/test only; push disabled by default | synthetic/dev |
| preview | isolated staging target | staging URL + publishable key | preview secrets | sandbox routing; push sink/disabled | synthetic/test |
| staging | dedicated Supabase branch/project; never production | staging URL + publishable key | staging service credentials; `ADMIN_MFA_ENFORCEMENT` | non-production routing keys; push sink; staging monitoring | synthetic/load-test data; no prod PII |
| production | `knhrgugextsmisyxzdgc` | production URL + publishable key | production-only secrets; `ADMIN_MFA_ENFORCEMENT` | production routing keys; production push keys when authorized; production monitoring | production customer/operational data |
| mobile development | dev/non-prod Supabase | mobile-safe public configuration only | none embedded in binary | sandbox routing; development push credentials | synthetic/dev |
| mobile preview | staging Supabase | staging public configuration | no server secrets in app | staging routing; preview APNs/FCM/EAS credentials held by build service | synthetic/test |
| mobile production | production Supabase | production public configuration | no server secrets in app | production routing + APNs/FCM/EAS credentials held by secure provider | production user data |

## Admin MFA rollout

`ADMIN_MFA_ENFORCEMENT=enrolment` is the safe initial production value. After every administrator has successfully enrolled and verified TOTP, set `ADMIN_MFA_ENFORCEMENT=required`. The value is server-only and must not use a `NEXT_PUBLIC_` prefix.

## Notification isolation

Preview/staging must not possess production push credentials or production recipient lists. Future notification workers require an explicit environment identifier and delivery allow-list/sink in non-production.

## Routing keys

Use distinct provider projects/keys where the routing vendor supports them. A browser-exposed routing token must be origin/domain restricted. Server routing credentials must remain server-only.

## Promotion rule

No preview/staging configuration may point to the production Supabase project. Production promotion requires CI green, migration compatibility review, configuration checklist review and explicit release approval.
