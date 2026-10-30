import { spawn } from 'node:child_process';
import { appendFile, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedFields, freshness, importers, liveArgs } from './lib/catalog-sources.ts';
import type { Freshness, Importer } from './lib/catalog-sources.ts';

const usage = `Usage: npm run catalog:health -- [options]

Reports the age of every tracked source snapshot. Optionally verifies importers:

  --replay            Rebuild snapshots from local data/raw captures (--offline).
  --live              Run importers against live sources in a temporary sandbox.
                      Tracked files and data/raw are never modified.
  --only a,b          Limit to the named importers.
  --max-age-days N    Age after which a snapshot is stale (default 45).
  --fail-on-stale     Exit non-zero when any snapshot is stale.
  --timeout-minutes N Per-step limit for replay and live runs (default 15).
  --report FILE       Write the full JSON report.`;

const root = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2);
if (argv.includes('--help')) {
  console.log(usage);
  process.exit(0);
}
function option(name: string) {
  const at = argv.indexOf(name);
  if (at < 0) return undefined;
  const value = argv[at + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value.\n\n${usage}`);
  return value;
}
const flags = ['--replay', '--live', '--fail-on-stale'],
  valued = ['--only', '--max-age-days', '--timeout-minutes', '--report'];
for (let index = 0; index < argv.length; index++)
  if (valued.includes(argv[index]!)) index++;
  else if (!flags.includes(argv[index]!))
    throw new Error(`Unexpected argument ${argv[index]}.\n\n${usage}`);

const maxAgeDays = Number(option('--max-age-days') ?? 45);
const timeoutMinutes = Number(option('--timeout-minutes') ?? 15);
if (!(maxAgeDays >= 0) || !(timeoutMinutes > 0)) throw new Error('Ages and timeouts are numbers.');
const mode = argv.includes('--live') ? 'live' : argv.includes('--replay') ? 'replay' : 'age';
if (argv.includes('--live') && argv.includes('--replay'))
  throw new Error('Choose either --replay or --live.');
const only = option('--only')?.split(',');
const unknown = only?.filter((name) => !importers.some((importer) => importer.name === name));
if (unknown?.length) throw new Error(`Unknown importers: ${unknown.join(', ')}`);
const selected = importers.filter((importer) => !only || only.includes(importer.name));

type Outcome = 'unchanged' | 'changed' | 'failed' | 'skipped';
type Result = Freshness & {
  name: string;
  outcome?: Outcome;
  detail?: string;
  changed?: { count: number; paths: string[] };
  seconds?: number;
};

function run(script: string, args: string[], cwd: string) {
  const command = script.endsWith('.ts') ? ['--import', 'tsx', script, ...args] : [script, ...args];
  return new Promise<{ ok: boolean; output: string }>((resolve) => {
    const child = spawn(process.execPath, command, { cwd, env: process.env });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    const timer = setTimeout(() => {
      output += `\nTimed out after ${timeoutMinutes} minutes.`;
      child.kill('SIGKILL');
    }, timeoutMinutes * 60_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output });
    });
  });
}

// The first error and the lines after it are useful (a ZodError lists its
// issues there); stack frames and tsx noise are not.
function failure(output: string) {
  const lines = output.split('\n').map((line) => line.trim());
  const at = lines.findIndex((line) => /^(\w*Error|Timed out)/.test(line));
  const relevant =
    at < 0
      ? lines.filter(Boolean).slice(-1)
      : lines.slice(at, at + 8).filter((l) => !l.startsWith('at '));
  return relevant.join(' ').replace(/\s+/g, ' ').slice(0, 300) || 'No output';
}

// Importers resolve paths from the working directory or their own location, so
// copies of the scripts and catalog package make a sandbox they cannot escape.
async function sandbox(rawCaptures: 'link' | 'empty') {
  const directory = await mkdtemp(path.join(tmpdir(), 'oss-catalog-health-'));
  await cp(path.join(root, 'scripts'), path.join(directory, 'scripts'), { recursive: true });
  for (const part of ['src', 'data', 'package.json'])
    await cp(
      path.join(root, 'packages/car-catalog', part),
      path.join(directory, 'packages/car-catalog', part),
      { recursive: true },
    );
  for (const file of ['package.json', '.prettierrc.json'])
    await cp(path.join(root, file), path.join(directory, file));
  await symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  await mkdir(path.join(directory, 'data'), { recursive: true });
  if (rawCaptures === 'link')
    await symlink(path.join(root, 'data/raw'), path.join(directory, 'data/raw'), 'dir');
  else await mkdir(path.join(directory, 'data/raw'), { recursive: true });
  return directory;
}

async function verify(importer: Importer, tracked: unknown, cwd: string): Promise<Partial<Result>> {
  if (mode === 'replay' && !importer.replay)
    return { outcome: 'skipped', detail: 'No offline reconstruction; use --live.' };
  if (mode === 'live' && importer.manualRefresh)
    return { outcome: 'skipped', detail: importer.manualRefresh };
  const started = Date.now();
  const steps = mode === 'replay' ? importer.steps.slice(-1) : importer.steps;
  for (const step of steps) {
    const args = mode === 'replay' ? ['--offline'] : liveArgs(importer, step, tracked);
    const { ok, output } = await run(step.script, args, cwd);
    if (!ok)
      return {
        outcome: 'failed',
        detail: `${path.basename(step.script)}: ${failure(output)}`,
        seconds: Math.round((Date.now() - started) / 1000),
      };
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  if (mode === 'replay') return { outcome: 'unchanged', seconds };
  const fresh = JSON.parse(await readFile(path.join(cwd, importer.snapshot), 'utf8'));
  const changed = changedFields(tracked, fresh);
  return { outcome: changed.count ? 'changed' : 'unchanged', changed, seconds };
}

const now = new Date();
const results: Result[] = [];
const cwd = mode === 'age' ? null : await sandbox(mode === 'replay' ? 'link' : 'empty');
try {
  for (const importer of selected) {
    const tracked: unknown = JSON.parse(await readFile(path.join(root, importer.snapshot), 'utf8'));
    const result: Result = { name: importer.name, ...freshness(tracked, now, maxAgeDays) };
    if (cwd) {
      process.stdout.write(`${mode === 'live' ? 'Importing' : 'Replaying'} ${importer.name}… `);
      Object.assign(result, await verify(importer, tracked, cwd));
      console.log(result.outcome);
    }
    results.push(result);
  }
} finally {
  if (cwd) await rm(cwd, { recursive: true, force: true });
}

const rows = results.map((result) => [
  result.name,
  result.date?.slice(0, 10) ?? 'unknown',
  result.ageDays === null ? '—' : `${result.ageDays}d${result.stale ? ' STALE' : ''}`,
  ...(cwd
    ? [
        result.outcome ?? '',
        result.outcome === 'changed'
          ? `${result.changed!.count} fields, e.g. ${result.changed!.paths.slice(0, 3).join(', ')}`
          : (result.detail ?? ''),
      ]
    : []),
]);
const header = ['Importer', 'Retrieved', 'Age', ...(cwd ? ['Result', 'Detail'] : [])];
const widths = header.map((title, column) =>
  Math.max(title.length, ...rows.map((row) => Math.min(row[column]!.length, 90))),
);
const line = (cells: string[]) =>
  cells.map((cell, column) => cell.slice(0, 90).padEnd(widths[column]!)).join('  ');
console.log(`\n${line(header)}\n${widths.map((width) => '-'.repeat(width)).join('  ')}`);
for (const row of rows) console.log(line(row));

const stale = results.filter((result) => result.stale);
const failed = results.filter((result) => result.outcome === 'failed');
const summary = [
  `${results.length} snapshots; ${stale.length} older than ${maxAgeDays} days.`,
  ...(cwd
    ? [
        `${failed.length} failed, ${results.filter((r) => r.outcome === 'changed').length} changed, ` +
          `${results.filter((r) => r.outcome === 'unchanged').length} unchanged, ` +
          `${results.filter((r) => r.outcome === 'skipped').length} skipped.`,
      ]
    : []),
];
console.log(`\n${summary.join('\n')}`);

const report = option('--report');
if (report) {
  await mkdir(path.dirname(path.resolve(report)), { recursive: true });
  await writeFile(
    report,
    JSON.stringify({ checkedAt: now.toISOString(), mode, maxAgeDays, results }, null, 2) + '\n',
  );
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const cell = (value: string) => value.replaceAll('|', '\\|');
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      `## Catalog source health (${mode})`,
      '',
      ...summary,
      '',
      `| ${header.join(' | ')} |`,
      `|${header.map(() => ' --- ').join('|')}|`,
      ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
      '',
    ].join('\n'),
  );
}
if (failed.length || (argv.includes('--fail-on-stale') && stale.length)) process.exitCode = 1;
