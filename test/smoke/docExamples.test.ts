/**
 * Doc examples smoke test.
 *
 * Globs all json-tology example files under examples/docs/**\/*.ts
 * (excluding comparator files: .zod.ts, .typebox.ts, .ajv.ts, .pydantic.py)
 * and imports each one. Asserts that no import throws.
 *
 * This makes the docs un-bit-rottable: if an API changes and a doc example
 * is not updated, this test fails.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { readdir } from 'node:fs/promises';
import {
  join, resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIR = fileURLToPath(new URL('.', import.meta.url));
const EXAMPLES_ROOT = resolve(CURRENT_DIR, '../../examples/docs');

// Recursively find all .ts files that are json-tology examples (not comparators
// and not the benchmark suite — bench files are runnable scripts, not API examples).
async function findExamples(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { 'withFileTypes': true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'benchmarks') {
        continue;
      }
      results.push(...await findExamples(fullPath));
    } else if (
      entry.isFile()
      && entry.name.endsWith('.ts')
      && !entry.name.endsWith('.zod.ts')
      && !entry.name.endsWith('.typebox.ts')
      && !entry.name.endsWith('.ajv.ts')
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

const examples = await findExamples(EXAMPLES_ROOT);

assert.ok(examples.length > 0, 'Expected at least one example file in examples/docs/');

await describe('doc examples smoke', async () => {
  for (const examplePath of examples) {
    const relPath = examplePath.replace(`${EXAMPLES_ROOT}/`, '');

    await it(`imports without throwing: ${relPath}`, async () => {
      await assert.doesNotReject(
        () => {
          return import(examplePath);
        },
        `Example file ${relPath} threw on import`
      );
    });
  }
});
