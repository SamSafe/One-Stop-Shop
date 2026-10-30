import type { Car } from '@oss/car-catalog';
import { configurationLabel, fullName, modelYearLabel } from './domain';
import { Icon } from './catalogView';

export function CompareTray({
  selected,
  count,
  onRemove,
  onClear,
  onCompare,
}: {
  selected: Car[];
  count: number;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCompare: () => void;
}) {
  return (
    <div className="compare-tray" role="region" aria-label="Selected cars">
      <div className="tray-selection">
        <span className="tray-label">
          Your comparison <small>{selected.length}/4</small>
        </span>
        <ul className="selected-vehicles">
          {selected.map((car) => (
            <li key={car.id}>
              <span className="selected-vehicle-copy" title={fullName(car)}>
                <strong>
                  {car.make} {car.model}
                </strong>
                <small>
                  {modelYearLabel(car)} · {configurationLabel(car)}
                </small>
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${fullName(car)} from selection`}
                onClick={() => onRemove(car.id)}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="tray-actions">
        <button type="button" className="text-button" onClick={onClear}>
          Clear
        </button>
        <button type="button" className="button accent" disabled={count < 2} onClick={onCompare}>
          Compare {count} {count === 1 ? 'car' : 'cars'} <Icon name="arrow" size={18} />
        </button>
      </div>
    </div>
  );
}
