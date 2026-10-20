# OSS — Find your fit

The active product: Canadian 2026 compact SUV comparison.

## Included

- Search and filter by base MSRP, powertrain, drivetrain and shortlist.
- Set explicit weights for price, consumption, cargo and rear legroom.
- View a fit score, its strongest contribution and the published formula.
- Compare 2–4 exact configurations, with source links and measurement caveats.
- Adjust annual kilometres and CAD-per-litre assumptions for fuel estimates.
- Share selected cars and priority weights through a URL.
- Save a shortlist in device storage, including recovery and cross-tab sync.
- Keyboard-friendly controls, a native modal comparison, responsive layouts and
  a plain-language privacy explanation.

Run the workspace from the repository root; see the root README.

## App boundaries

Ranking is an OSS concern, so it lives here rather than in car-catalog.
The fixed normalization scales are versioned in src/domain.ts. Filtering does
not alter a car's score. Unknown active metrics produce an unscored car rather
than a fabricated value. Zero weights produce no score. Lower L/100 km is better.

No maintenance reminders, dealer listings, safety/reliability scoring or user
accounts are implemented. The Garage handoff is a future independent feature.
