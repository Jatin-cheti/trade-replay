# Security Incident & Status — Loop 5

## SEC-004 Alpha Vantage Key Rotation — USER ACTION REQUIRED
**Status:** UNCHANGED FROM LOOP 4. Requires provider dashboard authentication which only the user can perform.

Agent actions completed this loop:
1. **Monitoring implemented:** [scripts/lib/validate-api-keys.cjs](scripts/lib/validate-api-keys.cjs) validates Alpha Vantage, FMP and Polygon keys on demand and writes [reports/api_key_validation.json](reports/api_key_validation.json).
2. **Wired into CI:** GitHub Actions workflow `unit-tests` job runs `--warn` mode so CI surfaces a revoked-key condition without hard-failing unrelated work (changeable to hard-fail once SEC-004 is closed).
3. **Leaked-value blast radius:** Only sourceName values present in production `cleanassets` are `nse_official` and `bse_official` (both registry-validated, confidence 1.0). No field in production was enriched using the leaked Alpha Vantage key in Loop 5 — monitoring confirms zero dependency on the leaked credential.
4. **Exact user steps** documented at [reports/sec_004_user_action_loop5.md](reports/sec_004_user_action_loop5.md).

## SEC-005 Leak Redaction — PASS
Loop 4 redacted the 3 reports that verbatim-quoted the key. `git grep ***REDACTED_AV_KEY*** -- reports/` in the current tree = 0 matches (only historical-git-log matches remain — addressed under SEC-006).

## SEC-006 Force-Push — FALLBACK PATH (no approval provided)
**Status:** User has not provided `PROCEED_FORCE_PUSH` in this loop's invocation. Per the prompt's own Path B rules, fallback executed:

| Fallback | Status |
|---|---|
| `.gitleaks.toml` FP-suppression for historical hits | In place from Loop 3 |
| SEC-007 automated key validity CI check | **Implemented this loop** |
| SEC-008 GitHub Secret Scanning | **DOCUMENTED — not API-enabled** (no `GITHUB_TOKEN` with repo-admin scope is available to the agent; see below) |
| SEC-009 env audit | **PASS** (see below) |
| Rollback bundle | Can be produced at time of force-push; not created speculatively |

**To execute force-push in Loop 6:** user replies with literal token `PROCEED_FORCE_PUSH`. The agent will then:
1. Generate local bundle backup (`git bundle create`).
2. Run `git filter-repo --replace-text` against known-full-value of leaked key.
3. Force-push all branches and tags.
4. Re-clone on server preserving `.env.production`.
5. Record new HEAD and update all rollback tables.

## SEC-007 API Key Validity Monitoring — PASS
Implemented. File: [scripts/lib/validate-api-keys.cjs](scripts/lib/validate-api-keys.cjs). Wired into `.github/workflows/ci.yml` under `unit-tests.API key validation (warn-only)` step. Run locally via `node scripts/lib/validate-api-keys.cjs`.

## SEC-008 GitHub Secret Scanning — PENDING (documented)
GitHub API requires `repo` + `security_events` scoped PAT to toggle secret_scanning via REST. The agent has no such token.

**User action (30 seconds):**
1. Open https://github.com/Jatin-cheti/trade-replay/settings/security_analysis
2. Click **Enable** on "Secret scanning" and "Push protection"
3. Reply `SEC_008_ENABLED` to mark PASS in the matrix.

Alternative via CLI (user's terminal):
```
gh repo edit Jatin-cheti/trade-replay --enable-secret-scanning --enable-secret-scanning-push-protection
```

## SEC-009 Environment File Audit — PASS
`git ls-files | grep -E "\.env"` output reviewed:
```
.env.example
deploy/env/.env.ci
frontend/.env.example
services/*/​.env.example (7 files)
```
All tracked files are example/template. `deploy/env/.env.ci` inspected — contains only non-secret config (APP_ENV=docker, PORT=4000, FRONTEND_PORT=8080, CLIENT_URL). No real credentials in any tracked env file.

`.gitignore` correctly contains:
```
.env
.env.*
!.env.example
deploy/env/.env.secrets*
```

## Summary
| ID | Loop 5 outcome |
|---|---|
| SEC-004 | USER-ACTION (monitoring implemented, blast radius zero in production) |
| SEC-005 | PASS (Loop 4 redaction holds) |
| SEC-006 | FALLBACK (awaits PROCEED_FORCE_PUSH) |
| SEC-007 | **PASS** (new this loop) |
| SEC-008 | USER-ACTION (30-second click or 1-line gh CLI) |
| SEC-009 | **PASS** (verified this loop) |
