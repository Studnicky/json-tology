/**
 * check-docs-includes.mjs
 *
 * Scans `docs/**\/*.md` for inline `\`\`\`ts` code blocks that should
 * have been converted to a VitePress `<<<` include directive pointing
 * at a runnable example file in `examples/docs/`.
 *
 * Per the architecture invariant in ARCHITECTURE.md (#13), every docs
 * TypeScript example must originate from a runnable example file so
 * the docs and the runtime stay in lockstep.
 *
 * Two kinds of inline `\`\`\`ts` blocks are exempt from the count:
 *
 *   1. Blocks inside a `::: code-group` ... `:::` block. These exist
 *      to compare json-tology with peer libraries (zod / valibot /
 *      typebox / ajv / io-ts) and the comparator code legitimately
 *      lives only in docs.
 *
 *   2. Blocks immediately preceded by an HTML comment of the form
 *      `<!-- inline-ts-ok: <reason> -->`. The marker carries a human
 *      rationale for why the block cannot be a runnable example file —
 *      e.g. `demonstrates removed/legacy <api>`, `pseudocode signature`,
 *      `compile-time import rename, not a runnable expression`, etc.
 *      Migration pages use this marker for every block: each before/after
 *      pair references a removed API and cannot be compiled as-is.
 *
 * There are no file-pattern exemptions. Every file in docs/ is subject
 * to the ceiling; blocks that cannot be runnable carry the inline-ts-ok
 * marker with an explicit rationale.
 *
 * Exit status:
 *   0 — under the ceiling
 *   1 — over the ceiling (a regression; new inline blocks were added
 *       without being converted)
 *
 * Ratcheting: the ceiling lives next to this script as a constant.
 * Lower it as conversion progresses; never raise it.
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
// blocks that are NOT inside a code-group and NOT carrying an
// `inline-ts-ok` exemption marker. There are no file-pattern exemptions —
// every block in every file must be either a `<<<` include or marked.
const INLINE_TS_CEILING = 0;

// No file-pattern exemptions. All migration pages have been processed:
// every inline block either carries an `inline-ts-ok` marker (with rationale
// naming the removed/legacy API) or was converted to a runnable example file.
const EXEMPT_FILE_PATTERNS = [];

const INLINE_OK_MARKER = /<!--\s*inline-ts-ok:\s*([^>]*?)\s*-->/;

async function listMarkdownFiles(root) {
  const out = [];
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop();
    const entries = await fs.readdir(dir, { 'withFileTypes': true });

    for (const entry of entries) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip generated assets and internal planning material — they are not
        // authored user docs. `plans/` holds development planning artifacts
        // (excluded from the published site via `srcExclude` in the VitePress
        // config); its before/after code references removed/in-progress APIs
        // and is not subject to the runnable-example invariant.
        if (
          entry.name === '.vitepress'
          || entry.name === 'public'
          || entry.name === '_examples'
          || entry.name === 'plans'
        ) {
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
  let pendingExemption = false;

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith('::: code-group')) {
      inGroup = true;
      pendingExemption = false;
      continue;
    }
    if (inGroup && trimmed === ':::') {
      inGroup = false;
      continue;
    }

    // Track inline-ok exemption markers immediately preceding a ts block.
    if (!inGroup && INLINE_OK_MARKER.test(trimmed)) {
      pendingExemption = true;
      continue;
    }

    if (!inGroup && /^```ts(\s|$)/.test(trimmed)) {
      if (pendingExemption) {
        pendingExemption = false;
        continue;
      }
      count += 1;
      continue;
    }

    // Blank lines preserve a pending exemption; any non-blank non-fence
    // line clears it. Markers must be the IMMEDIATELY-preceding non-blank
    // line before the ts fence so reviewers can see the rationale next to
    // the code it exempts.
    if (trimmed !== '') {
      pendingExemption = false;
    }
  }

  return count;
}

function isExemptFile(relPath) {
  for (const pattern of EXEMPT_FILE_PATTERNS) {
    if (pattern.test(relPath)) {
      return true;
    }
  }

  return false;
}

const files = await listMarkdownFiles(DOCS_ROOT);
let total = 0;
const breakdown = [];

for (const file of files) {
  const relPath = relative(REPO_ROOT, file);

  if (isExemptFile(relPath)) {
    continue;
  }

  const content = await fs.readFile(file, 'utf8');
  const count = countNonGroupTsBlocks(content);

  if (count > 0) {
    breakdown.push([
      relPath,
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
console.log('Exemptions:');
console.log('  - blocks inside `::: code-group ... :::`');
console.log('  - blocks preceded by `<!-- inline-ts-ok: <reason> -->`');
console.log('  - files matching:');
for (const pattern of EXEMPT_FILE_PATTERNS) {
  console.log(`      ${pattern}`);
}
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
  console.error('  add `<!-- inline-ts-ok: <reason> -->` immediately above the block');
  console.error('  if it genuinely cannot be runnable, or lower the ceiling intentionally');
  console.error('  in scripts/check-docs-includes.mjs.');
  process.exit(1);
}
console.log();
console.log(`✓ ${total} <= ${INLINE_TS_CEILING}`);
