#!/usr/bin/env node
/**
 * Walk each method-reference doc, locate every `::: code-group` block, and
 * append placeholder tabs for any missing comparator library. Existing tabs
 * are left untouched. Stub content is a "Limitation:" note pointing to the
 * comparisons matrix — pages where a library has genuine support can override
 * the stub with a real snippet in a follow-up edit.
 */

import {
  readFileSync, writeFileSync
} from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'node:fs';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');

const TARGET_GLOBS = [
  'docs/validation/*.md',
  'docs/composition/*.md',
  'docs/transforms/*.md',
  'docs/registry/*.md',
  'docs/value/*.md',
  'docs/serialization/*.md',
  'docs/types/*.md',
  'docs/errors/*.md'
];

const REQUIRED_LIBS = [
  {
    'lang': 'ts',
    'tag': 'Zod'
  },
  {
    'lang': 'ts',
    'tag': 'Valibot'
  },
  {
    'lang': 'ts',
    'tag': 'TypeBox'
  },
  {
    'lang': 'ts',
    'tag': 'AJV'
  },
  {
    'lang': 'py',
    'tag': 'Pydantic'
  },
  {
    'lang': 'ts',
    'tag': 'Yup'
  },
  {
    'lang': 'ts',
    'tag': 'Joi'
  },
  {
    'lang': 'ts',
    'tag': 'io-ts'
  },
  {
    'lang': 'ts',
    'tag': 'Effect Schema'
  },
  {
    'lang': 'ts',
    'tag': 'ArkType'
  },
  {
    'lang': 'ts',
    'tag': 'Runtypes'
  }
];

const STUB_NOTES = {
  'AJV': '// Limitation: feature not directly supported in AJV. See /comparisons for the matrix.',
  'ArkType': '// Limitation: feature not directly supported in ArkType. See /comparisons for the matrix.',
  'Effect Schema': '// Limitation: feature not directly supported in Effect Schema. See /comparisons for the matrix.',
  'io-ts': '// Limitation: feature not directly supported in io-ts. See /comparisons for the matrix.',
  'Joi': '// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.',
  'Pydantic': '# Limitation: feature not directly supported in Pydantic. See /comparisons for the matrix.',
  'Runtypes': '// Limitation: feature not directly supported in Runtypes. See /comparisons for the matrix.',
  'TypeBox': '// Limitation: feature not directly supported in TypeBox. See /comparisons for the matrix.',
  'Valibot': '// Limitation: feature not directly supported in Valibot. See /comparisons for the matrix.',
  'Yup': '// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.',
  'Zod': '// Limitation: feature not directly supported in Zod. See /comparisons for the matrix.'
};

function findCodeGroupBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  let start = -1;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '::: code-group') {
      start = i;
      depth = 1;
    } else if (start !== -1 && line.trim() === ':::') {
      depth--;
      if (depth === 0) {
        blocks.push({
          'end': i,
          start
        });
        start = -1;
      }
    }
  }

  return blocks;
}

function detectLibrariesInBlock(blockContent) {
  const present = new Set();
  const tabPattern = /^```\w*\s+\[([^\]]+)\]/;

  for (const line of blockContent.split('\n')) {
    const match = tabPattern.exec(line);

    if (match) {
      const tag = match[1].trim();

      // Tolerate variants like "TypeBox + Value", "Pydantic"
      for (const lib of REQUIRED_LIBS) {
        if (tag === lib.tag || tag.startsWith(`${lib.tag} `)) {
          present.add(lib.tag);
        }
      }
    }
  }

  return present;
}

function buildStubTab(lib) {
  const note = STUB_NOTES[lib.tag];

  return `\n\`\`\`${lib.lang} [${lib.tag}]\n${note}\n\`\`\`\n`;
}

function processFile(absPath) {
  const content = readFileSync(absPath, 'utf8');
  const blocks = findCodeGroupBlocks(content);

  if (blocks.length === 0) {
    return {
      'added': 0,
      'changed': false,
      'path': absPath
    };
  }

  const lines = content.split('\n');
  let added = 0;

  // Process blocks in reverse so insertion indices stay valid
  for (let blockIdx = blocks.length - 1; blockIdx >= 0; blockIdx--) {
    const {
      end, start
    } = blocks[blockIdx];
    const blockSlice = lines.slice(start, end + 1).join('\n');
    const present = detectLibrariesInBlock(blockSlice);

    // Insert each missing library just before the closing :::
    const insertion = [];

    for (const lib of REQUIRED_LIBS) {
      if (!present.has(lib.tag)) {
        insertion.push(buildStubTab(lib));
        added++;
      }
    }

    if (insertion.length > 0) {
      lines.splice(end, 0, insertion.join(''));
    }
  }

  const next = lines.join('\n');

  if (next !== content) {
    writeFileSync(absPath, next);

    return {
      added,
      'changed': true,
      'path': absPath
    };
  }

  return {
    'added': 0,
    'changed': false,
    'path': absPath
  };
}

let totalAdded = 0;
let filesChanged = 0;

for (const pattern of TARGET_GLOBS) {
  const files = globSync(pattern, { 'cwd': ROOT });

  for (const rel of files) {
    if (rel.endsWith('/index.md')) {
      continue;
    }

    const abs = resolve(ROOT, rel);
    const result = processFile(abs);

    if (result.changed) {
      filesChanged++;
      totalAdded += result.added;
      console.log(`  ${rel}  (+${result.added})`);
    }
  }
}

console.log('');
console.log(`Updated ${filesChanged} files, added ${totalAdded} comparison tabs.`);
