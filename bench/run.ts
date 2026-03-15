/**
 * Benchmark runner — executes all suites and prints a consolidated report.
 *
 * Usage:
 *   npm run bench           — run all benchmarks
 *   npm run bench:flame     — run with 0x flame graph profiling
 */

import {
  type BenchResult, printResults
} from './harness.js';
import { runValidateBench } from './validate.bench.js';
import { runValueParseBench } from './valueParse.bench.js';
import { runValueOpsBench } from './valueOps.bench.js';
import { runCompiledBench } from './compiled.bench.js';

console.log('');
console.log('json-tology vs TypeBox vs AJV vs Zod — performance benchmarks');
console.log(`Node ${process.version}  •  ${new Date().toISOString()}`);

const allResults: BenchResult[] = [];

// --- Validation ---
const validateResults = runValidateBench();

printResults(validateResults);
allResults.push(...validateResults);

// --- Value.parse pipeline ---
const parseResults = runValueParseBench();

printResults(parseResults);
allResults.push(...parseResults);

// --- Value ops ---
const opsResults = runValueOpsBench();

printResults(opsResults);
allResults.push(...opsResults);

// --- Compiled vs Interpreted ---
const compiledResults = runCompiledBench();

printResults(compiledResults);
allResults.push(...compiledResults);

// --- Summary ---
console.log('='.repeat(90));
console.log('SUMMARY — json-tology vs each competitor');
console.log('='.repeat(90));

// Group results by test name
const testGroups = new Map<string, BenchResult[]>();

for (const result of allResults) {
  const group = testGroups.get(result.name) ?? [];

  group.push(result);
  testGroups.set(result.name, group);
}

const scorecard: Record<string, { 'losses': number;
  'ties': number
  'wins': number; }> = {};

for (const [
  _testName,
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
      label = `+ ${ratio.toFixed(2)}x faster`;
    } else if (ratio <= 0.95) {
      label = `- ${(1 / ratio).toFixed(2)}x slower`;
    } else {
      label = '~ comparable';
    }

    if (ratio >= 1.05) {
      scorecard[other.library].wins++;
    } else if (ratio <= 0.95) {
      scorecard[other.library].losses++;
    } else {
      scorecard[other.library].ties++;
    }

    console.log(`  ${_testName.padEnd(25)} vs ${other.library.padEnd(15)} ${label}`);
  }
}

console.log('');
for (const [
  lib,
  score
] of Object.entries(scorecard)) {
  console.log(`  vs ${lib}: ${String(score.wins)}W ${String(score.ties)}T ${String(score.losses)}L`);
}
console.log('');
