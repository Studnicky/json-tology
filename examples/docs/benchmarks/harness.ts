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
