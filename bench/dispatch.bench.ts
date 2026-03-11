/**
 * Micro-benchmark: dispatch table vs if/else vs switch
 *
 * Tests the patterns used in our JIT normalizer and convertValue:
 *   1. if/else chain on type string
 *   2. switch on type string
 *   3. object dispatch table: HANDLERS[type](v)
 *   4. In generated check code: per-prop sequential ifs vs for-in + dispatch
 */

import { bench, section, printResults, type BenchResult } from './harness.js';

const results: BenchResult[] = [];

// ---------------------------------------------------------------------------
// Shared test data — mix of types to exercise all branches
// ---------------------------------------------------------------------------

const TYPES = ['string', 'number', 'integer', 'boolean', 'null', 'object', 'array'] as const;
type SchemaType = typeof TYPES[number];

const VALUES: Record<SchemaType, unknown> = {
  string:  'hello world',
  number:  42.5,
  integer: 7,
  boolean: true,
  null:    null,
  object:  { x: 1 },
  array:   [1, 2, 3],
};

// Rotate through all types so each call site exercises different branches
let typeIdx = 0;
function nextType(): SchemaType { return TYPES[typeIdx++ % TYPES.length]; }
function nextValue(t: SchemaType): unknown { return VALUES[t]; }

// ---------------------------------------------------------------------------
// 1. if/else chain
// ---------------------------------------------------------------------------

function dispatchIfElse(type: string, value: unknown): string {
  if (type === 'string')  return typeof value === 'string'  ? 'ok' : 'fail';
  if (type === 'number')  return typeof value === 'number'  ? 'ok' : 'fail';
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value as number) ? 'ok' : 'fail';
  if (type === 'boolean') return typeof value === 'boolean' ? 'ok' : 'fail';
  if (type === 'null')    return value === null              ? 'ok' : 'fail';
  if (type === 'object')  return typeof value === 'object' && value !== null && !Array.isArray(value) ? 'ok' : 'fail';
  if (type === 'array')   return Array.isArray(value)       ? 'ok' : 'fail';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// 2. switch statement
// ---------------------------------------------------------------------------

function dispatchSwitch(type: string, value: unknown): string {
  switch (type) {
    case 'string':  return typeof value === 'string'  ? 'ok' : 'fail';
    case 'number':  return typeof value === 'number'  ? 'ok' : 'fail';
    case 'integer': return typeof value === 'number' && Number.isInteger(value as number) ? 'ok' : 'fail';
    case 'boolean': return typeof value === 'boolean' ? 'ok' : 'fail';
    case 'null':    return value === null              ? 'ok' : 'fail';
    case 'object':  return typeof value === 'object' && value !== null && !Array.isArray(value) ? 'ok' : 'fail';
    case 'array':   return Array.isArray(value)       ? 'ok' : 'fail';
    default:        return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// 3. Object dispatch table (pre-defined functions, stable references)
// ---------------------------------------------------------------------------

const TYPE_CHECK: Record<string, (v: unknown) => boolean> = {
  string:  (v) => typeof v === 'string',
  number:  (v) => typeof v === 'number',
  integer: (v) => typeof v === 'number' && Number.isInteger(v as number),
  boolean: (v) => typeof v === 'boolean',
  null:    (v) => v === null,
  object:  (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
  array:   (v) => Array.isArray(v),
};

function dispatchTable(type: string, value: unknown): string {
  const fn = TYPE_CHECK[type];
  return fn ? (fn(value) ? 'ok' : 'fail') : 'unknown';
}

// ---------------------------------------------------------------------------
// 4. Property-level validation: sequential ifs vs for-in + dispatch
// ---------------------------------------------------------------------------

const sampleObj = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
  active: true,
};

// Simulates the current generated JIT check style (sequential per-prop ifs)
function checkSequential(v: Record<string, unknown>): boolean {
  if (typeof v['id']     !== 'number' || !Number.isInteger(v['id']))     return false;
  if (typeof v['name']   !== 'string')                                    return false;
  if (typeof v['email']  !== 'string')                                    return false;
  if (typeof v['age']    !== 'number' || !Number.isInteger(v['age']))     return false;
  if (typeof v['active'] !== 'boolean')                                   return false;
  return true;
}

// Dispatch table approach: property handlers pre-compiled, loop over props
const PROP_CHECKS: Record<string, (v: unknown) => boolean> = {
  id:     (v) => typeof v === 'number' && Number.isInteger(v as number),
  name:   (v) => typeof v === 'string',
  email:  (v) => typeof v === 'string',
  age:    (v) => typeof v === 'number' && Number.isInteger(v as number),
  active: (v) => typeof v === 'boolean',
};
const REQUIRED_KEYS = ['id', 'name', 'email', 'age', 'active'];

function checkDispatch(v: Record<string, unknown>): boolean {
  for (const k in v) {
    const fn = PROP_CHECKS[k];
    if (!fn) return false;              // additionalProperties: false
    if (!fn(v[k])) return false;
  }
  for (let i = 0; i < REQUIRED_KEYS.length; i++) {
    if (v[REQUIRED_KEYS[i]] === undefined) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Run benchmarks
// ---------------------------------------------------------------------------

section('Type dispatch: if/else vs switch vs table  (cycling all 7 types)');

results.push(bench('if/else chain', () => {
  const t = nextType();
  dispatchIfElse(t, nextValue(t));
}));

results.push(bench('switch stmt  ', () => {
  const t = nextType();
  dispatchSwitch(t, nextValue(t));
}));

results.push(bench('dispatch table', () => {
  const t = nextType();
  dispatchTable(t, nextValue(t));
}));

section('Property checking: sequential ifs vs for-in + dispatch table');

results.push(bench('sequential ifs', () => { checkSequential(sampleObj); }));
results.push(bench('dispatch table ', () => { checkDispatch(sampleObj);   }));

// Monomorphic case — always same type (best case for V8 specialization)
section('Monomorphic dispatch (always "number") — best case for each approach');

results.push(bench('if/else mono  ', () => { dispatchIfElse('number', 42); }));
results.push(bench('switch mono   ', () => { dispatchSwitch('number', 42); }));
results.push(bench('table  mono   ', () => { dispatchTable('number',  42); }));

printResults(results);

console.log('Winner:');
const [ifelse, sw, table] = results;
const fastest = [ifelse, sw, table].sort((a, b) => b.opsPerSec - a.opsPerSec)[0];
console.log(`  Polymorphic: ${fastest.name.trim()} wins`);
