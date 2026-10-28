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

The workspace redesign and quality pass have reached the handoff point described in [project status](PROJECT-STATUS.md). Further changes will be selected through individual feature requests.

- [x] Task-focused comparison page with dependent model filtering and compact specification cards.
- [x] Shared navigation and light/dark/system appearance across comparison and garage.
- [x] Compact mobile filtering, with technical record controls under More filters.
- [x] Historical owner directory with validated source receipts and a deferred packed download.
- [x] Search and primary vehicle filters with one optional panel for additional filters and ranking controls.
- [x] Named comparison selections, matching-specification filtering and optional source notes without concealing unknown facts.
- [x] Original ivory/green/rust branding and card styling alongside the simplified comparison flow.
- [x] Reference-based trade-off summaries, qualified spatial comparisons and shared reference links.
- [x] Automatic reviewed maintenance plans, explicit missing-history states and persistent task removals/restoration.
- [ ] Further verified Canadian trim lists, engine-specific manual matches and optional VIN lookup.

See [workspace redesign](WORKSPACE-REDESIGN.md) for behavior and verification.

## Quality and usability increment — 27 October

- [x] Shared energy-cost scoring and sorting across gas, hybrid, EV and plug-in hybrid records.
- [x] Optional spatial priorities, explicit scoring coverage and priority presets.
- [x] Broad body-style, verified seating and priced-record discovery with quick views and removable filters.
- [x] Additional audited retail/rating joins with source and identity checks, retaining shared IDs.
- [x] Split large comparison and garage UI modules into focused components.
- [x] Explicit per-vehicle maintenance coverage and calendar snapshot export.
- [x] Consolidate current state in PROJECT-STATUS.md and correct stale app/operations documentation.
- [ ] Observe buyers completing a shortlist and owners logging real service history.

This authorized increment follows the earlier review milestone; full market and maintenance coverage remain open.

## Browsing continuity increment

- [x] Retain filters, sorting and pagination in validated URLs through reloads and garage round trips.
- [x] Share search views with clipboard fallback while keeping device shortlist state local.
- [x] Match reordered search terms and common model spelling without numeric-model conflation.
- [x] Calculate plug-in scenarios using only the modes selected, with explained unused inputs.

## Ownership history increment

- [x] Optional CAD service expenses and provider details with exact cents and explicit unknown amounts.
- [x] Search, inclusive date filtering, cost/date order and bounded service-history rendering.
- [x] Export all matching history pages to a spreadsheet CSV, retaining JSON backup/restore for editable data.
- [x] Protect new expense fields and pending deletions from stale cross-tab actions.

- [x] Move keyboard focus and the viewport to new history records when changing pages.
- [x] Prioritize reminders across vehicles with status/vehicle filters, bounded pages and direct keyboard navigation.
- [x] Keep overview and vehicle reminder states synchronized after midnight and cross-tab service changes.
- [x] Correct personal reminder names, intervals and starting history while retaining linked records and calendar identity.
- [x] Reject stale reminder edits and removals while preserving concurrent mileage and actual service.
- [x] Reset add/completion forms when imported record and reminder identifiers overlap, preventing old dates or expenses from carrying into new work.

## Shortlist continuity increment

- [x] Manage all saved configurations independently of active catalog filters, with bounded pages and comparison selection.
- [x] Export the entire shortlist to a portable JSON file and preview imports before merging recognized choices.
- [x] Preserve newer cross-tab choices, active comparisons, unknown saved formats and session exports when storage is unavailable.

## Subaru specification increment

- [x] Reconcile all 41 current Canadian factory IDs with exact per-column specification evidence and pricing, including the new BRZ edition.
- [x] Import published dimensions, cargo, room, power, fuel figures and qualified up-to electric range.
- [x] Add 18 reviewed government rating joins while preserving existing public IDs and known manufacturer provenance.
- [x] Keep source-unit conflicts, incomplete cylinder evidence and missing electric consumption explicit and visible in coverage reporting.

## Energy explanation increment

- [x] Expose estimated energy cost per 100 km on cards and comparison tables.
- [x] Separate fuel and electricity quantities/costs, including fuel burned during plug-in electric operation.
- [x] Explain missing active consumption and invalid used prices without partial totals.
- [x] Share active-mode requirements between inputs and calculations; separate annual-distance validity from per-distance estimates.
- [x] Distinguish inapplicable powertrain fields from unverified applicable facts and preserve published provenance.

## Comparison context increment

- [x] Keep vehicle headings and specification labels visible during two-dimensional table scrolling.
- [x] Fit mobile vehicle columns to the measured scroll viewport and keep the dialog close control visible.
- [x] Keep keyboard source links unobstructed, reveal the focused column and preserve pointer link activation.
- [x] Restore focus after removing a comparison vehicle, including the one-vehicle empty state.

## Fuel-price assumptions increment

- [x] Optional premium, diesel and E85 prices with explicit shared-price fallback.
- [x] Select prices from verified fuel labels, preserving unverified grades instead of inferring from names.
- [x] Expose the applied fuel type, unit price and basis on cards and in comparisons.
- [x] Include overrides in ranking, sorting, mixed plug-in calculations and validated search/comparison links.
- [x] Disable unused comparison prices and keep invalid unused values from blocking estimates.

## Outer comparison context increment

- [x] Keep headings visible when the outer dialog clips the top of the comparison table.
- [x] Release headings while preserving final totals and unobstructed energy inputs.
- [x] Reveal source links and vehicle context when keyboard navigation returns from the energy controls.
- [x] Batch scroll work per frame and clean up listeners/observers on close.
