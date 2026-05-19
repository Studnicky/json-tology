/**
 * Doc examples smoke test.
 *
 * Globs all json-tology example files under examples/docs/**\/*.ts
 * (excluding comparator files: .zod.ts, .typebox.ts, .ajv.ts, .pydantic.py)
 * and imports each one. Asserts that no import throws.
 *
 * This makes the docs un-bit-rottable: if an API changes and a doc example
 * is not updated, this test fails.
 *
 * Implementation note: file discovery runs synchronously via readdirSync.
 * `node:test` schedules subtests at registration time; if we discover
 * asynchronously the runner can begin closing the file before later
 * describes register, so we keep all enumeration synchronous.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { readdirSync } from 'node:fs';
import {
  join, resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = fileURLToPath(new URL('.', import.meta.url));
const EXAMPLES_ROOT = resolve(CURRENT_DIR, '../../examples/docs');

// Directories that contain generated fixture outputs, not runnable doc examples.
const EXCLUDED_DIRS = new Set([
  'generated',
  'generated-dir'
]);

function findExamplesIn(dir: string): string[] {
  const entries = readdirSync(dir, { 'withFileTypes': true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      results.push(...findExamplesIn(fullPath));
    } else if (
      entry.isFile()
      && entry.name.endsWith('.ts')
      && !entry.name.endsWith('.zod.ts')
      && !entry.name.endsWith('.typebox.ts')
      && !entry.name.endsWith('.ajv.ts')
      && !entry.name.endsWith('.generated.ts')
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function listSections(): string[] {
  const entries = readdirSync(EXAMPLES_ROOT, { 'withFileTypes': true });
  const sections: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'benchmarks') {
      sections.push(entry.name);
    }
  }

  return sections.sort();
}

const sections = listSections();

assert.ok(sections.length > 0, 'Expected at least one example section in examples/docs/');

for (const section of sections) {
  const examples = findExamplesIn(join(EXAMPLES_ROOT, section));

  void describe(`doc examples smoke — ${section}`, () => {
    for (const examplePath of examples) {
      const relPath = examplePath.replace(`${EXAMPLES_ROOT}/`, '');

      void it(`imports without throwing: ${relPath}`, async () => {
        await assert.doesNotReject(
          () => {
            return import(examplePath);
          },
          `Example file ${relPath} threw on import`
        );
      });
    }
  });
}
