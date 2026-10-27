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

## Active: all new passenger vehicles offered in Canada

Full scope includes pickups and vans, all makes/models/retail trims, powertrains
and overlapping model years. See CANADIAN-MARKET-COVERAGE.md for completion evidence.

- [x] Import all paged NRCan 2025–2027 ratings with count/ID reconciliation.
- [x] Expose the baseline with filters, pagination and EV/PHEV energy units/costs.
- [ ] Reconcile every manufacturer's current Canadian lineup, including unrated vehicles.
- [ ] Verify exact retail trims, current offering and model-year overlap.
- [ ] Source Canadian MSRP and additional published specifications across the lineup.
- [ ] Close the coverage report's identity and availability gaps before claiming completion.

## Product validation

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

## Garage — first review milestone implemented

- [x] Guided Canadian year/make/model/configuration lookup for older owned vehicles, independent of comparison data.
- [x] Manual fallback for unlisted vehicles and unknown details.
- [x] Odometer updates, service history, recurring reminders and due status.
- [x] Local persistence, cross-tab changes, export and explicit backup restore.
- [x] Canadian 2016 Elantra sedan oil/filter guidance and selected manual specs.
- [x] Toyota 2025 visit guidance and selected Honda Maintenance Minder guidance.
- [x] On-demand checksummed manual chapter cache with conditional refresh.
- [ ] User feedback on the first garage workflow and the Elantra guidance.
- [ ] Broader exact-vehicle schedules, one-time milestones and additional providers.
- [x] Correct vehicle details and service records while preserving history and reviewing manufacturer attribution.
- [ ] Distance forecasts and notification channels.
- [ ] Accounts and cloud sync if needed after feedback.

The requested stopping point is [REVIEW-MILESTONE.md](REVIEW-MILESTONE.md).

## Workspace redesign

- [x] Task-focused comparison page with dependent model filtering and compact specification cards.
- [x] Shared navigation and light/dark/system appearance across comparison and garage.
- [x] Compact mobile filtering, with technical record controls under More filters.
- [x] Historical owner directory with validated source receipts and a deferred packed download.
- [ ] Further verified Canadian trim lists, engine-specific manual matches and optional VIN lookup.

See [workspace redesign](WORKSPACE-REDESIGN.md) for behavior and verification.
