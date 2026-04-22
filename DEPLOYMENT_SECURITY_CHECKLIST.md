# Deployment Security Checklist

## Hard Gate

No push or deploy is allowed until this checklist passes.

## Current Findings As Of 2026-04-21

- Workspace-local ignored files contain secret-like material, including at least one real API key in the root `.env`
- Setup helper files under `FRIEND-SETUP` contain credential examples and secret placeholders; they are currently ignored, but still present in the workspace
- `.env.production` had historical tracking, but inspection found only public config values and no private secrets

## Pre-Push Checks

1. Run secret scan across tracked and ignored files
2. Confirm `.env`, `.env.*`, keys, certs, and setup-secret files are ignored and not staged
3. Confirm no private URLs, passwords, DB credentials, or tokens appear in diffs, logs, generated reports, or screenshots
4. Confirm scripts used for validation do not hardcode production passwords or redis URLs

## Remediation Rules

If a real secret is found in tracked history:

1. stop deployment
2. remove from history
3. rotate the secret
4. re-run scan

If a real secret is found only in ignored local workspace files:

1. keep it out of git
2. redact from docs, screenshots, and logs
3. ensure automation never copies it into tracked files or artifacts

## Release Hygiene

- changelog entry prepared
- rollback plan documented
- migration plan documented
- cache invalidation plan scoped to affected keys only
- no blanket destructive flush in routine release flow unless explicitly approved

## Validation Gates

Must pass before deploy:

- local dev validation
- local prod build validation
- production smoke plan prepared
- device matrix prepared
- key metrics recorded before and after

## Post-Deploy Checks

- health checks green
- screener meta, list, stats, symbol detail smoke tests green
- search hit and miss flows validated
- error logs monitored for spike
- cache behavior checked
- rollback executed immediately if critical regression appears

## Evidence Required Per Release

- security scan summary
- files changed
- validation commands run
- screenshots or browser evidence for key flows
- metrics delta