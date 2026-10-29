# Interface review — 29 October 2026

Scope: comparison, buying brief, test-drive journal, shortlist, sources,
Garage, shared navigation, loading/recovery and appearance settings.
The existing ivory, forest-green and rust palette remains the starting point.
Published values, source evidence and saved personal records retain their meaning.

## Completion requirements

- Review every application screen, form, disclosure and empty/error state.
- Use common colour, type, spacing, radius, field, action and status conventions.
- Support light, dark and system appearance consistently across both sections.
- Improve navigation, form actions, long dialogs, mobile layout and keyboard focus.
- Replace contrast-heavy and generic promotional wording with direct instructions.
  Keep meaningful qualifications about prices, sources, missing facts and history.
- Verify real flows, accessibility, responsive layouts and persistence after edits.

## Surface inventory

| Surface                                              | Review                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Header, navigation, appearance                       | Shared navigation order/alignment, measured scroll offset and controls; both themes inspected |
| Catalog search, filters, presets, paging             | Compact entry/result tools, shared fields, readable metadata                                  |
| Cards, saved selection, comparison tray              | Common corners, larger targets and wrapping for long names                                    |
| Comparison, differences, source notes, energy inputs | Pinned table retained; shared energy labels and direct qualifications                         |
| Buying brief and optional questionnaire              | Persistent actions, visible validation, useful empty-result recovery                          |
| Test-drive editor, history, device data              | Focused editor, unobstructed notes and consistent removal controls                            |
| Shortlist and backup import/export                   | Vehicle wording, persistent comparison actions and paging focus                               |
| Methodology, sources and privacy                     | Expandable calculations and locators; concise privacy sections                                |
| Garage overview, calendar export, backups            | Shared type/surfaces, direct wording and latest-file preview protection                       |
| Vehicle finder and manual entry                      | Revealed heading, first-field focus and focus return on cancellation                          |
| Vehicle details, mileage and published guidance      | Shared fields, revealed saved cards and qualified source guidance                             |
| Personal reminders and service forms                 | Field sizes, focus, confirmations and both themes reviewed                                    |
| Service history, expenses and removal states         | Filters, totals, dates and actions retain their behavior                                      |
| Loading, errors, empty results and storage warnings  | Direct wording, URL-preserving reload and context-aware actions                               |

## Changes

Controls share a 44 px height, 14 px desktop and 16 px mobile field text, and
6 px corners. Groups, cards and dialogs use the shared 10/16 px corners.
Supporting metadata uses at least 12 px, with the compact brand lockup excepted.
Both themes use semantic surface, focus, warning and destructive-action tokens.
Navigation keeps the same order and alignment as the header wraps on smaller screens.

Buying, journal and shortlist actions remain visible while content scrolls.
Headers and footers are measured, and focused controls are revealed between them.
A browser case caught a partially covered journal textarea and verifies its
correction. Editing a review shows the active form, then returns to saved reviews.
The buying entry and result tools use less vertical space. Empty brief results
provide Edit requirements while preserving the brief on catalog reset.

Energy settings share labels. Sources and scoring use progressive disclosure.
Price basis, charging conditions, maintenance coverage and unknown facts use
direct wording. App, domain and generated-catalog descriptions were reviewed
separately from downloaded publications and source receipts.

Garage forms reveal their heading or first field, restore focus after cancellation,
and reveal a newly saved vehicle. Backup preview rejects superseded file reads.
Compact Garage exports use the same size basis as imports. Recovery links retain
the current search/comparison URL. Destructive confirmations share theme styling.

The review covered all application JSX components, shared CSS, Garage CSS, buying
CSS, visible domain messages, generated catalog explanations and active entry
documentation. Original downloaded publications and historical source receipts
retain their contents. See [the design conventions](DESIGN-SYSTEM.md).

## Verification

The full unit run passes 398 cases across 41 files. Package boundaries, TypeScript,
catalog validation, formatting and production builds pass. The layout audit covered
15 screen states in light and dark themes at 320, 390, 820 and 1,440 px: 120
combinations with no page errors or horizontal document/dialog overflow. Another
40 empty, error, restore and removal views pass the overflow checks; their targeted
accessibility scans report no violations. Representative screenshots were inspected
throughout the review. Stable captures use reduced motion.

All 524 browser cases pass on the final build: 131 each for desktop Chromium,
mobile Chromium, desktop Firefox and mobile WebKit. The complete host run passed
393 cases in 10.7 minutes. WebKit then passed all 131 cases in 8.3 minutes with
one worker. No automatic retries or increased timeouts were needed. The eight
interface cases pass in every browser project, including shared field styles,
navigation, dialog actions, validation focus, journal editing, shortlist paging,
source disclosures, backup ordering and empty-result recovery.

The final WebKit run used the installed revision 2370 browser with libraries
unpacked into a temporary folder because Docker integration was unavailable.
Only the executable's runtime setup changed; the device profile, assertions,
timeouts and retry settings stayed the same. The temporary config and retained
reports are under the ignored `artifacts/interface-completion` directory.

Removal behavior passes in all four browser projects on the final release.
Confirmations use singular or plural labels for the displayed reminder and
service-record counts, with shared destructive-action styling in both themes.

A before/after projection confirms that all 6,083 vehicle identities, numeric facts,
source references, metric qualifiers and review dates match. All 1,337 source records
retain their protected provenance fields. The comparison reconstructs catalog
code from commit `cc0a0fe00d567b2b5302cbac0cdec9c43ce3f863` and normalizes optional
undefined fields to their JSON representation. Both protected projections hash to
`49d935094392de9fb55a3ad3d28fef7c4da4435a16b30ed25d133f8700e71b7e`.
A recursive scan of generated catalog
strings finds no remaining “not a/an” or “rather than” constructions. Original
publisher captures and receipts retain their contents; meaningful unknown and
inapplicable labels remain explicit.

All 21 release artifacts verify against source fingerprint
`9506684919848e6d3f154c8791e71aac7fdd05b65bccf6923a8a8cc43e593207`.
The catalog asset is `catalog-BlAEmNFr.json`; its authored explanations changed,
while protected facts and provenance match the baseline. The local comparison
app, Garage and health endpoint return HTTP 200 at port 8080. Changes remain local.

The local `artifacts/interface-completion/receipt.json` binds the release and test
source fingerprints to the retained check logs, browser results, layout audit,
data-parity proof and copy scan. Screenshots and browser reports are kept beside it.

Reproduce the standard checks with `npm run check`, `npm run format:check` and
`npm run test:e2e`. The isolated WebKit environment is described in
[operations](OPERATIONS.md).
