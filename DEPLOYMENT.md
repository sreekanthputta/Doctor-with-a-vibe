# VibeDoc Railway Deployment Contract

> Normative priority: subordinate to `AGENTS.md`, `HACKATHON.md`, and `ARCHITECTURE.md`. Railway is the only deployment target. Do not add Vercel, Netlify, Render, Fly.io, Kubernetes, or a second hosting path.

## Decision

Deploy one long-running Railway service from the GitHub `main` branch. The service hosts:

- the built React single-page application;
- the minimal Node/TypeScript gateway;
- Deepgram short-lived-token issuance;
- server-side Medplum/Stedi tool boundaries;
- role-bound demo sessions;
- the sanitized function-trace event stream;
- `/health`.

Medplum remains the durable clinical/workflow store. Railway ephemeral disk and process memory never become a second clinical database. Demo trace state may be ephemeral; durable workflow state belongs in Medplum.

## Runtime contract

- Listen on Railway's injected `PORT` on `0.0.0.0`.
- `GET /health` returns `200` only after the app can serve requests; it performs no PHI-bearing deep dependency query.
- Serve the built SPA with a client-routing fallback.
- Keep one service/process for the hackathon. Do not add a Railway database, volume, worker, cron, or second service without a demonstrated blocker.
- Handle `SIGTERM` by rejecting new mutations and closing trace/provider intake. Only work that has not dispatched a mutation may be cancelled. A dispatched mutation must retain/reconstruct its idempotency key and either finish reconciliation during the drain window or surface `blocked · outcome unknown` for authoritative Medplum reconciliation after restart; it must never be marked failed/cancelled or retried merely because the process lost the response.
- Use Railway's generated domain for the first demo; a custom domain may point to the same Railway service later.

## Configuration as code

When the runnable scaffold exists, the integrator creates `railway.toml` at the repository root with the actual verified scripts—not placeholder commands. It must configure:

```toml
[build]
builder = "railpack"
buildCommand = "npm run build"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/health"
healthcheckTimeout = 120
restartPolicyType = "on_failure"
```

The committed `package.json` must make those exact commands work locally before the configuration is merged. Railway configuration in code overrides conflicting dashboard settings.

## Railway variables

Store secrets only as Railway service variables. Commit names/placeholders in `.env.example`, never values.

Any credential pasted into chat, logs, screenshots, tickets, or other non-secret channels is treated as exposed regardless of stated expiry. Rotate/revoke it before use. Local secrets belong only in ignored `.env` files or an approved secret manager; never in Markdown, Git history, tests, fixtures, trace output, browser storage, or build-time public variables.

Required or feature-gated variables:

```text
NODE_ENV=production
APP_ORIGIN=<Railway generated/custom HTTPS origin>
SESSION_SECRET=<sealed secret>
MEDPLUM_BASE_URL=<hosted Medplum endpoint>
MEDPLUM_CLIENT_ID=<server credential when required>
MEDPLUM_CLIENT_SECRET=<sealed server credential when required>
DEEPGRAM_API_KEY=<sealed; optional live voice>
STEDI_API_KEY=<sealed; optional approved test/live adapter>
```

The browser receives no permanent provider key. Public build-time variables must not contain service credentials. Provider absence selects the visible deterministic fixture path.

## GitHub deployment flow

1. Connect Railway to `sreekanthputta/Doctor-with-a-vibe`.
2. Select the `main` branch and repository root.
3. Add Railway variables in the service Variables tab.
4. Deploy; inspect build/runtime logs.
5. Configure `/health` as the service healthcheck.
6. Generate a Railway domain from service Networking.
7. Run the deterministic smoke test against the deployed URL.
8. Keep the previous known-good deployment available for rollback.

Only the integrator changes Railway settings, configuration, package scripts, or deployment variables.

## Deployment gates

Before a deployment may be called Ready:

- typecheck, lint, tests, and build pass;
- production start command binds to `PORT`;
- `/health` returns `200` through Railway;
- SPA deep links resolve;
- public-booking, patient-demo, and physician-demo sessions remain isolated;
- exact typed fixture flow completes without Deepgram or Stedi;
- function traces update live and redact prohibited fields;
- uncertain identity reveals no PHI and creates one requested exception;
- no secret appears in the browser bundle, response, trace, URL, or logs;
- a Railway `SIGTERM` immediately after Medplum commit reconciles to exactly one resource graph and version-specific Provenance, without a false failure or duplicate retry;
- demo seed/reset is not exposed as a public production route.

## Test-first implementation

Railway configuration is root/integrator-owned. Before creating the real server, write failing integration tests for injected `PORT`, `/health`, SPA deep-link fallback, server-only environment rejection, and graceful shutdown. Then implement the smallest single-process server that makes them green.

The highest-value lifecycle test dispatches a synthetic Medplum mutation, simulates commit followed by response loss and `SIGTERM`, restarts the application, and verifies reconciliation by idempotency identifier to exactly one graph and version-specific Provenance. A separate browser test switches public → patient → physician → patient contexts with colliding trace IDs and proves no prior output remains rendered, expanded, cached, or copyable.

No Railway deployment is declared successful merely because the build starts. The same committed `npm run build`/`npm run start` path must pass locally, then through the deployed URL. Optional providers remain disabled for the first smoke test.

## Official Railway references

- [Deploy a React app](https://docs.railway.com/guides/react)
- [Configuration as code](https://docs.railway.com/config-as-code)
- [Healthchecks](https://docs.railway.com/deployments/healthchecks)
- [Variables](https://docs.railway.com/variables)
- [Build and start commands](https://docs.railway.com/builds/build-and-start-commands)
