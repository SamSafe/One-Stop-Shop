export function SiteFooter({ onClearShortlist }: { onClearShortlist: () => void }) {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        oss<span>.</span>
      </div>
      <p>
        Independent Canadian vehicle comparison.
        <br />
        Your saved vehicles, notes and service history stay in this browser.
      </p>
      <a href="#privacy">Privacy & data</a>
      <details id="privacy">
        <summary>How your data works</summary>
        <p>
          Your shortlist, buying brief, test-drive reviews and Garage records are saved in this
          browser on this device. Export backups before moving devices or clearing site data. Manage
          buying backups in the journal and vehicle backups in Garage.
        </p>
        <p>
          Searches, filters, result pages, comparison IDs, ranking weights and energy settings
          appear in the address bar and copied links. Recipients can see those choices, and URLs may
          appear in hosting access logs. Buying briefs, reviews and the saved-only filter stay
          local; copied links use the catalog controls.
        </p>
        <p>
          OSS uses local storage for personal records and runs without app accounts or analytics.
          The host receives connection and access information when serving the app. Manufacturer
          links open external sites with their own privacy policies.
        </p>
        <button type="button" className="text-button" onClick={onClearShortlist}>
          Clear my shortlist
        </button>
      </details>
    </footer>
  );
}
