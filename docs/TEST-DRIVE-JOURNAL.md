# Limits, priorities and the test-drive journal

Until 30 October the app had an optional "buying brief": a second set of
requirements and weights with its own fit score. It repeated most of the catalog
filters, so it was folded into **Filters & priorities**. There is now one set of
limits, one set of priorities and one fit score.

## Limits

Max base MSRP, minimum seats, minimum horsepower and minimum rear legroom are
checked against verified figures. A vehicle with an unknown figure is left out
rather than assumed to pass, and the results say how many records were left out
this way. **Keep vehicles with unverified price, seats, power or legroom** shows
them; each card then says which limit to check. A known figure that fails a
limit always excludes the vehicle. Body style, drivetrain and powertrain are exact
matches, with "Not verified" as its own choice.

## Priorities

Purchase price, energy cost, cargo space, rear legroom and horsepower are each
weighted from 0 to 5. Zero leaves a priority out. The presets (Price & energy,
Family space, Performance, Price only) change weights only. Each priority has a
fixed scale, listed under **How scoring works**; horsepower earns points from
150 hp (zero) to 450 hp (full). A vehicle missing any active figure stays
unscored. **Why this fits** on every card and comparison shows each priority's
weight, published value, scale, earned points and maximum share.

Limits and weights live in the URL, so a copied search link reproduces them.

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
**Hide vehicles I ruled out after a test drive** (shown once a review rules a
vehicle out) hides configurations whose latest verdict is Ruled out; a later dated
reconsideration restores them.

## Persistence, privacy and backups

The versioned `oss-buying-v1` local-storage value is independent of the shortlist
and Garage. It holds up to 1,000 reviews within a 2 MB encoded-size limit. No backend,
account, external service or source upload is involved. Reviews are excluded from
URLs and copied catalog links. Data and backups written by earlier versions may
contain a `brief`; it is accepted on read and dropped.

Buying backups under the journal's device-data section export the entire review
history. Import validates the full format, previews the file and merges new review
IDs. Existing reviews, including conflicting IDs, are retained. Keep the original file for conflicting versions. Backups
may contain personal notes and go only where the user saves or shares them.

Edits and removals reread storage and reject changed/deleted records instead of
overwriting newer work. Independent reviews are retained. Unreadable or newer
formats are preserved; session-only changes remain exportable. Failed writes
produce an explicit warning. Clearing reviews requires a separate confirmation
and rejects data changed since that confirmation was opened. Clearing the
shortlist does not remove reviews. Clearing browser site data removes all local
data; export backups first.

## Validation

`apps/oss/src/buying.test.ts` checks the verified-only limits, kept unverified
figures, horsepower scoring, ruled-out hiding, review ordering, portable data,
legacy backups, import conflicts and stale edits/removals.
`tests/e2e/buying.spec.ts` exercises the limits and journal in the browser:
persistence, ruled-out hiding, backups, privacy, concurrent editing, preserved
unreadable originals and light/dark accessibility.
