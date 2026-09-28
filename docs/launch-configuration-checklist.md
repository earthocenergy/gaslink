# CNGx launch configuration checklist

Status values are evidence-based; pending items are intentionally not invented.

- [ ] GitHub `main` protection/ruleset active: PR required, force-push/deletion blocked, Launch CI required, Vercel check required when available, human approval enabled if plan supports it.
- [ ] GitHub merge policy: merge commits enabled; squash/rebase disabled for the launch programme.
- [ ] Vercel production project access verified from the release operator account.
- [ ] Vercel production environment variables match `docs/environment-contract.md`.
- [ ] Supabase managed backup capability enabled and verified for production.
- [ ] Supabase PITR decision approved and, if selected, enabled/verified.
- [ ] Non-production restore rehearsal completed.
- [ ] Supabase leaked-password protection enabled and re-checked by Security Advisor.
- [ ] Every production administrator enrolled TOTP MFA.
- [ ] `ADMIN_MFA_ENFORCEMENT=required` enabled only after successful enrolment verification.
- [ ] Production domain selected and HTTPS verified.
- [ ] Privacy-policy URL published.
- [ ] Terms URL published.
- [ ] Support URL/email confirmed.
- [ ] Monitoring/error vendor selected and production alerts tested.
- [ ] Routing provider and production key strategy confirmed.
- [ ] Apple Developer account/configuration ready before iOS work begins.
- [ ] Google Play developer account/configuration ready before Android release work begins.
- [ ] Expo/EAS production project and access model ready before mobile builds.
- [ ] APNs credentials provisioned only when notifications are authorized.
- [ ] FCM credentials provisioned only when notifications are authorized.
- [ ] Staging push delivery isolated from production recipients.
- [ ] Release smoke-test owner and incident owner identified.
