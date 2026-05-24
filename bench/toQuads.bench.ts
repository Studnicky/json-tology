/**
 * toQuads ABox projection benchmarks.
 *
 * Measures the allocation-heavy ABox projection path that was previously
 * unbenchmarked. Covers three schema shapes:
 *   - flat: 5 scalar properties, no nesting
 *   - nested: 1 level of embedded object
 *   - pattern: patternProperties with regex constraints
 *
 * Run with:
 *   npx tsx bench/toQuads.bench.ts
 *
 * Or add to examples/docs/benchmarks/run.ts to include in the main report.
 */

import { JsonTology } from '../src/JsonTology.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const FlatSchema = {
  '$id': 'https://bench.example/Flat',
  'properties': {
    'age': { 'type': 'integer' },
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'name': { 'type': 'string' },
    'score': { 'type': 'number' },
    'verified': { 'type': 'boolean' }
  },
  'required': [
    'name',
    'age',
    'email',
    'score',
    'verified'
  ],
  'type': 'object'
} as const;

const NestedSchema = {
  '$id': 'https://bench.example/Nested',
  'properties': {
    'address': {
      'properties': {
        'city': { 'type': 'string' },
        'street': { 'type': 'string' },
        'zip': { 'type': 'string' }
      },
      'required': [
        'street',
        'city',
        'zip'
      ],
      'type': 'object'
    },
    'name': { 'type': 'string' }
  },
  'required': [
    'name',
    'address'
  ],
  'type': 'object'
} as const;

const PatternSchema = {
  '$id': 'https://bench.example/Pattern',
  'patternProperties': {
    '^extra_': { 'type': 'string' },
    '^meta_': { 'type': 'number' }
  },
  'properties': { 'id': { 'type': 'string' } },
  'required': ['id'],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Data fixtures
// ---------------------------------------------------------------------------

const flatData = {
  'age': 30,
  'email': 'user@example.com',
  'name': 'Alice',
  'score': 9.5,
  'verified': true
};

const nestedData = {
  'address': {
    'city': 'Springfield',
    'street': '742 Evergreen Terrace',
    'zip': '62701'
  },
  'name': 'Alice'
};

const patternData = {
  'extra_color': 'blue',
  'extra_size': 'large',
  'id': 'item-1',
  'meta_weight': 1.5
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  'baseIRI': 'https://bench.example/instances',
  'enableStrictGraph': false,
  'schemas': [
    FlatSchema,
    NestedSchema,
    PatternSchema
  ]
});

// Warm up — ensure V8 JIT compiles the hot paths before measuring.
for (let i = 0; i < 500; i++) {
  jt.toQuads(FlatSchema, flatData);
  jt.toQuads(NestedSchema, nestedData);
  jt.toQuads(PatternSchema, patternData);
}

// ---------------------------------------------------------------------------
// Bench harness (inline — no external dep)
// ---------------------------------------------------------------------------

interface BenchResult {
  'avgUs': number;
  'iterations': number;
  'label': string;
  'opsPerSec': number;
}

function bench(label: string, fn: () => void, iterations = 50_000): BenchResult {
  // Warmup
  for (let i = 0; i < 200; i++) {
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
    label,
    opsPerSec
  };
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

const results: BenchResult[] = [
  bench('toQuads flat (5 props)', () => {
    jt.toQuads(FlatSchema, flatData);
  }),
  bench('toQuads nested (1 level)', () => {
    jt.toQuads(NestedSchema, nestedData);
  }),
  bench('toQuads patternProperties', () => {
    jt.toQuads(PatternSchema, patternData);
  })
];

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

console.log('');
console.log('toQuads benchmark — ABox projection path');
console.log(`Node ${process.version}  •  ${new Date().toISOString()}`);
console.log('─'.repeat(70));

const maxLabel = Math.max(...results.map((result) => {
  return result.label.length;
}));

for (const result of results) {
  const label = result.label.padEnd(maxLabel + 2);
  const ops = result.opsPerSec.toLocaleString().padStart(12);
  const us = result.avgUs.toFixed(2).padStart(8);

  console.log(`  ${label}  ${ops} ops/s  (${us} µs/op)`);
}

console.log('─'.repeat(70));
console.log('');
