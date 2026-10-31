import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { Car } from '@oss/car-catalog';
import { modelYearLabel } from './domain';
import { Card, trimLabel } from './VehicleCard';
import { currency } from './catalogView';

type CardProps = Omit<ComponentProps<typeof Card>, 'car' | 'trims'>;

// One card per model. It shows one trim at a time, starting with the model's best
// by the current sort, and lists the other matching trims to switch between.
export function ModelCard({
  members,
  cardProps,
  savedIds,
  compareIds,
}: {
  members: { car: Car; score: number | null }[];
  cardProps: (car: Car) => CardProps;
  savedIds: string[];
  compareIds: string[];
}) {
  const [activeId, setActiveId] = useState(members[0]!.car.id);
  const [open, setOpen] = useState(false);
  const active = members.find((member) => member.car.id === activeId)?.car ?? members[0]!.car;
  if (members.length === 1) return <Card car={active} {...cardProps(active)} />;

  const years = members.map((member) => member.car.year).filter((year) => year !== null);
  const prices = members
    .map((member) => member.car.facts.msrpCad.value)
    .filter((price) => price !== null);
  const span = (values: number[], format: (value: number) => string) => {
    const low = Math.min(...values),
      high = Math.max(...values);
    return low === high ? format(low) : `${format(low)}–${format(high)}`;
  };
  const listId = `trims-${active.id}`;
  return (
    <Card
      car={active}
      {...cardProps(active)}
      trims={
        <div className="model-trims">
          <p>
            <strong>{members.length} matching trims</strong>
            {years.length > 0 && ` · ${span(years, String)}`}
            {prices.length > 0 && ` · ${span(prices, (price) => currency.format(price))}`}
          </p>
          <button
            type="button"
            className="text-button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Hide trims' : `Show all ${members.length} trims`}
          </button>
          {open && (
            <ul
              id={listId}
              className="trim-list"
              aria-label={`${active.make} ${active.model} trims`}
            >
              {members.map(({ car, score }) => (
                <li key={car.id}>
                  <button
                    type="button"
                    aria-pressed={car.id === active.id}
                    onClick={() => setActiveId(car.id)}
                  >
                    <span className="trim-name">
                      {modelYearLabel(car)} · {trimLabel(car)}
                      {(savedIds.includes(car.id) || compareIds.includes(car.id)) && (
                        <small>
                          {[
                            savedIds.includes(car.id) && 'Saved',
                            compareIds.includes(car.id) && 'Comparing',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      )}
                    </span>
                    <span className="trim-figures">
                      <strong>
                        {car.facts.msrpCad.value === null
                          ? 'Price not verified'
                          : currency.format(car.facts.msrpCad.value)}
                      </strong>
                      <small>{score === null ? 'No fit score' : `Fit ${score}`}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
    />
  );
}
