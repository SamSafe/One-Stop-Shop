# Buying brief and test-drive journal

The buying brief is optional. Create it above the catalog, edit it at any time,
or pause it to return to the original four-priority scoring. Browsing filters
continue to apply. Reset clears catalog filters and legacy priorities; it does
not erase a saved buying brief or reviews.

## Requirements and preferences

Requirements include maximum CAD base MSRP, minimum verified seats and optional
required body styles, exact drivetrain, horsepower and rear legroom. AWD and 4WD
are distinct choices. Unknown requirements are hidden by default. A count explains
which otherwise eligible catalog records need checking; include those candidates
explicitly to inspect them. They remain unscored until their required facts are
known. A known failed requirement always excludes a vehicle from results.

The optional questionnaire weights purchase price, energy cost, cargo, rear
legroom, horsepower, drivetrain and body-style preferences from zero to five.
Zero ignores a metric. Body and drivetrain weights are dormant until a preference
is selected. Presets change weights only, without assigning a body style, family
structure, age group or life stage. Users can require coupe/convertible body styles
to exclude other styles, or prefer them while retaining alternatives.

An active brief replaces the legacy fit calculation in both cards and comparisons:

- Price: with a budget, points measure budget headroom, reaching 100 at half the
  budget or below and zero at the full budget. Without a budget, the existing
  $30,000–$60,000 scale applies. These are base prices, excluding additional fees
  and taxes.
- Energy: the existing $0–$24 CAD per 100 km scale, using published consumption
  and the shared editable energy-price assumptions. Annual kilometres do not
  affect this per-distance score.
- Cargo, rear legroom and horsepower: the proportion of the user's target met,
  capped at 100%. More than the target earns no additional points.
- Preferred body styles and drivetrain: 100 for a verified match, zero for a
  verified mismatch. Unknown active facts leave the vehicle unscored.

The weighted average is rounded to 0–100. Filtering never renormalizes scores.
Equal scores use base price and then configuration ID. Missing active data is not
estimated. Horsepower is not handling or driving enjoyment; engine versus system
power and spatial measurement notes still matter. The catalog is unchanged by
this feature, including existing gaps in body-style and specification coverage.

## Personal test-drive reviews

Open Test-drive notes on a card or saved shortlist entry. A review records the
exact catalog configuration, a name snapshot, drive date, verdict, optional 1–5
ratings for enjoyment, seat comfort, rear-seat space and visibility, and up to
4,000 characters of notes. Unassessed ratings remain unknown. Multiple visits are
kept separately; reviews can be edited or explicitly removed. The journal has
vehicle and text filters and ten reviews per page. Reviews remain accessible if
the configuration disappears from the catalog or shortlist.

Cards and comparisons show the latest dated review, with creation time resolving
same-day visits. Personal ratings do not alter published facts or numerical fit.
An opt-in brief setting hides configurations whose latest verdict is Ruled out;
a later dated reconsideration restores eligibility.

## Persistence, privacy and backups

The versioned `oss-buying-v1` local-storage value is independent of the shortlist
and Garage. It holds one brief and up to 1,000 reviews within a 2 MB encoded-size
limit. No backend, account, external service or source upload is involved. Buying
briefs and reviews are excluded from URLs and copied catalog links; recipients
use their own local brief or default scoring. The UI states this limitation.

Buying backups under the journal's device-data section export the entire brief
and review history. Import validates the full format, previews the file and merges
new review IDs. Existing reviews, including conflicting IDs, are retained; an
existing brief is kept. Keep the original file for conflicting versions. Backups
may contain personal notes and go only where the user saves or shares them.

Edits and removals reread storage and reject changed/deleted records instead of
overwriting newer work. Independent reviews are retained. Unreadable or newer
formats are preserved; session-only changes remain exportable. Failed writes
produce an explicit warning. Clearing buying data requires a separate confirmation
and rejects data changed since that confirmation was opened. Clearing the
shortlist does not remove reviews. Clearing browser site data removes all local
data; export backups first.

## Validation

`apps/oss/src/buying.test.ts` checks power/body-style matching, hard constraints,
unknown data, personalized scales, target caps, legacy fallback, review ordering,
portable data, import conflicts and stale edits/removals. `tests/e2e/buying.spec.ts`
exercises real brief and journal flows, persistence, optional questionnaire,
ruled-out eligibility, backups, privacy, concurrent editing, preserved unreadable
originals, keyboard controls and light/dark accessibility.
