/**
 * build-bookstore-tbox.mjs
 *
 * Runs the single-source-of-truth utility (bookstoreGraphData.ts) at build
 * time in Node and writes the four outputs the docs site needs:
 *
 *   docs/public/data/bookstore-tbox.jsonld   — for the WebVOWL iframe
 *   docs/public/data/bookstore-graph.json    — for the Cytoscape <BookstoreGraph /> component
 *   docs/public/data/bookstore-schemas.json  — schema literals for the click-to-inspect panel
 *   docs/public/data/bookstore-jsonld.json   — JSON-LD node fragments
 *
 * Why build-time and not browser-runtime: json-tology imports `node:net` for
 * IP-format validation, which Vite cannot bundle into a browser build. The
 * utility module runs in Node here; the browser fetches the resulting JSON.
 *
 * Usage:
 *   npm run build:bookstore-tbox           — write the four data files
 *   npm run build:bookstore-tbox:check     — exit non-zero if any file is out of date
 *
 * Run via: npm run build:bookstore-tbox
 */

import {
  mkdirSync, readFileSync, unlinkSync, writeFileSync
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  join, relative
} from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA_DIR = join(ROOT, 'docs', 'public', 'data');
const UTILS_PATH = join(ROOT, 'docs', '.vitepress', 'theme', 'utils', 'bookstoreGraphData.ts');

const CHECK_MODE = process.argv.includes('--check');

const tmpFile = join(tmpdir(), `bookstore-extract-${randomUUID()}.ts`);
const extractorContent = `
import { toCytoscapeElements, toJsonLd, toJsonLdMap, toSchemaMap } from ${JSON.stringify(UTILS_PATH)};
process.stdout.write(JSON.stringify({
  cytoscape: toCytoscapeElements(),
  jsonLd: toJsonLd(),
  jsonLdMap: toJsonLdMap(),
  schemaMap: toSchemaMap()
}));
`;

writeFileSync(tmpFile, extractorContent, 'utf8');

let payload;

try {
  const result = execFileSync(
    'npx',
    [
      'tsx',
      tmpFile
    ],
    {
      'cwd': ROOT,
      'encoding': 'utf8',
      'stdio': [
        'pipe',
        'pipe',
        'inherit'
      ]
    }
  );

  payload = JSON.parse(result);
} finally {
  try {
    unlinkSync(tmpFile);
  } catch {
    // ignore cleanup error
  }
}

const outputs = [
  {
    'content': JSON.stringify(payload.jsonLd, null, 2),
    'file': 'bookstore-tbox.jsonld',
    'label': 'bookstore-tbox.jsonld'
  },
  {
    'content': JSON.stringify(payload.cytoscape, null, 2),
    'file': 'bookstore-graph.json',
    'label': 'bookstore-graph.json'
  },
  {
    'content': JSON.stringify(payload.schemaMap, null, 2),
    'file': 'bookstore-schemas.json',
    'label': 'bookstore-schemas.json'
  },
  {
    'content': JSON.stringify(payload.jsonLdMap, null, 2),
    'file': 'bookstore-jsonld.json',
    'label': 'bookstore-jsonld.json'
  }
];

if (CHECK_MODE) {
  let drift = 0;

  for (const output of outputs) {
    const target = join(DATA_DIR, output.file);
    const rel = relative(ROOT, target);
    let current = '';

    try {
      current = readFileSync(target, 'utf8');
    } catch {
      // Missing target counts as drift.
    }

    if (current !== output.content) {
      console.error(`✗ ${rel} is out of date — run \`npm run build:bookstore-tbox\` and commit the result.`);
      drift += 1;
    } else {
      console.log(`✓ ${rel} matches`);
    }
  }

  if (drift > 0) {
    console.error(`\n${drift} bookstore data file(s) drifted from their schemas. Run \`npm run build:bookstore-tbox\` and commit the result.`);
    process.exit(1);
  }

  console.log(`\nAll ${outputs.length} bookstore data files are in sync with the schemas.`);
} else {
  mkdirSync(DATA_DIR, { 'recursive': true });

  for (const output of outputs) {
    writeFileSync(join(DATA_DIR, output.file), output.content);
  }

  const nodeCount = payload.cytoscape.nodes.length;
  const edgeCount = payload.cytoscape.edges.length;
  const schemaCount = Object.keys(payload.schemaMap).length;
  const jsonLdCount = Object.keys(payload.jsonLdMap).length;

  console.log(`bookstore-graph.json:   ${nodeCount} nodes, ${edgeCount} edges`);
  console.log(`bookstore-schemas.json: ${schemaCount} schemas`);
  console.log(`bookstore-jsonld.json:  ${jsonLdCount} node fragments`);
  console.log('bookstore-tbox.jsonld:  written for WebVOWL');
}
