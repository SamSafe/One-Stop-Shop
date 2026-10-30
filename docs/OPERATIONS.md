# Deployment and operation

## Release procedure

Use the lockfile and the committed Node version. From a clean checkout:

    npm ci
    npm run check
    npm audit --audit-level=moderate
    npx playwright install chromium firefox webkit
    npm run test:e2e

Linux browser installations may need system libraries; GitHub Actions installs
them with Playwright's --with-deps option. Build failures are release blockers.
Automated accessibility checks supplement keyboard/visual review; they do not
certify accessibility.

For the existing local `oss-market-browser` Ubuntu test container, the installed
WebKit cache is `/tmp/oss-browsers`. Set `PLAYWRIGHT_BROWSERS_PATH` to that path;
the `/ms-playwright` mount was empty during the 28 October 2026 check. Verify the
actual executable before launching a suite. The repository is mounted read-only
at `/app`, so direct Playwright output and HTML reports to container `/tmp` paths.
Stop this disposable container after verification. This local setup does not
change the production container or CI browser installation.

The 29 October completion audit ran WebKit directly on Ubuntu 24.04 when Docker's
WSL integration was unavailable. Missing libraries were downloaded and unpacked
under `/tmp`; a temporary launcher supplied their paths to the installed WebKit
2370 executable. The full 131-case mobile suite passed with its existing device
profile, assertions, timeouts and retry settings. Its temporary Playwright config,
package plan and reports are retained locally under the ignored
`artifacts/interface-completion` directory. Standard installations can use
Playwright's `install-deps` command instead of this temporary setup.

On a constrained local machine, run host browser projects and a separate WebKit
container sequentially, and finish catalog validation or ingestion probes before
starting browser tests. Worker limits apply per invocation; concurrent commands
can exceed the intended total. If traces show slow loading or accessibility work
exhausting a test budget, recheck the affected project alone with `--workers=1`
while keeping its assertions, test timeouts and retry settings unchanged. During the
fuel-price increment, three cases exhausted their 30-second budgets under shared
load; the complete affected browser projects passed when run alone with one
worker. Three fresh Chromium contexts against the local production server then
reached search in 1,183, 1,122 and 1,123 ms. These measurements belong to that
increment; current verification is recorded in [project status](PROJECT-STATUS.md).

Deploy the resulting dist artifact as a unit. Keep the previous artifact and
source SHA for rollback. Never mix old HTML with only some newly built assets.

For a standalone local artifact, commit the reviewed source and run:

    npm run package:release

The ignored artifacts/ directory contains a .tgz archive, its SHA-256 checksum
and a release receipt with the source commit and source fingerprint. Archive
names include the version, commit and content checksum; previous archives are
never overwritten. Verify the archive using its .sha256 file, extract it, verify
SHA256SUMS from inside the extracted oss directory, then run node scripts/serve.mjs
without installing dependencies. This packaging command performs no upload or
publication.

Each build writes dist/build-manifest.json with hashes of all deployed files
and the two runtime scripts. Packaging checks those hashes and the current
build inputs against the recorded source fingerprint. A stale dist, an altered
asset, a mismatched server or uncommitted changes block packaging. Rebuild from
the intended clean source rather than copying an old dist into a new checkout.
The manifest checks consistency; it is not a signed proof of publisher identity.

## Production server and container

    npm start

PORT defaults to 8080 and HOST to 0.0.0.0. No application secrets are needed.
Use HTTPS at a trusted reverse proxy; the Node listener itself is HTTP. Run it
under a supervisor that restarts failed processes. Do not expose the Vite dev or
preview server as the production service.

    docker build -t oss:release .
    docker run -d --name oss --restart unless-stopped --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 100 --memory 256m -p 127.0.0.1:8080:8080 oss:release

The image runs as the non-root node user, has no runtime npm dependencies and
requires no writable application files or persistent volume. When deploying
without the image or archive, copy all of dist plus scripts/serve.mjs and
scripts/release-integrity.mjs from the same build. Startup verifies full file
hashes before listening and fails if files are absent or changed.

GET /healthz returns HTTP 200 with status ok for the production server. If a
required build file disappears or changes size after startup, it returns HTTP
503 with status unavailable. This lightweight readiness check does not rehash
every file on every request; keep production artifacts immutable. Monitor it and
the homepage from your hosting environment. Alert on non-200 responses, increased
5xx responses or application JS failures. The app has no third-party analytics
or error collector; host monitoring and alert destinations must be configured
in the actual deployment account.

The server restricts methods and file paths, blocks dotfiles/path escapes,
serves the build's precompressed Brotli or gzip siblings (falling back to
streamed gzip), uses no-cache for HTML and long immutable caching for hashed
assets. It supplies CSP, nosniff, framing, referrer and permissions policies.
Request URLs are not logged by the app; a reverse proxy/host may log them.

The catalog is a hashed JSON asset in the release manifest, fetched from the same
origin after the small UI loader starts. Deploy the complete `dist` directory,
including JSON assets and their `.br`/`.gz` siblings; on another host, use
immutable caching and Brotli or gzip for these assets as for hashed scripts. Failed catalog delivery shows a reload action while preserving
saved device data. No manufacturer API is contacted by the browser. See
[catalog delivery](CATALOG-DELIVERY.md) for preparation, development refresh and
startup measurements.

