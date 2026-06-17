/**
 * Minimal benchmark harness using performance.now().
 * No external dependencies.
 */

export interface BenchResult {
  // microseconds per op
  'avgUs': number;
  'iterations': number;
  'library': string;
  'name': string;
  'opsPerSec': number;
}

/**
 * Module-level volatile sink used to defeat V8 dead-code elimination (DCE).
 *
 * V8 can elide an entire call to a pure, side-effect-free function when its
 * return value is discarded — producing fictitious sub-nanosecond measurements.
 * Assigning the return value of every bench closure to `_blackhole` forces V8
 * to materialise the return value and prevents it from proving the call dead.
 * The guard below forces a read of `_blackhole` after the loop in a
 * Math.random()-gated branch: V8 cannot constant-fold Math.random(), so it
 * cannot determine the branch is unreachable and must keep the assignment live.
 * This technique is equivalent to the `__attribute__((noinline))` / escape
 * pattern used in C++ micro-benchmark harnesses (e.g. Google Benchmark).
 */
let _blackhole: unknown;

export function bench(
  name: string,
  library: string,
  fn: () => unknown,
  options: { 'iterations'?: number;
    'warmup'?: number } = {}
): BenchResult {
  const {
    iterations = 100_000, warmup = 1000
  } = options;

  // Warmup — let V8 JIT compile the hot path. Sink the result to defeat DCE.
  for (let i = 0; i < warmup; i++) {
    _blackhole = fn();
  }

  const start = performance.now();

  // Measured loop. Assign each result to the module-level sink so V8 cannot
  // elide the call even when the measured function is pure and cheap.
  for (let i = 0; i < iterations; i++) {
    _blackhole = fn();
  }
  const elapsed = performance.now() - start;

  // Force a read of _blackhole via an unpredictable branch. Math.random() is
  // not constant-foldable, so V8 must keep the entire sink assignment chain
  // live. Without this read, a sufficiently aggressive optimiser could still
  // treat the write-only _blackhole as dead and remove the assignments.
  if (_blackhole === undefined && Math.random() < 0) {
    throw new Error(String(_blackhole));
  }

  const avgMs = elapsed / iterations;
  const avgUs = avgMs * 1000;
  const opsPerSec = Math.round(1 / (avgMs / 1000));

  return {
    avgUs,
    iterations,
    library,
    name,
    opsPerSec
  };
}

export function printResults(results: BenchResult[]): void {
  const maxName = Math.max(...results.map((result) => {
    return result.name.length;
  }));
  const maxLib = Math.max(...results.map((result) => {
    return result.library.length;
  }));

  console.log('');
  console.log('─'.repeat(90));

  const rows = results.map((result) => {
    return {
      ...result,
      'opsStr': result.opsPerSec.toLocaleString(),
      'usStr': result.avgUs.toFixed(3)
    };
  });

  const maxOps = Math.max(...rows.map((row) => {
    return row.opsStr.length;
  }));

  // Group by test name and compare
  const groups = new Map<string, typeof rows>();

  for (const row of rows) {
    const group = groups.get(row.name) ?? [];

    group.push(row);
    groups.set(row.name, group);
  }

  for (const [
    , group
  ] of groups) {
    const best = Math.max(...group.map((row) => {
      return row.opsPerSec;
    }));

    for (const row of group) {
      const namePad = row.name.padEnd(maxName + 2);
      const libPad = row.library.padEnd(maxLib + 2);
      const opsPad = row.opsStr.padStart(maxOps);
      const isBest = row.opsPerSec === best;
      const marker = isBest ? '+' : ' ';
      const ratio = isBest ? '' : `  (${(best / row.opsPerSec).toFixed(2)}x slower)`;

      console.log(`  ${marker} ${libPad}  ${namePad}  ${opsPad} ops/s  (${row.usStr}us/op)${ratio}`);
    }
    console.log('');
  }

  console.log('─'.repeat(90));
}

export function section(title: string): void {
  console.log('');
  console.log(`> ${title}`);
}
