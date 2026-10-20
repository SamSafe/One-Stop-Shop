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

Deploy the resulting dist artifact as a unit. Keep the previous artifact and
source SHA for rollback. Never mix old HTML with only some newly built assets.

## Production server and container

    npm start

PORT defaults to 8080 and HOST to 0.0.0.0. No application secrets are needed.
Use HTTPS at a trusted reverse proxy; the Node listener itself is HTTP. Run it
under a supervisor that restarts failed processes. Do not expose the Vite dev or
preview server as the production service.

    docker build -t oss:release .
    docker run -d --name oss --restart unless-stopped --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 100 --memory 256m -p 127.0.0.1:8080:8080 oss:release

The image runs as the non-root node user, has no runtime npm dependencies and
requires no writable application files or persistent volume.

GET /healthz returns status ok for the production server. Monitor it and the
homepage from your hosting environment. Alert on non-200 responses, increased
5xx responses or application JS failures. The app has no third-party analytics
or error collector; host monitoring and alert destinations must be configured
in the actual deployment account.

The server restricts methods and file paths, blocks dotfiles/path escapes,
streams gzip, uses no-cache for HTML and long immutable caching for hashed
assets. It supplies CSP, nosniff, framing, referrer and permissions policies.
Request URLs are not logged by the app; a reverse proxy/host may log them.

## Static hosting / Sites

The tracked .openai/hosting.json selects this release's owner-private Sites
project and dist directory. Site identity is configuration, not a credential.
Short-lived source credentials must stay out of the repository and artifacts.

The Sites workflow builds, synchronizes the exact source commit, packages the
artifact and deploys a saved version. Preserve the current private audience.
Record returned source SHA, version ID and deployment URL in the release report.
Retain version IDs for rollback; do not recreate the project.

For another static host, serve / as index.html and return 404 for unknown files.
Query parameters require no server routing or SPA fallback. Apply the policies
in dist/_headers if the host supports that convention. Otherwise configure
equivalent response headers and cache rules in that host. HTML includes a CSP
fallback, but framing and HTTP cache policies require actual response headers.
Check the deployed host's policies separately; local server tests cannot prove
that a provider honors _headers.

A static /healthz asset is included. A static host must serve the deployed
artifact for that URL; it does not need the Node server.

## Smoke checks after deployment

- Open the homepage and verify five Canadian configurations and CAD labels.
- Filter to Hybrid, then restore all cars.
- Compare two configurations and reload the copied URL.
- Save a shortlist, reload, and clear it through Privacy & data.
- Inspect a source link, the data review date and pricing exclusions.
- Check the homepage, health endpoint, headers and a hashed asset cache policy.

A successful native Sites deployment verifies publication. External uptime
monitoring for a private deployment requires access appropriate to its audience.

## Rollback

Redeploy the previous known-good saved Site version without changing audience.
For another host, select the previous complete artifact/container image.
If rebuilding is required, use a separate clean checkout at the known-good
source SHA, reinstall from its lockfile and execute its release checks.

After rollback, repeat the smoke checks. Browser shortlists contain stable IDs;
removed catalog IDs are dropped on load. Changes to storage/schema versions need
an explicit migration and rollback plan before release.

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

The UI warns after 90 days and builds fail for sources older than 180 days.
Weekly CI checks surface expiry and dependency advisories when the repository's
Actions service is enabled. Reverify inaccessible sources or replace them with
an authoritative reference; do not remove provenance to make validation pass.

## Support limits

This release is English-language Canada only, with five configurations and dated
base MSRP. It provides no live inventory, cloud sync, reliability ratings,
service reminders or purchase transactions. Cargo and width methods differ;
the UI preserves those limits. Broader coverage and French content are planned.
