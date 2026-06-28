# One Stop Shop — platform

A monorepo for two **separate, separately-marketed** car apps that share one
invisible backend.

## The lifecycle

The two apps are the same person at two stages of car ownership:

- **buy** → `apps/oss` — One Stop Shop: deep car comparison / buying tool.
- **own** → `apps/garage` — maintenance reminder app, a garage of cars you own.

Each is a standalone product with its own front door, onboarding, and marketing.
Customers never need to know they're related. The only link a user might
discover is a one-way bridge: choose a car in OSS → "add to my garage".

## Architecture

Share the **plumbing**, not the **pitch**.

```
one-stop-shop/
  packages/
    car-catalog/      # SHARED backend: specs + maintenance schedules + scraping
    ui/               # (later) shared design system
  apps/
    oss/              # comparison app — own frontend + BFF
    garage/           # maintenance app — own frontend + BFF
```

- **Shared:** the car catalog (one `Car` record carries both specs and
  maintenance schedules), auth/accounts, design system.
- **Not shared:** each app's own data (OSS shortlists/comparisons vs. garage's
  owned vehicles/mileage/reminders), the frontends, marketing/onboarding.

## Why monorepo (not 3 repos) for now

The dependency tangle you want to avoid is prevented by the **boundary**
(`car-catalog` imports nothing app-specific; apps never import each other), not
by repo separation. A clean package is ~30 min to split out later; a tangled one
is the painful part. Meanwhile the catalog schema will churn daily early on —
separate repos tax every change with publish/version/reinstall. Split
`car-catalog` into its own repo only when there's a real reason (independent
deploys, an external consumer, a collaborator).

## Open decisions

- Market: UK / US / EU (dictates models, units, data sources).
- New cars, used, or both.
- Which app to build first (pure business call now that garage stands alone).

Full list with rationale in `docs/DECISIONS.md`.

## Planning docs

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased plan, catalog-first.
- [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) — entities + the shared-vs-per-app split.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisions made + open questions.

See each subdirectory's README for app-level detail.
