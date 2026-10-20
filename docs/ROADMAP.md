# Roadmap

## OSS v1 — implemented

- [x] Confirm Canada and OSS as the first product/market.
- [x] Select TypeScript/React/Vite and an npm workspace.
- [x] Create an independent, validated catalog package.
- [x] Curate five Canadian 2026 SUV configurations with official provenance.
- [x] Search, budget/powertrain/drivetrain filters and explainable fixed-scale ranking.
- [x] Compare 2–4 cars, restore links and estimate annual fuel costs.
- [x] Save device shortlists with storage recovery and cross-tab synchronization.
- [x] Responsive and keyboard-accessible UI.
- [x] Unit, production-browser, accessibility and HTTP checks.
- [x] Security headers, caching, gzip, non-root container and CI configuration.
- [x] Deployment, rollback, privacy and catalog refresh documentation.

The release report records executed checks and deployment status. A checked
implementation item is not a claim that a hosted CI run has occurred.

## Next: validate the product

- Observe a small group of Canadian buyers completing actual comparisons.
- Measure which facts change their shortlist and record missing models/fields.
- Extend coverage only after a configuration's source review is complete.
- Evaluate whether the fixed ranking scales match buyers' expectations.
- Decide an audience/distribution and monetization strategy from that evidence.
- Maintain source freshness and dependency updates.

## Later: catalog operations

- Incremental ingestion with source retention, parsing fixtures and human review.
- Multiple model years, optional equipment and explicit source revisions.
- Broader Canadian models, powertrains and French-language content.
- Add reliability or safety inputs only with justified sources and methodology.

## Later: Garage

Build Garage independently. Start with manually adding an owned vehicle.
Source and validate maintenance schedules before implementing schedule-dependent
workflows. Define time/distance rules and service history first. Sharing auth,
a design system and the one-way OSS handoff follow demonstrated demand.
