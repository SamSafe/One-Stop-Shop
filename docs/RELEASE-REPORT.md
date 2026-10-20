# OSS v1 verification

Verification date: 2026-10-20. Scope: Canadian 2026 compact SUV comparisons,
five exact configurations across three models. This report distinguishes
executed checks from configured automation and future operational work.

## Executed checks

- Clean container installation from package-lock.json succeeded.
- 40 unit tests passed: catalog validation, ranking, filters, fuel estimates,
  URL handling and device-storage recovery.
- Catalog validation, strict TypeScript checking and package-boundary checks passed.
- Production build passed; compressed JavaScript is approximately 95 kB and CSS
  approximately 6.4 kB.
- 40 browser checks passed across desktop Chromium, mobile Chromium, desktop
  Firefox and mobile WebKit (iPhone viewport). They
  cover filtering, shortlists/reload/cross-tab sync, comparisons, shared URLs,
  clipboard denial, storage failures, keyboard controls, focus containment,
  mobile overflow and automated WCAG AA scans.
- Expanded specifications and the comparison dialog had zero detected axe
  WCAG A/AA violations in the tested states across all three engines. This is an automated check,
  not an accessibility certification.
- Desktop, mobile and comparison screenshots were visually reviewed.
- The production image built and ran as node with a read-only root filesystem,
  dropped capabilities and no-new-privileges; its health check passed.
- HTTP smoke checks confirmed homepage/health success, dotfile denial, CSP,
  safe errors, HEAD behavior, method restrictions and immutable asset caching.
- npm audit reported zero known vulnerabilities in the pinned dependency graph.
- Formatting and git diff whitespace checks passed.
- The documented development command rendered all five cars with no page errors.
- WebKit's localhost asset-loading issue was identified and corrected. HTTPS
  remains a deployment/proxy requirement; the strict CSP no longer forces
  loopback HTTP asset requests onto an unavailable TLS listener.

## Publication

The release is ready for deployment. Sites registration created an owner-private,
unpublished project, but no source push, saved version or deployment occurred.
Automatic approval review rejected exporting the repository source and built
artifacts to the external Sites repository because the user's request did not
explicitly authorize that payload/destination. Publication requires explicit
user approval; the rejection was not bypassed.

A standalone local release archive is generated under artifacts/ with a source
commit, per-file SHA-256 manifest and archive checksum. It runs with Node and
requires no dependency installation. Its receipt is stored alongside it.

The full browser suite ran without retries in a disposable Ubuntu container
because the host lacks Firefox/WebKit libraries. Browser emulation does not
replace testing on physical iOS/Android devices.

## Operational boundaries

- GitHub Actions and Dependabot are configured. A hosted GitHub Actions run has
  not been triggered or observed in this session.
- Static providers must apply the supplied HTTP header/cache rules. Local Node
  server checks alone do not verify a provider's response policies.
- External uptime monitoring, alert routing, a custom domain and public sharing
  are deployment-account choices; the initial Site remains owner-private.
- Catalog prices are dated base MSRP, not live dealer quotes. Source review and
  freshness checks do not imply complete Canadian market coverage.
- Garage, French content, accounts, cloud sync, live inventory, reliability and
  maintenance reminders remain outside this release.

See [OPERATIONS.md](OPERATIONS.md) for deployment, monitoring, rollback and
source-refresh instructions. A future publication receipt must record the source
SHA, version ID and URL after a successful native deployment.
