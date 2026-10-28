# First garage maintenance coverage

Reviewed 26 October 2026. The browser receives normalized guidance and document metadata, not PDF binaries. Vehicle ownership records stay in local browser storage; no account or cloud database is implemented.

## Canadian 2016 Elantra sedan

Hyundai Canada's [manual selector](https://www.hyundaicanada.com/en/owners-section/manuals) exposes its public year/model index and a document list. The 2016 Elantra model identity is `3FFAAE9E-BFA8-4145-9C65-2CD552DF637C`; Elantra GT and Sport have separate identities. The returned list contains repeated entries; exact year/model identities and document paths must be deduplicated. A Canadian GL is not remapped to a U.S. SE.

Only maintenance (chapter 7, 91 PDF pages, 10,181,309 bytes) and specifications (chapter 8, 7 pages, 642,777 bytes) were retrieved. Accepted SHA-256 values and exact publisher URLs are in `packages/car-catalog/src/maintenance.ts`.

Automatic scheduling was extended on 27 October 2026 after visual review of chapter 7 pages 7–9: monthly tire, exterior-light and coolant-level checks; annual battery/terminal cleaning; and 12,000 km/6-month tire rotation. These supplement the reviewed severe-use oil interval. Each task retains its own page locator and conditions. They form a selected task list rather than a complete schedule. See [automatic maintenance](AUTOMATIC-MAINTENANCE.md) for state and coverage rules.

Chapter 7 page 19 was visually checked against extracted text. Its severe-use oil/filter interval is 6,000 km or 6 months. The [Canadian FAQ](https://www.hyundaicanada.com/en/about/faq) directs owners to severe-use maintenance. The reminder covers this single task; it is not a complete schedule. Conditional transmission-fluid intervals, inspections and “more frequently” entries are not converted into universal fixed intervals.

Chapter 8 pages 4–5 were visually checked. The 4.0 L drain/refill oil quantity covers Nu 1.8 and Nu 2.0; the manual gives the oil specification and temperature-dependent viscosity choices. Brake-fluid specification is distinct from a replacement interval. The user's exact engine/transmission remains unconfirmed. No private ownership information, inferred odometer or fictional service history is seeded.

Source receipts in the ignored research cache:

- Manual selector: `4358e94cfc14d573362822efef1a76d2aefbca7e11cbabf0bcd15f57b15d6c77`.
- Public selector client: `73dfe9af12c0cdf3a1a776a12e2a9b8fb4d8511adb2e2b58430c0ccea5aebb08`.
- Year/model index: `f4cefe074aee81ad3adadbd6f4fb02b6bfacd3158778a8b2fd53af2e21d6420c`.
- Requested 2016 Elantra document index: `ffd0b8cd146384a66ea7ce5dfb9e3ea4c318edddc4a489f8deeb0d4b570a10f2`.

## Other initial guidance

The [2025 Toyota Canada Owner's Manual Supplement](https://certified.toyota.ca/content/dam/toyota/pdf/2025_owners_supplement_en.pdf), printed page 24, specifies general maintenance visits at 6 months or 8,000 km, whichever comes first. This is a visit reminder, not an oil-change interval or model-specific task list. It is not applied to other model years.

[Honda Canada's maintenance page](https://www.honda.ca/en/service-parts/maintenance-schedules) lists A/0 applicability by model/year and links the Canadian schedule. Supported models show Maintenance Minder guidance and the 15% oil-life service alert. No fixed kilometre oil interval is invented. Electric Prologue, unlisted models, earlier A/B years and unreviewed future years are excluded.

## Efficient document retrieval

`npm run maintenance:cache -- --profile hyundai-elantra-2016-ca` reuses the two checksummed chapters; a missing chapter is retrieved once. `--offline` verifies local bytes without network access. `--refresh` sends conditional requests when an ETag is known. Changed publisher bytes fail closed and require review before accepted guidance changes. Files are content-addressed, writes atomic, requests bounded, and PDF content is never bundled into the app or executed.

The current document-cache provider index contains this first vehicle only. Scaling means adding Canadian make/model/year/powertrain applicability and document revisions, retrieving only relevant chapters, then extracting and reviewing structured tasks with page locators and usage conditions. A recurring interval, one-time milestone, condition-based instruction and dashboard-driven reminder must remain distinct. Reviewed fixed tasks are scheduled automatically; full manual ingestion, model-wide automatic schedule extraction, additional manufacturer providers, accounts and background notifications remain future work.
