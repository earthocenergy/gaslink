# CNGx Admin MFA Enrolment and Enforcement

## Current L1B mode

Production must remain:

`ADMIN_MFA_ENFORCEMENT=enrolment`

until every active CNGx administrator has successfully enrolled and verified
a TOTP authenticator.

Do not switch production to `required` merely because the application code
supports MFA.

## Administrator enrolment procedure

For each active administrator:

1. Sign in to CNGx using the administrator account.
2. Open `/admin/security`.
3. Confirm the page shows the account at AAL1 if MFA has not yet been completed.
4. Select **Enroll authenticator** only if no verified TOTP factor is already present.
5. Scan the displayed QR code using the administrator's authenticator application.
6. Enter the current authenticator code.
7. Complete verification.
8. Confirm `/admin/security` reports `aal2`.
9. Confirm the administrator can return to `/admin`.
10. Record only that enrolment was confirmed. Do not record the TOTP secret,
    QR code, recovery material, or authenticator seed.

Supabase may invalidate the administrator's other sessions when a new MFA
factor is successfully verified. This is expected security behavior.

## Enforcement cutover

Only after every active administrator has confirmed successful TOTP enrolment:

1. Confirm every administrator can reach AAL2.
2. Confirm no administrator is awaiting enrolment.
3. Confirm the `/admin/security` recovery path works.
4. Set production:

   `ADMIN_MFA_ENFORCEMENT=required`

5. Redeploy through the normal approved deployment process.
6. Test:
   - anonymous `/admin` -> sign-in
   - normal authenticated user `/admin` -> dashboard
   - admin AAL1 `/admin` -> `/admin/security`
   - admin AAL2 `/admin` -> allowed
   - Supabase/AAL lookup failure -> fail closed

## Rollback

If MFA enforcement causes an access incident before launch:

1. Set `ADMIN_MFA_ENFORCEMENT=enrolment`.
2. Redeploy using the approved deployment path.
3. Investigate the affected administrator's factor state.
4. Do not disable server-side admin role checks.
5. Do not bypass MFA by promoting another account without the normal admin
   authorization process.

## L1B rule

MFA code and enrolment procedure may be completed during L1B.

Production must remain in `enrolment` mode until human administrator enrolment
has been confirmed. Required-mode cutover is a deliberate operational action,
not an automatic code change.
