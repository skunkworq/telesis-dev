---
name: telesis-dev
description: Operate Telesis.dev monitoring safely. Use when Codex needs to authenticate with Telesis, inspect organizations/services/checks/incidents, create or update uptime checks, validate monitored endpoints, migrate monitoring away from third-party uptime tools, reason about check frequency/cost, or manage internal paid-plan access for Telesis-owned organizations.
---

# Telesis.dev

Use Telesis as the owned monitoring surface. Prefer the checked-in CLI and Connect JSON API over third-party uptime products.

## Workflow

1. Locate the CLI:
   - Prefer `../uptime/cmd/cli/telesis` when the sibling repo exists.
   - Fallback to `telesis` on `PATH`.
   - Respect surrounding repo instructions for shell wrappers, env files, and ports.
2. Confirm auth before live changes:
   - `telesis auth status`
   - If expired, run `telesis auth login` and wait for the browser callback.
   - Never print token values or the contents of `~/.telesis/credentials.json`.
3. Resolve the organization explicitly:
   - Use `telesis service list --org-id <org-id> --output=json` when known.
   - When multiple orgs exist, do not assume the first org is correct for live mutations.
4. Create or update monitoring idempotently:
   - Prefer one service per monitored surface.
   - Prefer uptime checks unless the user specifically asks for security, browser, or Playwright checks.
   - Use conservative intervals by default: `3600s` for core app/API health, `7200s` or longer for low-risk metadata endpoints.
   - Avoid high-frequency multi-location monitoring unless the user explicitly accepts the traffic/cost.
5. Validate after changes:
   - Read back services and checks from the API.
   - Run one-off quick checks with `telesis check <url> --type=uptime --mode=cloud --output=json`.
   - Check the monitored service logs when the user is concerned about traffic spikes.

## Helper Script

Use `scripts/ensure-uptime-checks.mjs` for repeatable service/check setup:

```bash
node /path/to/telesis-dev/scripts/ensure-uptime-checks.mjs monitor-spec.json --dry-run
node /path/to/telesis-dev/scripts/ensure-uptime-checks.mjs monitor-spec.json
```

The script reads `TELESIS_API_TOKEN`/`TELESIS_API_ENDPOINT`, or falls back to `~/.telesis/credentials.json`. It never deletes services or checks.

## Plan And Billing Safety

Telesis plan limits are organization-scoped. Treat paid-plan grants as admin operations:

- Only change a plan when the user explicitly requests it and owns/administers the org.
- Prefer an approved admin API. If a direct data change is required, verify org membership, update only the organization tier, and write an audit log.
- Do not create Stripe customers, checkout sessions, or subscriptions for comped internal access unless the user explicitly asks.

## Monitoring Migration Rules

When replacing external uptime checks:

- Delete or disable the old recurring check before enabling a Telesis replacement.
- Confirm no old user-agent continues hitting the target endpoint.
- Update infrastructure/docs/tests so old providers cannot be recreated by Terraform or CI.
- Make the new Telesis interval visible in source, docs, or final notes.

## References

Read `references/telesis-api.md` when using Connect JSON directly, reviewing expected request shapes, or explaining cost/interval tradeoffs.
