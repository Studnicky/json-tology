/**
 * Loop benchmark: for-in / for-of / indexed Object.entries / indexed Object.keys
 */
import {
  bench, type BenchResult, printResults, section
} from './harness.js';

const results: BenchResult[] = [];

const obj = {
  'active': true,
  'age': 30,
  'email': 'alice@example.com',
  'id': 1,
  'name': 'Alice',
  'role': 'admin',
  'score': 99
};
const entries = Object.entries(obj);
const keys = Object.keys(obj);
let sink = 0;

section('Object iteration patterns');

results.push(bench('for...in', 'native', () => {
  for (const k in obj) {
    sink += (obj as any)[k] ? 1 : 0;
  }
}));

results.push(bench('for...of Object.entries() (fresh)', 'native', () => {
  for (const [
    k,
    v
  ] of Object.entries(obj)) {
    sink += v ? 1 : 0;
  }
}));

results.push(bench('for...of Object.keys() (fresh)', 'native', () => {
  for (const k of Object.keys(obj)) {
    sink += (obj as any)[k] ? 1 : 0;
  }
}));

results.push(bench('indexed Object.entries() (fresh)', 'native', () => {
  const e = Object.entries(obj);

  for (const element of e) {
    sink += element[1] ? 1 : 0;
  }
}));

results.push(bench('indexed Object.entries() (cached)', 'native', () => {
  for (const entry of entries) {
    sink += entry[1] ? 1 : 0;
  }
}));

results.push(bench('indexed Object.keys() (cached)', 'native', () => {
  for (const key of keys) {
    sink += (obj as any)[key] ? 1 : 0;
  }
}));

printResults(results);
console.log(`(sink=${sink} — prevents dead-code elimination)`);
