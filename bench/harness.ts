/**
 * Minimal benchmark harness using performance.now().
 * No external dependencies.
 */

export interface BenchResult {
  'avgUs': number; // microseconds per op
  'iterations': number;
  'name': string;
  'opsPerSec': number;
}

export function bench(
  name: string,
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
    name,
    opsPerSec
  };
}

export function printResults(results: BenchResult[]): void {
  const maxName = Math.max(...results.map((r) => {
    return r.name.length;
  }));

  // Group by pairs for comparison ratios
  console.log('');
  console.log('─'.repeat(80));

  const rows = results.map((r) => {
    return {
      ...r,
      'opsStr': r.opsPerSec.toLocaleString(),
      'usStr': r.avgUs.toFixed(3)
    };
  });

  const maxOps = Math.max(...rows.map((r) => {
    return r.opsStr.length;
  }));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const namePad = r.name.padEnd(maxName + 2);
    const opsPad = r.opsStr.padStart(maxOps);
    let ratio = '';

    // If adjacent pair (our vs typebox), show ratio
    if (i % 2 === 1) {
      const prev = rows[i - 1];
      const x = (r.opsPerSec / prev.opsPerSec).toFixed(2);
      const faster = r.opsPerSec > prev.opsPerSec;

      ratio = faster ? `  ✓ typebox ${x}x faster` : `  ✓ ours ${(prev.opsPerSec / r.opsPerSec).toFixed(2)}x faster`;
    }

    console.log(`  ${namePad}  ${opsPad} ops/s  (${r.usStr}µs/op)${ratio}`);
  }

  console.log('─'.repeat(80));
  console.log('');
}

export function section(title: string): void {
  console.log('');
  console.log(`▶ ${title}`);
}
