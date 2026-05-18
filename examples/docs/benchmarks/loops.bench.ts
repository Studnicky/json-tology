/**
 * Loop benchmark: for-in / for-of / indexed Object.entries / indexed Object.keys
 */
import {
  bench, type BenchResult, printResults, section
} from './harness.js';

const results: BenchResult[] = [];

const obj: Record<string, boolean | number | string> = {
  'active': true,
  'age': 30,
  'email': 'bastian@example.com',
  'id': 1,
  'name': 'Bastian Balthazar Bux',
  'role': 'admin',
  'score': 99
};
const entries = Object.entries(obj);
const keys = Object.keys(obj);
let sink = 0;

section('Object iteration patterns');

const forInResult = bench('for...in', 'native', () => {
  for (const key in obj) {
    sink += String(obj[key]).length > 0 ? 1 : 0;
  }
});

results.push(forInResult);

const freshEntriesResult = bench('for...of Object.entries() (fresh)', 'native', () => {
  for (const [
    _,
    value
  ] of Object.entries(obj)) {
    sink += String(value).length > 0 ? 1 : 0;
  }
});

results.push(freshEntriesResult);

const freshKeysResult = bench('for...of Object.keys() (fresh)', 'native', () => {
  for (const key of Object.keys(obj)) {
    sink += String(obj[key]).length > 0 ? 1 : 0;
  }
});

results.push(freshKeysResult);

const indexedFreshResult = bench('indexed Object.entries() (fresh)', 'native', () => {
  const freshEntries = Object.entries(obj);

  for (const element of freshEntries) {
    sink += String(element[1]).length > 0 ? 1 : 0;
  }
});

results.push(indexedFreshResult);

const cachedEntriesResult = bench('indexed Object.entries() (cached)', 'native', () => {
  for (const entry of entries) {
    sink += String(entry[1]).length > 0 ? 1 : 0;
  }
});

results.push(cachedEntriesResult);

const cachedKeysResult = bench('indexed Object.keys() (cached)', 'native', () => {
  for (const key of keys) {
    sink += String(obj[key]).length > 0 ? 1 : 0;
  }
});

results.push(cachedKeysResult);

printResults(results);
console.log(`(sink=${String(sink)} — prevents dead-code elimination)`);
