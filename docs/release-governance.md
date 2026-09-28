# CNGx release governance

## Verified pre-state

At L1 start, `main` was unprotected, repository rulesets were empty, and no status checks were required. The connected GitHub integration can write repository content but does not expose branch-protection/ruleset mutation, so protection is a human GitHub settings gate.

## Required `main` policy

In **GitHub → earthocenergy/gaslink → Settings → Rules → Rulesets**, create a branch ruleset named `main-release-governance`, set enforcement to **Active**, and target the default branch / `main`.

Enable:

- restrict deletions for `main`;
- block force pushes;
- require a pull request before merging;
- require at least one human approval when the account/repository plan supports it;
- dismiss or re-require approval after material new commits where supported;
- require conversation resolution;
- require status checks to pass before merge;
- once observed on a PR, require `Launch CI / foundation` and the production/preview Vercel Git check that belongs to this project;
- require the branch to be current before merge if compatible with the chosen release flow.

Do not create a broad bypass for routine development. Limit emergency bypass to repository administrators/release owners and preserve the audit trail.

In **Settings → General → Pull Requests**, keep **Allow merge commits** enabled and disable **Allow squash merging** and **Allow rebase merging** for this launch programme. L1 uses normal merge commits.

## Enforcement test

After rules are active, open a non-production test PR and verify direct accidental development pushes cannot bypass policy, force-push/deletion are blocked, required checks gate merge, and a normal merge commit remains possible for an authorized release.
