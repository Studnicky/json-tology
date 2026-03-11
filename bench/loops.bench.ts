/**
 * Loop benchmark: for-in / for-of / indexed Object.entries / indexed Object.keys
 */
import { bench, section, printResults, type BenchResult } from './harness.js';

const results: BenchResult[] = [];

const obj = { id: 1, name: 'Alice', email: 'alice@example.com', age: 30, active: true, role: 'admin', score: 99 };
const entries = Object.entries(obj);
const keys    = Object.keys(obj);
let sink = 0;

section('Object iteration patterns');

results.push(bench('for...in', () => {
  for (const k in obj) sink += (obj as any)[k] ? 1 : 0;
}));

results.push(bench('for...of Object.entries() (fresh)', () => {
  for (const [k, v] of Object.entries(obj)) sink += v ? 1 : 0;
}));

results.push(bench('for...of Object.keys() (fresh)', () => {
  for (const k of Object.keys(obj)) sink += (obj as any)[k] ? 1 : 0;
}));

results.push(bench('indexed Object.entries() (fresh)', () => {
  const e = Object.entries(obj);
  for (let i = 0; i < e.length; i++) sink += e[i][1] ? 1 : 0;
}));

results.push(bench('indexed Object.entries() (cached)', () => {
  for (let i = 0; i < entries.length; i++) sink += entries[i][1] ? 1 : 0;
}));

results.push(bench('indexed Object.keys() (cached)', () => {
  for (let i = 0; i < keys.length; i++) sink += (obj as any)[keys[i]] ? 1 : 0;
}));

printResults(results);
console.log('(sink=' + sink + ' — prevents dead-code elimination)');
