# Decisions

## D1 — Two products with separate purposes

OSS supports buying decisions; Garage will support ownership. Garage must work
for someone who has never used OSS. It is currently documentation only.

## D2 — Monorepo with an enforced boundary

car-catalog imports no application. Applications never import one another.
Repository separation is deferred until an independent consumer or deployment
need justifies it. Boundary checks run in CI.

## D3 — Manual owned-vehicle entry remains Garage's primary future flow

The OSS handoff is optional future convenience, not Garage onboarding.

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
tie handling. Lower price and fuel consumption are better. Missing an active
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

## Deferred decisions

Maintenance data sourcing and licensing, the Garage stack, account sync,
commercial distribution, monetization and wider-market coverage need separate
product decisions. Resolve source rights before redistributing documents or
licensed media; the current catalog stores factual values and source links,
without manufacturer PDFs or imagery.
