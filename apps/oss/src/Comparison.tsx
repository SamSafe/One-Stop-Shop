import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, FocusEvent } from 'react';
import type { Car } from '@oss/car-catalog';
import { metricDefinitions } from '@oss/car-catalog';
import {
  fullName,
  modelYearLabel,
  configurationLabel,
  hasMatchingSpecification,
  scoreCar,
} from './domain';
import type { Weights, EnergySettings } from './domain';
import {
  Icon,
  SourcedFact,
  PublishedPrice,
  currency,
  reviewedDate,
  metricKeys,
} from './catalogView';
import { ComparisonSummary } from './ComparisonSummary';
import { EnergyInputs } from './EnergyInputs';
import { estimateEnergy, annualEnergyEstimate } from './energy';
import { EnergyCost } from './EnergyCost';
import type { EnergyInputs as Inputs } from './useEnergySettings';
import type { BuyingBrief, TestDriveReview } from './buying';
import { latestReview } from './buying';
import { TestDriveDetails } from './TestDriveJournal';

function revealKeyboardContext(event: FocusEvent<HTMLDivElement>) {
  if (!event.target.matches(':focus-visible')) return;
  const cell = event.target.closest('td, th[scope="col"]');
  const scroll = event.currentTarget;
  const label = scroll.querySelector('thead th');
  if (!cell || !label) return;
  const modal = scroll.closest('dialog');
  const toolbar = modal?.querySelector('.dialog-header');
  if (modal && toolbar) {
    const viewport = scroll.getBoundingClientRect();
    if (
      viewport.top < toolbar.getBoundingClientRect().bottom ||
      viewport.bottom > modal.getBoundingClientRect().bottom
    )
      scroll.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  }
  const box = scroll.getBoundingClientRect();
  const column = cell.getBoundingClientRect();
  const left = box.left + scroll.clientLeft + label.getBoundingClientRect().width;
  const right = box.left + scroll.clientLeft + scroll.clientWidth;
  if (column.width <= right - left + 1 && (column.left < left - 1 || column.right > right + 1))
    scroll.scrollLeft += column.left - left;
}

