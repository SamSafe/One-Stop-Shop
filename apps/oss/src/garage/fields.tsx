import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';
export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="garage-field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}
export function submitData(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return new FormData(e.currentTarget);
}
export const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
export const numeric = (data: FormData, key: string) =>
  text(data, key) === '' ? null : Number(text(data, key));