## Static hosting / Sites

The tracked .openai/hosting.json selects this release's owner-private Sites
project and dist directory. Site identity is configuration, not a credential.
Short-lived source credentials must stay out of the repository and artifacts.

The Site is currently unpublished. Automatic approval review rejected uploading
repository source/build artifacts to that external destination without explicit
user authorization. Obtain that authorization before retrying publication; do
not work around the rejected source transfer.

The Sites workflow builds, synchronizes the exact source commit, packages the
artifact and deploys a saved version. Preserve the current private audience.
Record returned source SHA, version ID and deployment URL in the release report.
Retain version IDs for rollback; do not recreate the project.

For another static host, serve `/`, `/garage` and `/garage/` with index.html and return 404 for unknown files. Configure those explicit route mappings; query parameters need no additional routing. Apply the policies
in dist/_headers if the host supports that convention. Otherwise configure
equivalent response headers and cache rules in that host. HTML includes a CSP
fallback, but framing and HTTP cache policies require actual response headers.
Check the deployed host's policies separately; local server tests cannot prove
that a provider honors _headers.

A static /healthz asset is included. A static host must serve the deployed
artifact for that URL; it does not need the Node server.

## Smoke checks after deployment

- Open the homepage and verify Canadian catalog records and CAD labels. Try the priced-retail and electric quick views.
- Filter to Hybrid, then restore all cars.
- Change search/filter/sort settings, navigate to another result page and reload; verify the same view returns. Copy a search link into a fresh browser context and confirm the private shortlist filter is omitted.
- Compare two configurations, change energy assumptions and reload the copied URL to verify both the selection and assumptions.
- Save a shortlist, reload, and clear it through Privacy & data.
- Open Manage shortlist with restrictive catalog filters and verify all saved choices appear. Export a backup, preview importing it with duplicates/unavailable IDs, cancel once, then merge without losing newer choices from another tab. Check direct comparison selection and keyboard return after closing the manager.
- Inspect a source link, the data review date and pricing exclusions.
- Open `/garage`, confirm per-vehicle maintenance coverage and export a calendar snapshot from a vehicle with known service-date history.
- Log an optional service amount/provider, filter its history and export matching CSV rows. Check a JSON backup/restore retains the expense and keeps unknown amounts distinct from zero.
- Check the homepage, health endpoint, headers and a hashed asset cache policy.

A successful native Sites deployment verifies publication. External uptime
monitoring for a private deployment requires access appropriate to its audience.

## Rollback

Redeploy the previous known-good saved Site version without changing audience.
For another host, select the previous complete artifact/container image.
If rebuilding is required, use a separate clean checkout at the known-good
source SHA, reinstall from its lockfile and execute its release checks.

After rollback, repeat the smoke checks. Browser shortlists contain stable IDs;
removed catalog IDs are dropped on load. Unknown storage versions and corrupt
payloads are preserved until the user explicitly clears them; an older release
must not overwrite a newer shortlist format. Changes to storage/schema versions
need an explicit migration and rollback plan before release.

## Catalog refresh

1. Reopen the linked manufacturer publications and NRCan data for the exact
   Canadian model year, trim and drivetrain. Never silently substitute a US trim.
2. Review changed factual values, price basis, dates and measurement conventions.
   Preserve source publication dates; review dates are separate.
3. Update data/catalog.json and docs/CATALOG-RESEARCH.md together. Preserve IDs
   for unchanged configurations; add new IDs for distinct configurations.
4. Run npm run check and browser checks when displayed fields or behavior change.
5. Review the diff and commit. Build and redeploy the complete artifact.

Known numeric facts need official provenance. Unknown values require null plus
a reason. Do not guess combined fuel consumption from city/highway ratings.
Do not advance review dates without checking the sources.

Manufacturer and NRCan snapshots are refreshed with their importers; see
[catalog sources and refresh](CATALOG-SOURCES.md). `npm run catalog:health`
reports snapshot ages, and its `--replay` and `--live` modes verify that
importers still reproduce their snapshots and still read their live sources.
The weekly source health workflow fails when an importer breaks or a snapshot is
older than 45 days.

For Subaru, run `npm run catalog:sync:subaru` for lineup/pricing followed by
`npm run catalog:sync:subaru-specifications` for exact specification columns.
Review the [source contract and unresolved conflicts](SUBARU-SPECIFICATIONS.md)
and audited rating links before accepting changed snapshots. Specification-only
refreshes do not advance pricing receipts. `npm run catalog:coverage` reports
unresolved Subaru fuel-unit and powertrain evidence alongside other market gaps.

The UI warns after 90 days and builds fail for sources older than 180 days.
Weekly CI checks surface expiry and dependency advisories when the repository's
Actions service is enabled. Reverify inaccessible sources or replace them with
an authoritative reference; do not remove provenance to make validation pass.

## Support limits

The app is English-language Canada only, with a dated and incomplete Canadian catalog. It includes local garage service history, selected manufacturer tasks, personal reminders and calendar snapshots. It provides no cloud sync, background notification service, live inventory, reliability ratings or purchase transactions. Calendar notifications depend on the calendar app. Cargo and width methods differ; the UI preserves those limits. See [current project status](PROJECT-STATUS.md) for exact coverage; French content remains planned.
