/**
 * Benchmark runner — executes all suites and prints a consolidated report.
 *
 * Usage:
 *   npm run bench           — run all benchmarks (console output)
 *   npm run bench:report    — run all benchmarks and write examples/docs/benchmarks/results/latest.md
 *   npm run bench:flame     — run with 0x flame graph profiling
 */

import {
  cpus, platform, release
} from 'node:os';
import {
  mkdirSync, writeFileSync
} from 'node:fs';
import {
  dirname, resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BenchResult, printResults
} from './harness.js';
import { runValidateBench } from './validate.bench.js';
import { runCoerceBench } from './coerce.bench.js';
import { runValueOpsBench } from './valueOps.bench.js';
import { runCompiledBench } from './compiled.bench.js';
import { runInstantiateBench } from './instantiate.bench.js';
import { runTransformBench } from './transform.bench.js';
import { runComposeBench } from './compose.bench.js';
import { runSerializeBench } from './serialize.bench.js';
import { runRegistryBench } from './registry.bench.js';

interface SuiteEntry {
  'family': string;
  'name': string;
  'results': BenchResult[];
}

const REPORT_FLAG = '--report';
const isReport = process.argv.includes(REPORT_FLAG);

console.log('');
console.log('json-tology vs TypeBox vs AJV vs Zod vs Valibot vs io-ts — performance benchmarks');
console.log(`Node ${process.version}  •  ${new Date().toISOString()}`);

const suites: SuiteEntry[] = [
  {
    'family': 'Validation',
    'name': 'validate',
    'results': runValidateBench()
  },
  {
    'family': 'Instantiation',
    'name': 'instantiate',
    'results': runInstantiateBench()
  },
  {
    'family': 'Coerce',
    'name': 'coerce',
    'results': runCoerceBench()
  },
  {
    'family': 'Value operations',
    'name': 'valueOps',
    'results': runValueOpsBench()
  },
  {
    'family': 'Transforms',
    'name': 'transform',
    'results': runTransformBench()
  },
  {
    'family': 'Composition',
    'name': 'compose',
    'results': runComposeBench()
  },
  {
    'family': 'Serialization',
    'name': 'serialize',
    'results': runSerializeBench()
  },
  {
    'family': 'Registry',
    'name': 'registry',
    'results': runRegistryBench()
  },
  {
    'family': 'Compiled vs Interpreted',
    'name': 'compiled',
    'results': runCompiledBench()
  }
];

const allResults: BenchResult[] = [];

for (const suite of suites) {
  printResults(suite.results);
  allResults.push(...suite.results);
}

// ---------------------------------------------------------------------------
// Console summary
// ---------------------------------------------------------------------------

const testGroups = new Map<string, BenchResult[]>();

for (const result of allResults) {
  const group = testGroups.get(result.name) ?? [];

  group.push(result);
  testGroups.set(result.name, group);
}

console.log('='.repeat(90));
console.log('SUMMARY — json-tology vs each comparator (raw ratios; no win/loss labels)');
console.log('='.repeat(90));

for (const [
  testName,
  group
] of testGroups) {
  const ours = group.find((result) => {
    return result.library === 'json-tology';
  });

  if (ours === undefined) {
    continue;
  }

  for (const other of group) {
    if (other.library === 'json-tology') {
      continue;
    }
    const ratio = ours.opsPerSec / other.opsPerSec;
    const comparison = ratio >= 1
      ? `${ratio.toFixed(2)}x faster`
      : `${(1 / ratio).toFixed(2)}x slower`;

    console.log(`  ${testName.padEnd(25)} vs ${other.library.padEnd(15)} ${comparison}`);
  }
}

console.log('');

// ---------------------------------------------------------------------------
// Markdown report (--report mode)
// ---------------------------------------------------------------------------

if (isReport) {
  writeMarkdownReport(suites, allResults);
}

