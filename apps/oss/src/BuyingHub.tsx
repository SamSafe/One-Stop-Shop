import type { BuyingBrief } from './buying';
import { currency } from './catalogView';
import type { BuyingStore } from './useBuyingWorkspace';

export function BuyingHub({
  store,
  activeBrief,
  dialogOpen,
  onEditBrief,
  onOpenJournal,
  onBriefToggled,
}: {
  store: BuyingStore;
  activeBrief: BuyingBrief | null;
  dialogOpen: boolean;
  onEditBrief: () => void;
  onOpenJournal: () => void;
  onBriefToggled: () => void;
}) {
  const brief = store.workspace.brief;
  return (
    <section className="buying-hub" aria-labelledby="buying-title">
      <div>
        <h2 id="buying-title">Your buying brief</h2>
        <p>
          {activeBrief
            ? 'Showing vehicles for your saved brief. Search and filters narrow this list.'
            : 'Set your budget, seating needs and other priorities.'}{' '}
          <span className="buying-storage">Saved on this device.</span>
        </p>
        {activeBrief && <p className="buying-brief-summary">{briefSummary(activeBrief)}</p>}
      </div>
      <div className="buying-actions">
        <button type="button" className="button primary" onClick={onEditBrief}>
          {brief ? 'Edit buying brief' : 'Create buying brief'}
        </button>
        {brief && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              if (store.saveBrief(brief, { ...brief, enabled: !brief.enabled })) onBriefToggled();
            }}
          >
            {activeBrief ? 'Pause buying brief' : 'Use buying brief'}
          </button>
        )}
        <button type="button" className="button secondary" onClick={onOpenJournal}>
          Test-drive journal ({store.workspace.reviews.length})
        </button>
      </div>
      {store.warning && (
        <p className="notice" role="status">
          {store.warning}
        </p>
      )}
      {store.error && !dialogOpen && (
        <p className="notice" role="alert">
          {store.error}
        </p>
      )}
    </section>
  );
}

function briefSummary(brief: BuyingBrief) {
  return [
    brief.budget ? `Up to ${currency.format(brief.budget)} base MSRP` : '',
    brief.minSeats ? `${brief.minSeats}+ seats` : '',
    brief.bodies.length
      ? `${brief.bodies.join(', ')} ${brief.bodyRequired ? 'only' : 'preferred'}`
      : '',
    brief.drive !== 'Any' ? `${brief.drive} ${brief.driveRequired ? 'required' : 'preferred'}` : '',
    brief.powerRequired || brief.weights.power > 0
      ? `${brief.horsepower} hp ${brief.powerRequired ? 'minimum' : 'target'}`
      : '',
    brief.includeUnverified
      ? 'Unverified requirements shown for checking'
      : 'Verified requirements only',
  ]
    .filter(Boolean)
    .join(' · ');
}
