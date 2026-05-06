/**
 * Benchmark runner — executes all suites and prints a consolidated report.
 *
 * Usage:
 *   npm run bench           — run all benchmarks (console output)
 *   npm run bench:report    — run all benchmarks and write bench/results/latest.md
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

interface ScorecardEntry {
  'losses': number;
  'ties': number;
  'wins': number;
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

const scorecard: Record<string, ScorecardEntry> = {};

console.log('='.repeat(90));
console.log('SUMMARY — json-tology vs each competitor');
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

    scorecard[other.library] ??= {
      'losses': 0,
      'ties': 0,
      'wins': 0
    };

    const ratio = ours.opsPerSec / other.opsPerSec;
    let label: string;

    if (ratio >= 1.05) {
      label = `WIN  ${ratio.toFixed(2)}x faster`;
    } else if (ratio <= 0.95) {
      label = `LOSS ${(1 / ratio).toFixed(2)}x slower`;
    } else {
      label = 'EVEN comparable';
    }

    if (ratio >= 1.05) {
      scorecard[other.library].wins++;
    } else if (ratio <= 0.95) {
      scorecard[other.library].losses++;
    } else {
      scorecard[other.library].ties++;
    }

    console.log(`  ${testName.padEnd(25)} vs ${other.library.padEnd(15)} ${label}`);
  }
}

console.log('');
for (const [
  lib,
  score
] of Object.entries(scorecard)) {
  const total = score.wins + score.ties + score.losses;
  const ratio = total === 0 ? '0%' : `${((score.wins / total) * 100).toFixed(0)}%`;

  console.log(`  vs ${lib.padEnd(18)}: ${String(score.wins)}W ${String(score.ties)}T ${String(score.losses)}L  (win rate ${ratio})`);
}
console.log('');

// ---------------------------------------------------------------------------
// Markdown report (--report mode)
// ---------------------------------------------------------------------------

if (isReport) {
  writeMarkdownReport(suites, allResults, scorecard);
}

function writeMarkdownReport(
  suiteList: SuiteEntry[],
  flatResults: BenchResult[],
  scorecardOut: Record<string, ScorecardEntry>
): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(here, 'results');
  const outPath = resolve(outDir, 'latest.md');

  mkdirSync(outDir, { 'recursive': true });

  const cpuModel = cpus()[0]?.model ?? 'unknown';
  const lines: string[] = [];

  lines.push('# json-tology benchmarks — latest run');
  lines.push('');
  lines.push('Generated by `npm run bench:report` from `bench/run.ts`. Numbers move with hardware; treat as a directional snapshot, not absolutes.');
  lines.push('');
  lines.push('## Environment');
  lines.push('');
  lines.push(`- Date: ${new Date().toISOString()}`);
  lines.push(`- Node: ${process.version}`);
  lines.push(`- OS: ${platform()} ${release()}`);
  lines.push(`- CPU: ${cpuModel}`);
  lines.push('');
  lines.push('## Scorecard');
  lines.push('');
  lines.push('| Comparator | Wins | Ties | Losses | Win rate |');
  lines.push('| - | - | - | - | - |');
  for (const [
    lib,
    score
  ] of Object.entries(scorecardOut)) {
    const total = score.wins + score.ties + score.losses;
    const winRate = total === 0 ? '0%' : `${((score.wins / total) * 100).toFixed(0)}%`;

    lines.push(`| ${lib} | ${String(score.wins)} | ${String(score.ties)} | ${String(score.losses)} | ${winRate} |`);
  }
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
    for (const [
      scenarioName,
      group
    ] of groups) {
      const ours = group.find((result) => {
        return result.library === 'json-tology';
      });

      lines.push(`### ${scenarioName}`);
      lines.push('');
      if (ours === undefined) {
        lines.push('Unique to json-tology — no head-to-head comparator.');
        lines.push('');
        lines.push('| Library | ops/s | ns/op |');
        lines.push('| - | - | - |');
        for (const result of group) {
          lines.push(`| ${result.library} | ${result.opsPerSec.toLocaleString()} | ${(result.avgUs * 1000).toFixed(0)} |`);
        }
        lines.push('');
        continue;
      }

      lines.push('| Library | ops/s | ns/op | json-tology vs this | Status |');
      lines.push('| - | - | - | - | - |');
      for (const result of group) {
        const ratio = ours.opsPerSec / result.opsPerSec;
        let status: string;
        let comparison: string;

        if (result.library === 'json-tology') {
          status = '-';
          comparison = '-';
        } else if (ratio >= 1.05) {
          status = 'WIN';
          comparison = `${ratio.toFixed(2)}x faster`;
        } else if (ratio <= 0.95) {
          status = 'LOSS';
          comparison = `${(1 / ratio).toFixed(2)}x slower`;
        } else {
          status = 'EVEN';
          comparison = 'comparable';
        }

        lines.push(`| ${result.library} | ${result.opsPerSec.toLocaleString()} | ${(result.avgUs * 1000).toFixed(0)} | ${comparison} | ${status} |`);
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
