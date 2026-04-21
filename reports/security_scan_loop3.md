# Security Scan — Loop 3

**Tool:** gitleaks 8.18.2 (installed `/usr/local/bin/gitleaks` on server).
**Config:** `.gitleaks.toml` (committed).

## Scan results

| Scan            | Source      | Raw findings | Real findings | Notes                                     |
|-----------------|-------------|--------------|---------------|-------------------------------------------|
| Full git history| `gitleaks detect --source=.` | 28 | 1 | see triage below |
| Current tree    | `gitleaks detect --no-git` (scoped to source)| n/a | 0 | all ignoring node_modules |
| Staged diff     | `gitleaks protect --staged`  | 0 | 0 | clean |
| Reports dir     | `gitleaks detect --source=./reports --no-git` | 0 | 0 | clean |

## Triage of the 28 git-history findings

| Count | Rule                 | File pattern                                     | Verdict         |
|-------|----------------------|--------------------------------------------------|-----------------|
| 13    | hashicorp-tf-password| `e2e/chart-platform.spec.ts`                     | FP — `"pass1234"` test fixture |
| 2     | hashicorp-tf-password| `e2e/chart-interactions.spec.ts`                 | FP — test fixture |
| 2     | hashicorp-tf-password| `e2e/live-market.spec.ts`                        | FP — test fixture |
| 2     | hashicorp-tf-password| `e2e/simulation-flow.spec.ts`                    | FP — test fixture |
| 2     | hashicorp-tf-password| `tests/integration/e2e/test-results/.../error-context.md` | FP — test log |
| 6     | hashicorp-tf-password| `tests/integration/e2e/*.spec.ts`                | FP — test fixture |
| **1** | generic-api-key      | `backend/scripts/prodExpand.cjs:19` (historical) | **real — historical Alpha Vantage key `REDACTED_AV_KEY_LOOP4…` committed in an early revision; current source uses `process.env.ALPHA_VANTAGE_KEY`** |

### Action for the one real finding

- Key fragment: `REDACTED_AV_KEY_LOOP4` (Alpha Vantage free-tier)
- File (current `HEAD`): `backend/scripts/prodExpand.cjs` — currently loads from env, no leak in present revision.
- Git history: key still readable via `git log -p`. Rotation required.
- **Remediation steps (Loop 4):** rotate the Alpha Vantage free-tier key; rewrite history via `git filter-repo --replace-text` on that constant; force-push after team sign-off; update `.env.secrets` deployment manifest.

## Config summary

`.gitleaks.toml` adds an allowlist for `e2e/**/*.spec.ts` and markdown docs, so
future CI runs with `gitleaks detect -c .gitleaks.toml` should reduce the 28
findings to the 1 historical item pending rotation.
