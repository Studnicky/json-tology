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

console.log('');
console.log('json-tology vs TypeBox — performance benchmarks');
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

// --- Summary ---
console.log('═'.repeat(80));
console.log('SUMMARY');
console.log('═'.repeat(80));

let wins = 0;
let losses = 0;

for (let i = 0; i < allResults.length - 1; i += 2) {
  const ours = allResults[i];
  const theirs = allResults[i + 1];
  const ratio = ours.opsPerSec / theirs.opsPerSec;
  const faster = ratio >= 1;

  if (faster) {
    wins++;
  } else {
    losses++;
  }
  const label = faster
    ? `✓ ${ratio.toFixed(2)}x faster`
    : `✗ ${(1 / ratio).toFixed(2)}x slower`;

  console.log(`  ${ours.name.replace(/ours\s+/u, '').padEnd(35)}  ${label}`);
}

console.log('');
console.log(`Result: ${wins} wins, ${losses} losses out of ${wins + losses} comparisons`);
console.log('');
