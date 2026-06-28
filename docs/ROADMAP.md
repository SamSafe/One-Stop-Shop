# Roadmap (planning)

Phased plan. No code yet — this sequences the work and defines what "done"
means for each phase. The catalog is the spine: almost everything depends on it,
so it leads.

## Phase 0 — Foundations
- [ ] Resolve blocking decisions: market (Q1), new/used (Q2), first app (Q3),
      stack (Q4). See `docs/DECISIONS.md`.
- [ ] Choose monorepo tooling (workspaces / pnpm / turbo etc.).
- [ ] Lock the catalog schema v0 from `docs/DATA-MODEL.md`.
- [ ] Stand up the empty monorepo skeleton (packages + apps wired together).
- [ ] CI rule enforcing the boundary: `car-catalog` imports nothing app-specific.

## Phase 1 — Catalog backend (the spine)
- [ ] Define the canonical schema (Make → Model → Trim → specs).
- [ ] Sourcing pipeline v1: pull deep specs for a **narrow seed set** (one
      market, ~20–50 popular models) to prove the data shape end to end.
- [ ] Parse + normalize into the schema; record provenance.
- [ ] Read API: list/filter cars, get a trim's full specs.
- [ ] Data-quality pass: validate units, fill gaps, flag low-confidence fields.

## Phase 2 — First app MVP
Build whichever app Q3 selects first; the other follows in Phase 4.

### If OSS first
- [ ] Browse + filter cars from the catalog.
- [ ] Side-by-side comparison of 2–4 trims with the deep spec set.
- [ ] Decision-first ranking: user sets priorities → ranked results + "why".
- [ ] The depth that competitors skip is the visible hook (seating, leg/head
      room, boot, running costs surfaced up front, not buried).

### If Garage first
- [ ] Add an owned vehicle (primary flow; manual entry must work even if the
      trim isn't in the catalog).
- [ ] Load the catalog maintenance schedule → personalize per vehicle.
- [ ] Dashboard: upcoming / overdue items, mileage + date controls, avg
      miles/week input.
- [ ] Reminders (in-app first; email/push later).

## Phase 3 — Maintenance data + schedules
(If OSS shipped first, this is where the catalog gains schedules.)
- [ ] Source + parse maintenance schedules from manuals for the seed set.
- [ ] Normalize into catalog `MaintenanceSchedule` / `ScheduleItem`.
- [ ] Sort out the legal/licensing sourcing story (Q5).

## Phase 4 — Second app MVP
- [ ] Ship the app not built in Phase 2, reusing catalog + design system.

## Phase 5 — The bridge & polish
- [ ] One-way "add to my garage" handoff from OSS → Garage.
- [ ] Shared auth so a user can roam between apps without being forced to.
- [ ] Brand: the garage logo/animation (OSS) and the literal garage (Garage).

## Cross-cutting (ongoing)
- [ ] Coverage: widen the catalog from the seed set toward full market.
- [ ] Trust: provenance surfaced, refresh pipeline keeps data current.
- [ ] Monetization experiments per app (Q6).
