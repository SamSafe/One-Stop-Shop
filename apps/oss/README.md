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

## Open decisions before building

- Geography / market (UK, US, EU) — dictates models, units, data sources.
- New cars, used, or both — different data and different buyer mindset.