export function Comparison({
  selected,
  weights,
  open,
  onClose,
  onRemove,
  onShare,
  shareUrl,
  referenceId,
  onReferenceChange,
  energy,
  inputs,
  onInput,
  brief,
  reviews,
}: {
  selected: Car[];
  weights: Weights;
  energy: EnergySettings;
  inputs: Inputs;
  onInput: (key: keyof Inputs, value: string) => void;
  brief: BuyingBrief | null;
  reviews: TestDriveReview[];
  open: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
  onShare: () => void;
  shareUrl: string;
  referenceId: string;
  onReferenceChange: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeHeader = useRef<HTMLDivElement>(null);
  const tableScroll = useRef<HTMLDivElement>(null);
  const backToCars = useRef<HTMLButtonElement>(null);
  const removedIndex = useRef<number | null>(null);
  const tableHintId = useId();
  const [hideMatching, setHideMatching] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const visibleMetrics = metricKeys.filter(
    (metric) => !hideMatching || !hasMatchingSpecification(selected, metric),
  );
  const matchingPowertrain =
    selected.length >= 2 &&
    selected.every(
      (car) =>
        car.fuel === selected[0]!.fuel &&
        car.drivetrain !== 'Not verified' &&
        car.drivetrain === selected[0]!.drivetrain,
    );
  const hiddenCount =
    metricKeys.length - visibleMetrics.length + Number(hideMatching && matchingPowertrain);
  const estimates = new Map(selected.map((car) => [car.id, estimateEnergy(car, energy)]));
  const energyCostFor = (car: Car) =>
    annualEnergyEstimate(estimates.get(car.id)!, energy.kilometres).cost;
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  useLayoutEffect(() => {
    const scroll = tableScroll.current;
    const header = scroll?.querySelector('thead');
    const modal = dialog.current;
    const toolbar = closeHeader.current;
    if (!open || !scroll || !header || !modal || !toolbar) return;
    let frame: number | null = null;
    const followDialog = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!modal.open || scroll.clientHeight === 0) return;
        const tableTop = scroll.getBoundingClientRect().top + scroll.clientTop;
        const toolbarBottom = toolbar.getBoundingClientRect().bottom;
        const finalRow = scroll.querySelector('tbody tr:last-child');
        const readableSpace = finalRow instanceof HTMLElement ? finalRow.offsetHeight : 0;
        const offset = Math.max(
          0,
          Math.min(
            toolbarBottom - tableTop,
            scroll.clientHeight - header.offsetHeight - readableSpace,
          ),
        );
        const value = `${offset}px`;
        if (scroll.style.getPropertyValue('--comparison-heading-offset') !== value)
          scroll.style.setProperty('--comparison-heading-offset', value);
      });
    };
    const measure = () => {
      if (scroll.clientWidth > 0)
        scroll.style.setProperty('--comparison-viewport-width', `${scroll.clientWidth}px`);
      if (header.offsetHeight > 0)
        scroll.style.setProperty('--comparison-header-height', `${header.offsetHeight}px`);
      if (closeHeader.current && dialog.current)
        dialog.current.style.setProperty(
          '--comparison-toolbar-height',
          `${closeHeader.current.offsetHeight}px`,
        );
      followDialog();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    observer.observe(header);
    if (closeHeader.current) observer.observe(closeHeader.current);
    modal.addEventListener('scroll', followDialog, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      modal.removeEventListener('scroll', followDialog);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [open, selected.length]);
  useLayoutEffect(() => {
    if (removedIndex.current === null) return;
    const buttons = tableScroll.current?.querySelectorAll<HTMLButtonElement>('thead button');
    const next = buttons?.[Math.min(removedIndex.current, buttons.length - 1)];
    (next ?? backToCars.current)?.focus();
    removedIndex.current = null;
  }, [selected]);
  return (
    <dialog
      ref={dialog}
      className="comparison-dialog"
      aria-labelledby="comparison-title"
      onClose={onClose}
      onCancel={onClose}
    >
      <div ref={closeHeader} className="dialog-header">
        <div>
          <h2 id="comparison-title">Compare specifications</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close comparison"
          autoFocus
        >
          <Icon name="close" size={24} />
        </button>
      </div>
      <p className="dialog-intro">
        Select a specification to open its source. Base prices exclude freight/PDI, taxes and fees.
      </p>
      <div className="comparison-tools">
        <label className="matching-filter">
          <input
            type="checkbox"
            checked={hideMatching}
            onChange={(event) => setHideMatching(event.target.checked)}
          />
          Hide matching specs
        </label>
        <label className="matching-filter">
          <input
            type="checkbox"
            checked={showNotes}
            onChange={(event) => setShowNotes(event.target.checked)}
          />
          Show source notes
        </label>
        <span className="matching-status" role="status">
          {hideMatching
            ? `${hiddenCount} matching ${hiddenCount === 1 ? 'row' : 'rows'} hidden · unverified values stay visible`
            : 'All specifications shown'}
        </span>
        <button type="button" className="button secondary" onClick={onShare}>
          <Icon name="link" size={17} />
          Copy comparison link
        </button>
      </div>
      {shareUrl && (
        <label className="share-fallback">
          Comparison link
          <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
      {selected.length < 2 ? (
        <div className="empty-state">
          <h3>Add another car to compare.</h3>
          <p>Select at least two configurations from the catalog.</p>
          <button ref={backToCars} type="button" className="button primary" onClick={onClose}>
            Back to cars
          </button>
        </div>
      ) : (
        <>
          <ComparisonSummary
            selected={selected}
            energyCost={energyCostFor}
            referenceId={referenceId}
            onReferenceChange={onReferenceChange}
          />
          <p id={tableHintId} className="comparison-table-hint">
            Scroll within the table for more specifications and vehicles. Vehicle names and
            specification labels stay in view. Focus the table to scroll with arrow keys.
          </p>
          <div
            ref={tableScroll}
            className="table-scroll"
            role="region"
            aria-label="Car specifications comparison"
            aria-describedby={tableHintId}
            onFocusCapture={revealKeyboardContext}
            style={{ '--comparison-columns': selected.length } as CSSProperties}
            tabIndex={0}
          >
            <table>
              <caption className="sr-only">
                Published Canadian vehicle specifications and rating variants
              </caption>
              <colgroup>
                <col className="comparison-label-column" />
                {selected.map((car) => (
                  <col key={car.id} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">The details</th>
                  {selected.map((car, index) => (
                    <th scope="col" key={car.id}>
                      <span className="car-make">
                        {car.make} · {modelYearLabel(car)}
                      </span>
                      <strong>{car.model}</strong>
                      {car.id ===
                        (selected.find((car) => car.id === referenceId) ?? selected[0])?.id && (
                        <span className="reference-label">Reference vehicle</span>
                      )}
                      <span>{configurationLabel(car)}</span>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Remove ${fullName(car)} from comparison`}
                        onClick={() => {
                          removedIndex.current = index;
                          onRemove(car.id);
                        }}
                      >
                        Remove ×
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Record and availability</th>
                  {selected.map((car) => (
                    <td key={car.id}>
                      {car.recordKind === 'government-rating'
                        ? 'Government rating; retail trim not specified.'
                        : car.recordKind === 'manufacturer-offer'
                          ? 'Manufacturer offer; model year not verified.'
                          : 'Retail configuration.'}{' '}
                      {car.modelYearNote && `${car.modelYearNote} `}
                      <span>{car.availability.status.replaceAll('-', ' ')}.</span>
                      <span className="availability-note" hidden={!showNotes}>
                        {' '}
                        {car.availability.note}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="score-table-row">
                  <th scope="row">Your fit score</th>
                  {selected.map((car) => (
                    <td key={car.id}>
                      <strong>{scoreCar(car, weights, energy, brief).score ?? 'Unscored'}</strong>
                      {scoreCar(car, weights, energy, brief).score !== null && ' / 100'}
                      {brief && (
                        <p>
                          {scoreCar(car, weights, energy, brief).reason ??
                            'Based on your buying brief.'}
                        </p>
                      )}
                    </td>
                  ))}
                </tr>
                {selected.some((car) => latestReview(reviews, car.id)) && (
                  <tr>
                    <th scope="row">Your latest test drive</th>
                    {selected.map((car) => (
                      <td key={car.id}>
                        <TestDriveDetails review={latestReview(reviews, car.id)} />
                      </td>
                    ))}
                  </tr>
                )}
                {(!hideMatching || !matchingPowertrain) && (
                  <tr>
                    <th scope="row">Powertrain</th>
                    {selected.map((car) => (
                      <td key={car.id}>
                        {car.fuel} · {car.drivetrain}
                      </td>
                    ))}
                  </tr>
                )}
                {visibleMetrics.map((metric) => (
                  <tr key={metric}>
                    <th scope="row">{metricDefinitions[metric].label}</th>
                    {selected.map((car) => (
                      <td key={car.id}>
                        <SourcedFact metric={metric} car={car} showNotes={showNotes} />
                      </td>
                    ))}
                  </tr>
                ))}
                {selected.some((car) => car.publishedPrice) && (
                  <tr>
                    <th scope="row">Published all-inclusive price</th>
                    {selected.map((car) => (
                      <td key={car.id}>
                        <PublishedPrice car={car} showNotes={showNotes} />
                      </td>
                    ))}
                  </tr>
                )}
                <tr>
                  <th scope="row">Estimated energy /100 km · CAD</th>
                  {selected.map((car) => (
                    <td key={car.id}>
                      <EnergyCost estimate={estimates.get(car.id)!} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Estimated annual energy</th>
                  {selected.map((car) => {
                    const cost = energyCostFor(car);
                    return (
                      <td key={car.id}>
                        {cost === null ? 'Not available' : currency.format(cost)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <EnergyInputs inputs={inputs} onInput={onInput} vehicles={selected} />
        </>
      )}
      <p className="comparison-footnote">
        Reviewed {reviewedDate}. Cargo measurement methods and width conventions can differ between
        manufacturers; confirm real-world fit before buying. Engine versus total-system power
        depends on each source; check field notes. Fit scores reflect only your selected priorities.
      </p>
    </dialog>
  );
}
