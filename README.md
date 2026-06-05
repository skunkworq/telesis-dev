# Telesis.dev ChatGPT Skill

This repository packages the Telesis.dev skill for ChatGPT and Codex.

Use it when an agent needs to authenticate with Telesis, inspect organizations,
create or update uptime checks, validate endpoints, migrate away from external
uptime tools, or reason about monitor interval cost.

## Install

```bash
git clone https://github.com/skunkworq/telesis-dev.git
cd telesis-dev
codex plugin marketplace add .
codex plugin add telesis-dev@telesis
```

## Use

```text
Use $telesis-dev to create hourly uptime checks for my production web app and API health endpoint.
```

## Package Layout

- `.agents/skills/telesis-dev` is the standalone skill source.
- `plugins/telesis-dev` is the Codex plugin wrapper with logo and UI metadata.
- `.agents/plugins/marketplace.json` exposes the plugin from this repo.

The helper script at
`plugins/telesis-dev/skills/telesis-dev/scripts/ensure-uptime-checks.mjs`
creates or updates services and uptime checks from a JSON spec. It never
deletes services or checks.
