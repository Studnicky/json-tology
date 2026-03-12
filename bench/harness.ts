/**
 * Minimal benchmark harness using performance.now().
 * No external dependencies.
 */

export interface BenchResult {
  'avgUs': number; // microseconds per op
  'iterations': number;
  'library': string;
  'name': string;
  'opsPerSec': number;
}

export function bench(
  name: string,
  library: string,
  fn: () => void,
  options: { 'iterations'?: number;
    'warmup'?: number } = {}
): BenchResult {
  const {
    iterations = 100_000, warmup = 1000
  } = options;

  // Warmup — let V8 JIT compile the hot path
  for (let i = 0; i < warmup; i++) {
    fn();
  }

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const elapsed = performance.now() - start;

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
  const maxName = Math.max(...results.map((r) => r.name.length));
  const maxLib = Math.max(...results.map((r) => r.library.length));

  console.log('');
  console.log('─'.repeat(90));

  const rows = results.map((r) => ({
    ...r,
    'opsStr': r.opsPerSec.toLocaleString(),
    'usStr': r.avgUs.toFixed(3)
  }));

  const maxOps = Math.max(...rows.map((r) => r.opsStr.length));

  // Group by test name and compare
  const groups = new Map<string, typeof rows>();

  for (const r of rows) {
    const group = groups.get(r.name) ?? [];

    group.push(r);
    groups.set(r.name, group);
  }

  for (const [, group] of groups) {
    const best = Math.max(...group.map((r) => r.opsPerSec));

    for (const r of group) {
      const namePad = r.name.padEnd(maxName + 2);
      const libPad = r.library.padEnd(maxLib + 2);
      const opsPad = r.opsStr.padStart(maxOps);
      const isBest = r.opsPerSec === best;
      const marker = isBest ? '✓' : ' ';
      const ratio = isBest ? '' : `  (${(best / r.opsPerSec).toFixed(2)}x slower)`;

      console.log(`  ${marker} ${libPad}  ${namePad}  ${opsPad} ops/s  (${r.usStr}µs/op)${ratio}`);
    }
    console.log('');
  }

  console.log('─'.repeat(90));
}

export function section(title: string): void {
  console.log('');
  console.log(`▶ ${title}`);
}
