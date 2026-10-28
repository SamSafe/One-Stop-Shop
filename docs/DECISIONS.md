# Decisions

## D1 — Two products with separate purposes

OSS supports buying decisions; Garage supports ownership. The first Garage page
is implemented at `/garage` in the existing deployment and works without loading
the comparison catalog. Manual entry supports someone who has never used OSS.
A separate deployment remains an option after feedback.

## D2 — Monorepo with an enforced boundary

car-catalog imports no application. Applications never import one another.
Repository separation is deferred until an independent consumer or deployment
need justifies it. Boundary checks run in CI.

## D3 — Manual owned-vehicle entry is Garage's primary flow

The comparison-card handoff is optional. Older vehicles can be entered directly
without a catalog match.

## D4 — Explain decisions with sourced data

The product hypothesis is that clear priorities and useful, trustworthy details
help buyers form a shortlist. Data depth as a competitive advantage still needs
user validation; it is not an established moat.

## D5 — Canada first, OSS first

Confirmed by the user on 2026-10-20. Use Canadian trims, CAD, L/100 km, litres and
millimetres. The first release compares model-year 2026 compact SUV configurations
and base MSRP snapshots. It does not sell cars, show live stock or value used
listings. Do not derive Canadian specifications from a US configuration.

## D6 — Static application and curated data for v1

React + TypeScript + Vite, npm workspaces, a validated JSON catalog and a
dependency-free Node production server or static hosting. No runtime database,
auth, API keys or external integration is required. Shortlists stay on device.
This keeps the first product operable while gathering evidence for a backend.

## D7 — Transparent ranking with explicit missing values

Four priorities, integer weights, fixed normalization scales and deterministic
tie handling. Lower price and estimated energy cost are better. Default weights now enable price and energy only; spatial priorities are opt-in. Gas, hybrid, EV and plug-in hybrid scoring uses the same editable, shareable energy assumptions. Missing an active
metric leaves a car unscored. Reliability, safety and total ownership cost are
not inferred from proxies.

## D8 — Publish a small, dated snapshot

Five exact configurations, with source URLs, locators, notes and review dates.
Honda and Mazda prices come from dated announcements; Subaru is a current
official base-price snapshot. All exclude freight/PDI and other charges.
NRCan independently supplies Canadian fuel consumption. The UI warns at 90 days;
sources older than 180 days fail builds. Refresh dates only after verification.

## D9 — Private first deployment

The proposed first Sites deployment uses its default owner-private audience.
The project is registered but unpublished: automatic approval review requires
explicit permission before uploading repository source/build artifacts to that
external destination. No public sharing or custom domain is implied. The same
dist artifact and production container can be hosted elsewhere; see OPERATIONS.md.

## D10 — Review maintenance by Canadian vehicle and document revision

The first maintenance provider indexes only the needed Canadian manual chapters.
Checksummed, conditional retrieval avoids downloading a whole manual library.
The app ships normalized facts and source/page links. Exact applicability and
usage conditions are reviewed before a manufacturer interval is offered;
personal reminders remain labelled separately. See MAINTENANCE-SOURCES.md.

## D11 — Pause at a reviewable garage milestone

The user requested a reasonable stopping point and feedback before more
improvements. The 26 October checkpoint is documented in REVIEW-MILESTONE.md.
The user authorized the next quality and app-improvement increment on 27 October, superseding that pause. Incomplete market and maintenance coverage remain explicit.

## Deferred decisions

Broader maintenance providers and source rights, account sync,
commercial distribution, monetization and wider-market coverage need separate
product decisions. Resolve source rights before redistributing documents or
licensed media; the current catalog stores factual values and source links,
without manufacturer PDFs or imagery.
