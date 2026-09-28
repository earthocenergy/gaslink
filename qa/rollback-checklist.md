# RC rollback verification
- Identify last-known-good Vercel deployment.
- Confirm release SHA/version/environment telemetry.
- Verify N-1 application compatibility with current DB schema.
- Rehearse web rollback in non-production.
- Require backward-compatible expand/contract migrations.
- Confirm notification kill switch/containment before bulk push.
- Consume L1C evidence for backup/PITR and restore rehearsal; do not duplicate it.
- Record rollback owner, timestamp, deployment and validation result.
