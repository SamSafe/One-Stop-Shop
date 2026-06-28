# Decisions & open questions

A running log of product/architecture decisions. Newest decisions appended;
open questions tracked at the bottom until resolved.

## Decided

### D1 — Two separate apps, one shared backend
Build two independently-marketed apps (OSS = buy, Garage = own) on top of one
shared `car-catalog` backend. Share the *plumbing* (data, auth, design system),
never the *pitch*. Each app must justify itself in one sentence to a user who
has never heard of the other.
_Rationale: different stages of the same ownership lifecycle, but the garage app
must stand alone — most users already own a car and won't enter through a buying
tool._

### D2 — Monorepo now, not 3 repos
Single repo with an enforced package boundary around `car-catalog` (it imports
nothing app-specific; apps never import each other). Split the catalog into its
own repo only when a concrete reason appears (independent deploys, an external
consumer, a collaborator).
_Rationale: the dependency tangle is prevented by the boundary, not by repo
separation; a clean package splits out in ~30 min, while separate repos tax the
daily schema churn with publish/version/reinstall cycles._

### D3 — Garage app does not assume OSS
Adding an owned car is the primary flow. Importing a car chosen in OSS is a
one-way convenience the user may discover, never a prerequisite.

### D4 — OSS competes on data depth
Differentiation is structured depth competitors skip (dimensions, seating, leg/
head room, boot, power/torque, drivetrain, tech, running costs) and a
decision-first UX (rank by stated priorities + explain why) over dumb spec
grids.

## Open questions

| # | Question | Why it matters | Status |
|---|----------|----------------|--------|
| Q1 | Target market: UK / US / EU? | Dictates models, units, regulations, and which data sources are viable. Painful to retrofit. | OPEN |
| Q2 | New cars, used, or both? | Different data shape (trims vs. listings) and different buyer mindset. | OPEN |
| Q3 | Which app ships first? | Pure business call now that garage stands alone. Garage = lower onboarding friction; OSS = clearer active-intent. | OPEN |
| Q4 | Tech stack (FE framework, DB, hosting)? | Affects monorepo tooling and the catalog API shape. | OPEN |
| Q5 | How are maintenance schedules sourced legally? | Manuals may have licensing constraints; need a defensible sourcing story. | OPEN |
| Q6 | Monetization for each app? | Shapes feature priorities (e.g. affiliate/dealer leads for OSS, subscription for garage). | OPEN |
