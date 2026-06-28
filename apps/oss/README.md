# OSS — One Stop Shop (car comparison app)

A car-buying / comparison tool. The bet: existing comparison sites are surface
level. OSS goes deep so you don't have to dig — car size, seating arrangements,
leg & head room, boot space, power/torque, drivetrain, technology/infotainment,
running costs, etc.

Position on the decision, not the spec dump: user states priorities (budget,
fuel cost, space, reliability) → OSS ranks options and explains *why*, rather
than handing over a dumb feature grid.

## Branding

- Name: One Stop Shop → **OSS**
- Logo / animation idea:
  - `O<-ne S<-top S->hop`
  - `<-OSS`
  - `-one stop shop`
  - Letters drive *into* a garage on one side, come out the other side
    transformed, then swirl around into the tag-line. Garage = where cars go
    in/out; reinforces "messy car-buying process in, clean answer out".

## Relationship to the garage app

Separate product, separate front door, separate marketing. Shares only the
invisible plumbing (see `packages/car-catalog`). The one-way bridge: an OSS user
can "add to my garage" and have the car they chose land in the maintenance app —
a discovered bonus, never part of OSS's pitch.

## Differentiation to nail

The moat is **data depth**. Competitors stay shallow because deep structured
per-model data is annoying to source. Build that schema and you win.

## Feature ideas

- Browse + filter the catalog (by body style, fuel, price, seats, size...).
- Side-by-side comparison of 2–4 trims across the full deep spec set.
- Decision-first ranking: user sets priority weights (budget, fuel cost, space,
  reliability) → ranked shortlist with an explanation of *why* each ranks where.
- "What fits my life" surfacing: seating layout, leg/head room, boot volume and
  running costs shown up front instead of buried in a sub-tab.
- Shortlists the user can save and revisit.
- (Later) one-way "add to my garage" handoff into the Garage app.

## MVP scope

In: catalog browse/filter, side-by-side comparison with deep specs, priority-
based ranking + explanation, save a shortlist.

Out (for MVP): accounts beyond the minimum, the garage bridge, used-car
listings, finance/insurance, reviews/editorial.

## Open decisions before building

- Geography / market (UK, US, EU) — dictates models, units, data sources. (Q1)
- New cars, used, or both — different data and different buyer mindset. (Q2)

See `docs/DATA-MODEL.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`.
