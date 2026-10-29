# Interface conventions

OSS uses ivory surfaces, forest-green actions and rust accents. Both appearance
themes use the same layout and semantic tokens in `apps/oss/src/styles.css`.
The [interface review](INTERFACE-REVIEW.md) records the project-wide checks.

## Layout and type

Comparison and Garage align to a 1,280 px content width with shared page gutters.
Navigation keeps the same order and alignment as the header wraps. The measured header
height controls page scroll padding so focused content clears the navigation.

Page titles scale from 30 to 44 px. Form text is 14 px on larger screens and 16 px
on mobile. Supporting metadata uses at least 12 px; the compact brand lockup is
the exception. Headings, values and supporting text have distinct weights and
spacing. Long identifiers and personal notes wrap within their containers.

## Controls and surfaces

- `--control-height`: 44 px for fields and action targets. Checkbox labels provide
  the larger target while their native checkbox stays compact.
- `--radius-sm`: 6 px for fields and controls.
- `--radius-md`: 10 px for grouped information and form sections.
- `--radius-lg`: 16 px for vehicle cards and dialogs.
- Use the shared primary, secondary, text and icon actions. Destructive actions
  use `--danger-action` and `--danger-ink`, with values for both themes.

Surface, text, border, action, focus, warning and danger colours come from tokens.
Keep hard-coded theme colours in the token definitions. Neutral explanations use
`panel-note`; warnings and validation errors have their own treatment. Hover
changes affect the surface or border while keeping text legible. Focus outlines
remain visible. Appearance supports light, dark and the device preference.

## Forms and dialogs

Close controls share an icon, target size and accessible name. Long buying,
journal and shortlist dialogs keep actions in a sticky footer. Form-linked submit
buttons retain native validation. `useDialogLayout` measures headers and footers
to reserve scroll space and reveal focused controls clear of those actions.
Comparison retains its measured table headers,
pinned labels and keyboard column navigation.

The journal shows the editor on its own while a review is being changed. After
saving or cancelling, focus returns to the review list. Garage forms reveal the
active field or heading, and closing the finder returns focus to Add a vehicle.
Saving a new owned vehicle reveals its card.

Publishers, review dates and source links stay visible in source cards.
Publication locators expand on request. Scoring has a short explanation followed
by expandable formulas and assumptions. Backups preview before applying changes;
replacement and removal controls state their effect.

## Wording

Use short, direct instructions and familiar nouns. Name the action and explain
the information needed to complete it. Keep labels consistent wherever a setting
appears. Describe price basis, coverage and measurement limits directly; avoid
rhetorical contrasts and promotional filler.

“Not verified”, “Not applicable” and unknown personal amounts carry different
meanings and remain distinct. Source URLs, dates, numeric values and measurement
qualifications retain their provenance when explanatory wording is edited.
Original downloaded publications and source receipts retain their contents.

## Checks

Verify the screen in both themes and at 320, 390, 820 and 1,440 px. Check native
form validation, visible keyboard focus, sticky actions, long text, empty/error
states and stored-data recovery. Run the interface browser cases alongside the
existing catalog, comparison, shortlist, buying and Garage regressions. Automated
accessibility checks supplement rendered inspection.
