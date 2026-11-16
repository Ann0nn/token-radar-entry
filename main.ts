// token-radar-01: the best token launch radar (Node 22, standard library only).
//
// The program reads the sealed DefiLlama snapshot from /input/snapshot.json
// (or --input <file|directory>), scores every rankable pre-token protocol
// with the model in lib/model.ts, and writes the entry's outputs:
//
//   /output/board.json     the ranked board: 201 rows with implied values
//                           and farm plans
//   /output/data.js        the same board as window.RADAR, for the dashboard
//   /output/dashboard/     the static page (index.html, app.css, app.js)
//   /output/screenshots/   three renders of the dashboard
//   /output/dossier.json   the summary the judge reads, built last with the
//                           vendored make.fun library
//
// Everything is deterministic: the same snapshot in gives the same bytes
// out, so the grader's two runs match. No network, no clock, no randomness.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildBoard, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

/** Caps from the competition's gate: the dossier text cap, the screenshot caps. */
const DOSSIER_TEXT_BYTES = 65_536;
const SCREENSHOT_LIMIT = { max: 4, max_bytes: 524_288 };
const DASHBOARD_LIMIT = { max_files: 400, max_bytes: 4_194_304 };
const PLAIN_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const MIN_SCREENSHOTS = 3;

function fail(message: string): never {
  process.stderr.write(`token-radar: ${message}\n`);
  process.exit(1);
}

/** Read --flag <value> or --flag=<value> from the arguments, else the fallback. */
function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1] as string;
  const joined = process.argv.find((a) => a.startsWith(`--${name}=`));
  return joined === undefined ? fallback : joined.slice(name.length + 3);
}

const inputGiven = flag('input', '/input');
const snapshotPath = inputGiven.endsWith('.json')
  ? inputGiven
  : join(inputGiven, 'snapshot.json');
if (!existsSync(snapshotPath)) {
  fail(`no snapshot at ${snapshotPath} — pass --input <snapshot.json|directory> or mount the sealed /input`);
}
const outDir = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildBoard(snapshot);
const problem = boardIssue(board, snapshot);
if (problem !== null) fail(`the model wrote a board the gate refuses: ${problem}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board }, null, 0)}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

/** Copy a directory's plain files (no dotfiles, no subdirectories) into place. */
function copyPlainFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const source = join(from, name);
    if (!statSync(source).isFile()) continue;
    copyFileSync(source, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashboardFiles = copyPlainFiles(join(repoRoot, 'dashboard'), join(outDir, 'dashboard'));
if (!dashboardFiles.includes('index.html')) fail('dashboard/ holds no index.html');
const screenshots = copyPlainFiles(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
if (screenshots.length < MIN_SCREENSHOTS) {
  fail(`screenshots/ holds ${screenshots.length} image(s): hand in ${MIN_SCREENSHOTS} — the board, a detail view, a filtered view`);
}
for (const name of screenshots) {
  if (!PLAIN_NAME.test(name)) fail(`screenshots/${name}: names are letters, digits and . _ -, 1 to 128 characters`);
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: DOSSIER_TEXT_BYTES,
  screenshots: SCREENSHOT_LIMIT,
  dashboard: DASHBOARD_LIMIT,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const top = board[0];
process.stdout.write(
  `token-radar: ${snapshot.protocols.length} protocols in the snapshot, ` +
    `${snapshot.watchlist.length} on the watchlist, ${board.length} rows ranked\n` +
    `token-radar: base multiple ${radar.base_multiple.toFixed(3)} measured over ${radar.base_measured_over} token-trading protocols; ` +
    `top row ${top?.name ?? '?'} at $${(top?.implied_value_usd ?? 0).toLocaleString('en-US')}\n` +
    `token-radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ` +
    `${join(outDir, 'dashboard')} (${dashboardFiles.length} files), ` +
    `${join(outDir, 'screenshots')} (${screenshots.length} images), ${join(outDir, 'dossier.json')}\n`,
);
