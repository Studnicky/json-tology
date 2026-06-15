/**
 * Micro-benchmark: dispatch table vs if/else vs switch
 *
 * Tests the patterns used in our JIT normalizer and convertValue:
 *   1. if/else chain on type string
 *   2. switch on type string
 *   3. object dispatch table: HANDLERS[type](v)
 *   4. In generated check code: per-prop sequential ifs vs for-in + dispatch
 */

import {
  bench, type BenchResult, printResults, section
} from './harness.js';

const results: BenchResult[] = [];

// ---------------------------------------------------------------------------
// Shared test data — mix of types to exercise all branches
// ---------------------------------------------------------------------------

const TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'null',
  'object',
  'array'
] as const;

type SchemaType = typeof TYPES[number];

const VALUES: Record<SchemaType, unknown> = {
  'array': [
    1,
    2,
    3
  ],
  'boolean': true,
  'integer': 7,
  'null': null,
  'number': 42.5,
  'object': { 'x': 1 },
  'string': 'hello world'
};

// Rotate through all types so each call site exercises different branches
let typeIdx = 0;

function nextType(): SchemaType {
  return TYPES[typeIdx++ % TYPES.length];
}

function nextValue(schemaType: SchemaType): unknown {
  return VALUES[schemaType];
}

// ---------------------------------------------------------------------------
// 1. if/else chain
// ---------------------------------------------------------------------------