function writeMarkdownReport(
  suiteList: SuiteEntry[],
  flatResults: BenchResult[]
): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(here, 'results');
  const outPath = resolve(outDir, 'latest.md');

  mkdirSync(outDir, { 'recursive': true });

  const cpuModel = cpus()[0]?.model ?? 'unknown';
  const lines: string[] = [];

  // Compute one library list per suite. The "Compiled vs Interpreted" suite
  // benchmarks two internal execution paths (`compiled`, `interpreted`)
  // rather than third-party libraries — those names should not bleed into
  // unrelated scenario tables. Per-suite library sets keep each table
  // honest about what's being compared.
  const librariesBySuite = new Map<string, string[]>();

  for (const suite of suiteList) {
    const libs = new Set<string>();

    for (const result of suite.results) {
      libs.add(result.library);
    }
    librariesBySuite.set(suite.name, [
      'json-tology',
      ...[...libs].filter((library) => {
        return library !== 'json-tology';
      }).sort()
    ]);
  }

  lines.push('# json-tology benchmarks — latest run');
  lines.push('');
  lines.push('Generated by `npm run bench:report` from `examples/docs/benchmarks/run.ts`. Numbers move with hardware; treat as a directional snapshot, not absolutes.');
  lines.push('');
  lines.push('Every per-scenario table lists every comparator we benchmark against. `N/A` means the library does not implement that scenario\'s surface (e.g. AJV does not coerce, JSON.stringify is not a validator). We do not assign WIN / LOSS labels — the raw `ops/s`, `ns/op`, and ratio columns are the data.');
  lines.push('');
  lines.push('## Environment');
  lines.push('');
  lines.push(`- Date: ${new Date().toISOString()}`);
  lines.push(`- Node: ${process.version}`);
  lines.push(`- OS: ${platform()} ${release()}`);
  lines.push(`- CPU: ${cpuModel}`);
  lines.push('');

  // Per-family tables
  for (const suite of suiteList) {
    lines.push(`## ${suite.family}`);
    lines.push('');
    const groups = new Map<string, BenchResult[]>();

    for (const result of suite.results) {
      const group = groups.get(result.name) ?? [];

      group.push(result);
      groups.set(result.name, group);
    }
    const libraryOrder = librariesBySuite.get(suite.name) ?? ['json-tology'];

    for (const [
      scenarioName,
      group
    ] of groups) {
      const byLibrary = new Map<string, BenchResult>();

      for (const result of group) {
        byLibrary.set(result.library, result);
      }
      const ours = byLibrary.get('json-tology');

      lines.push(`### ${scenarioName}`);
      lines.push('');
      lines.push('| Library | ops/s | ns/op | json-tology vs this |');
      lines.push('| - | - | - | - |');
      for (const library of libraryOrder) {
        const result = byLibrary.get(library);

        if (result === undefined) {
          lines.push(`| ${library} | N/A | N/A | N/A |`);
          continue;
        }
        const ops = result.opsPerSec.toLocaleString();
        const ns = (result.avgUs * 1000).toFixed(0);
        let comparison: string;

        if (library === 'json-tology' || ours === undefined) {
          comparison = '-';
        } else {
          const ratio = ours.opsPerSec / result.opsPerSec;

          comparison = ratio >= 1
            ? `${ratio.toFixed(2)}x faster`
            : `${(1 / ratio).toFixed(2)}x slower`;
        }
        lines.push(`| ${library} | ${ops} | ${ns} | ${comparison} |`);
      }
      lines.push('');
    }
  }

  // Where we have work to do — scenarios > 5x slower than median comparator
  lines.push('## Where we have work to do');
  lines.push('');
  lines.push('Scenarios where json-tology is more than 5x slower than the median comparator:');
  lines.push('');

  const issues: string[] = [];
  const groupsByName = new Map<string, BenchResult[]>();

  for (const result of flatResults) {
    const group = groupsByName.get(result.name) ?? [];

    group.push(result);
    groupsByName.set(result.name, group);
  }

  for (const [
    scenarioName,
    group
  ] of groupsByName) {
    const ours = group.find((result) => {
      return result.library === 'json-tology';
    });

    if (ours === undefined) {
      continue;
    }
    const others = group.filter((result) => {
      return result.library !== 'json-tology';
    });

    if (others.length === 0) {
      continue;
    }
    const sorted = [...others].sort((first, second) => {
      return first.opsPerSec - second.opsPerSec;
    });
    const medianOps = sorted[Math.floor(sorted.length / 2)].opsPerSec;
    const ratio = medianOps / ours.opsPerSec;

    if (ratio >= 5) {
      issues.push(`- \`${scenarioName}\`: ${ratio.toFixed(2)}x slower than median comparator`);
    }
  }

  if (issues.length === 0) {
    lines.push('No scenarios are more than 5x slower than the median comparator.');
  } else {
    lines.push(...issues);
  }
  lines.push('');

  lines.push('## Reproduce');
  lines.push('');
  lines.push('```bash');
  lines.push('npm install');
  lines.push('npm run bench:report');
  lines.push('```');
  lines.push('');
  lines.push('Bench numbers move with hardware. The values committed here came from the developer machine listed in Environment. CI runs are uploaded as workflow artifacts (see `.github/workflows/bench.yml`).');
  lines.push('');

  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Markdown report written: ${outPath}`);
}
