# SEC-004: Alpha Vantage Key Rotation — User Action Required
Status: USER-ACTION
Priority: P0
Time required: ~5 minutes

## Why this can't be automated
Alpha Vantage requires login to their dashboard to revoke/rotate keys. The agent does not
have (and should not have) user credentials for third-party providers.

## Steps

1. Open https://www.alphavantage.co/support/#api-key — sign in.
2. Locate the key starting with `***REDACTED_AV_KEY***…` (the full value is visible in the repository git log if needed; an unredacted copy is also in `/backups/pre_loop4_20260421_033439/` on the production server).
3. Click **Revoke** / **Regenerate**.
4. Generate a new replacement key if needed.
5. Update production env on server:
   ```
   ssh root@64.227.184.166
   vi /opt/tradereplay/.env            # replace ALPHA_VANTAGE_KEY line
   pm2 restart tradereplay-backend
   ```
6. Verify the old key is dead:
   ```
   curl -s "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=***REDACTED_AV_KEY***<rest-of-leaked-key>"
   ```
   Expected response: `{"Information": "… invalid API key …"}` or equivalent rejection.
7. Run the validator against the NEW key:
   ```
   cd /opt/tradereplay
   ALPHA_VANTAGE_KEY=<NEW_KEY> node scripts/lib/validate-api-keys.cjs
   ```
   Expected stdout line: `[PASS] alpha_vantage: GLOBAL_QUOTE returned symbol data`.
8. Reply `SEC_004_ROTATION_COMPLETE` on next Loop 6 invocation.

## Confirming production blast radius = 0
- Production `cleanassets.distinct('sourceName')` returns only `['bse_official','nse_official']`.
- No field in production was enriched from the leaked Alpha Vantage key in Loop 5.
- Chart cohort 21/21 uses Yahoo OHLCV, not Alpha Vantage.
- Therefore the leaked key's continued validity has no production impact — it is purely a hygiene issue.
