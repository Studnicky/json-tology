/**
 * Message single-source gate: asserts that ZERO inline validation message
 * literals exist in src/modules/graph and src/modules/validation outside of
 * src/constants/VALIDATION_MESSAGES.ts.
 *
 * Wave A+C unified all validation error messages into VALIDATION_MESSAGES.ts.
 * This test makes that invariant structurally enforced: any future inline
 * message string ('must …' or template `must …`) added directly to graph or
 * validation module source files causes this test to fail.
 */

import assert from 'node:assert/strict';
import {
  readdirSync, readFileSync, statSync
} from 'node:fs';
import { join } from 'node:path';
import {
  describe, it
} from 'node:test';

// Inline message literals look like: 'must ' or `must ` — a string that begins
// with "must " as a standalone literal. The regex matches:
//   - single-quoted:  'must ...
//   - double-quoted:  "must ...
//   - template-start: `must ...
//
// We exclude VALIDATION_MESSAGES.ts itself (that is the source table) and any
// .d.ts / .js files (compiled output is not scanned; only .ts sources).
const INLINE_MESSAGE_RE = /['"`]must /u;

/** Recursively collect all .ts files under a directory (excluding .d.ts). */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}

const PROJECT_ROOT = new URL('../../', import.meta.url).pathname;
const GRAPH_DIR = join(PROJECT_ROOT, 'src/modules/graph');
const VALIDATION_DIR = join(PROJECT_ROOT, 'src/modules/validation');
const MESSAGES_FILE = join(PROJECT_ROOT, 'src/constants/VALIDATION_MESSAGES.ts');

/** Scan source files, returning lines that contain an inline must-message literal. */
function findInlineMessages(files: string[]): Array<{ 'file': string;
  'line': number;
  'text': string }> {
  const hits: Array<{ 'file': string;
    'line': number;
    'text': string }> = [];

  for (const file of files) {
    // The message table itself is the allowed source of must-literals
    if (file === MESSAGES_FILE) {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    const lines = source.split('\n');

    for (const [
      idx,
      lineText
    ] of lines.entries()) {
      if (INLINE_MESSAGE_RE.test(lineText)) {
        hits.push({
          'file': file.replace(PROJECT_ROOT, ''),
          'line': idx + 1,
          'text': lineText.trim()
        });
      }
    }
  }

  return hits;
}

void describe('message single-source gate', () => {
  void it('src/modules/graph has no inline "must …" validation message literals', () => {
    const files = collectTsFiles(GRAPH_DIR);
    const hits = findInlineMessages(files);

    assert.deepEqual(
      hits,
      [],
      `Found ${hits.length.toString()} inline validation message literal(s) in src/modules/graph — `
      + `add them to src/constants/VALIDATION_MESSAGES.ts instead:\n${
        hits.map((hit) => {
          return `  ${hit.file}:${hit.line.toString()}  ${hit.text}`;
        }).join('\n')}`
    );
  });

  void it('src/modules/validation has no inline "must …" validation message literals', () => {
    const files = collectTsFiles(VALIDATION_DIR);
    const hits = findInlineMessages(files);

    assert.deepEqual(
      hits,
      [],
      `Found ${hits.length.toString()} inline validation message literal(s) in src/modules/validation — `
      + `add them to src/constants/VALIDATION_MESSAGES.ts instead:\n${
        hits.map((hit) => {
          return `  ${hit.file}:${hit.line.toString()}  ${hit.text}`;
        }).join('\n')}`
    );
  });
});