function dispatchIfElse(type: string, value: unknown): string {
  if (type === 'string') {
    return typeof value === 'string' ? 'ok' : 'fail';
  }
  if (type === 'number') {
    return typeof value === 'number' ? 'ok' : 'fail';
  }
  if (type === 'integer') {
    return typeof value === 'number' && Number.isInteger(value) ? 'ok' : 'fail';
  }
  if (type === 'boolean') {
    return typeof value === 'boolean' ? 'ok' : 'fail';
  }
  if (type === 'null') {
    return value === null ? 'ok' : 'fail';
  }
  if (type === 'object') {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? 'ok' : 'fail';
  }
  if (type === 'array') {
    return Array.isArray(value) ? 'ok' : 'fail';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// 2. switch statement
// ---------------------------------------------------------------------------

function dispatchSwitch(type: string, value: unknown): string {
  switch (type) {
    case 'array': return Array.isArray(value) ? 'ok' : 'fail';
    case 'boolean': return typeof value === 'boolean' ? 'ok' : 'fail';
    case 'integer': return typeof value === 'number' && Number.isInteger(value) ? 'ok' : 'fail';
    case 'null': return value === null ? 'ok' : 'fail';
    case 'number': return typeof value === 'number' ? 'ok' : 'fail';
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value) ? 'ok' : 'fail';
    case 'string': return typeof value === 'string' ? 'ok' : 'fail';
    default: return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// 3. Object dispatch table (pre-defined functions, stable references)
// ---------------------------------------------------------------------------

const TYPE_CHECK = new Map<string, (val: unknown) => boolean>();

TYPE_CHECK.set('array', (val) => {
  return Array.isArray(val);
});
TYPE_CHECK.set('boolean', (val) => {
  return typeof val === 'boolean';
});
TYPE_CHECK.set('integer', (val) => {
  return typeof val === 'number' && Number.isInteger(val);
});
TYPE_CHECK.set('null', (val) => {
  return val === null;
});
TYPE_CHECK.set('number', (val) => {
  return typeof val === 'number';
});
TYPE_CHECK.set('object', (val) => {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
});
TYPE_CHECK.set('string', (val) => {
  return typeof val === 'string';
});

function dispatchTable(type: string, value: unknown): string {
  const fn = TYPE_CHECK.get(type);

  if (fn === undefined) {
    return 'unknown';
  }

  return fn(value) ? 'ok' : 'fail';
}

// ---------------------------------------------------------------------------
// 4. Property-level validation: sequential ifs vs for-in + dispatch
// ---------------------------------------------------------------------------

const sampleObj = {
  'active': true,
  'age': 30,
  'email': 'bastian@example.com',
  'id': 1,
  'name': 'Bastian Balthazar Bux'
};

// Simulates the current generated JIT check style (sequential per-prop ifs)
function checkSequential(obj: Record<string, unknown>): boolean {
  if (typeof obj.id !== 'number' || !Number.isInteger(obj.id)) {
    return false;
  }
  if (typeof obj.name !== 'string') {
    return false;
  }
  if (typeof obj.email !== 'string') {
    return false;
  }
  if (typeof obj.age !== 'number' || !Number.isInteger(obj.age)) {
    return false;
  }
  if (typeof obj.active !== 'boolean') {
    return false;
  }

  return true;
}

// Dispatch table approach: property handlers pre-compiled, loop over props
const PROP_CHECKS = new Map<string, (val: unknown) => boolean>();

PROP_CHECKS.set('active', (val) => {
  return typeof val === 'boolean';
});
PROP_CHECKS.set('age', (val) => {
  return typeof val === 'number' && Number.isInteger(val);
});
PROP_CHECKS.set('email', (val) => {
  return typeof val === 'string';
});
PROP_CHECKS.set('id', (val) => {
  return typeof val === 'number' && Number.isInteger(val);
});
PROP_CHECKS.set('name', (val) => {
  return typeof val === 'string';
});
const REQUIRED_KEYS = [
  'id',
  'name',
  'email',
  'age',
  'active'
];

function checkDispatch(obj: Record<string, unknown>): boolean {
  for (const key in obj) {
    const fn = PROP_CHECKS.get(key);

    // additionalProperties: false
    if (fn === undefined) {
      return false;
    }
    if (!fn(obj[key])) {
      return false;
    }
  }
  for (const REQUIRED_KEY of REQUIRED_KEYS) {
    if (obj[REQUIRED_KEY] === undefined) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Run benchmarks
// ---------------------------------------------------------------------------

section('Type dispatch: if/else vs switch vs table  (cycling all 7 types)');

const ifelseResult = bench('if/else chain', 'pattern', () => {
  const schemaType = nextType();

  return dispatchIfElse(schemaType, nextValue(schemaType));
});

results.push(ifelseResult);

const switchResult = bench('switch stmt  ', 'pattern', () => {
  const schemaType = nextType();

  return dispatchSwitch(schemaType, nextValue(schemaType));
});

results.push(switchResult);

const tableResult = bench('dispatch table', 'pattern', () => {
  const schemaType = nextType();

  return dispatchTable(schemaType, nextValue(schemaType));
});

results.push(tableResult);

section('Property checking: sequential ifs vs for-in + dispatch table');

const seqResult = bench('sequential ifs', 'pattern', () => {
  return checkSequential(sampleObj);
});

results.push(seqResult);

const dispResult = bench('dispatch table ', 'pattern', () => {
  return checkDispatch(sampleObj);
});

results.push(dispResult);

// Monomorphic case — always same type (best case for V8 specialization)
section('Monomorphic dispatch (always "number") — best case for each approach');

const monoIfelseResult = bench('if/else mono  ', 'pattern', () => {
  return dispatchIfElse('number', 42);
});

results.push(monoIfelseResult);

const monoSwitchResult = bench('switch mono   ', 'pattern', () => {
  return dispatchSwitch('number', 42);
});

results.push(monoSwitchResult);

const monoTableResult = bench('table  mono   ', 'pattern', () => {
  return dispatchTable('number', 42);
});

results.push(monoTableResult);

printResults(results);

console.log('Winner:');
const fastest = [
  ifelseResult,
  switchResult,
  tableResult
].sort((first, second) => {
  return second.opsPerSec - first.opsPerSec;
})[0];

console.log(`  Polymorphic: ${fastest.name.trim()} wins`);
