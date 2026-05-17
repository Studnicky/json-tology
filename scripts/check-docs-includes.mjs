/**
 * check-docs-includes.mjs
 *
 * Scans `docs/**\/*.md` for inline `\`\`\`ts` code blocks that should
 * have been converted to a VitePress `<<<` include directive pointing
 * at a runnable example file in `examples/docs/`.
 *
 * Per the architecture invariant in ARCHITECTURE.md (#13), every docs
 * TypeScript example must originate from a runnable example file so
 * the docs and the runtime stay in lockstep. Inline `\`\`\`ts` blocks
 * inside comparison code-groups (`::: code-group` ... `:::`) are
 * allowed because comparator code (zod / valibot / typebox / ajv /
 * io-ts) is non-json-tology and lives only in docs.
 *
 * Exit status:
 *   0 — under the ceiling
 *   1 — over the ceiling (a regression; new inline blocks were added
 *       without being converted)
 *
 * Ratcheting: the ceiling lives next to this script as a constant.
 * Lower it as Phase 3 conversion proceeds; never raise it.
 */

import {
  promises as fs
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  dirname, join, relative
} from 'node:path';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const DOCS_ROOT = join(REPO_ROOT, 'docs');

// Ratchet ceiling: docs/**\/*.md may carry at most this many inline ```ts
// blocks that live OUTSIDE a `::: code-group ... :::` comparator section.
// Lower as Phase 3 progresses.
const INLINE_TS_CEILING = 433;

async function listMarkdownFiles(root) {
  const out = [];
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop();
    const entries = await fs.readdir(dir, { 'withFileTypes': true });

    for (const entry of entries) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip generated assets — they are not authored docs.
        if (entry.name === '.vitepress' || entry.name === 'public' || entry.name === '_examples') {
          continue;
        }
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(full);
      }
    }
  }

  return out;
}

function countNonGroupTsBlocks(content) {
  const lines = content.split('\n');
  let inGroup = false;
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith('::: code-group')) {
      inGroup = true;
      continue;
    }
    if (inGroup && trimmed === ':::') {
      inGroup = false;
      continue;
    }
    if (!inGroup && /^```ts(\s|$)/.test(trimmed)) {
      count += 1;
    }
  }

  return count;
}

const files = await listMarkdownFiles(DOCS_ROOT);
let total = 0;
const breakdown = [];

for (const file of files) {
  const content = await fs.readFile(file, 'utf8');
  const count = countNonGroupTsBlocks(content);

  if (count > 0) {
    breakdown.push([
      relative(REPO_ROOT, file),
      count
    ]);
    total += count;
  }
}

breakdown.sort((left, right) => {
  return right[1] - left[1];
});

console.log('Inline ```ts blocks outside comparator code-groups in docs/**/*.md:');
console.log(`  total: ${total}`);
console.log(`  ceiling: ${INLINE_TS_CEILING}`);
console.log();
console.log('Top contributors:');
for (const [
  path,
  count
] of breakdown.slice(0, 15)) {
  console.log(`  ${count.toString().padStart(4)} — ${path}`);
}

if (total > INLINE_TS_CEILING) {
  console.error();
  console.error(`✗ docs inline-ts count ${total} exceeds ceiling ${INLINE_TS_CEILING}.`);
  console.error('  Either convert blocks to `<<<` includes against examples/docs/,');
  console.error('  or lower the ceiling intentionally in scripts/check-docs-includes.mjs.');
  process.exit(1);
}
console.log();
console.log(`✓ ${total} <= ${INLINE_TS_CEILING}`);
