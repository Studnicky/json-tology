/**
 * Validation benchmarks: our graph-backed registry vs TypeBox TypeCompiler.
 */

import { TypeCompiler } from '@sinclair/typebox/compiler';
import { SchemaRegistry } from '../src/schema/SchemaRegistry.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  NestedSchema, NestedSchemaTypebox, nestedValid,
  SimpleSchema, SimpleSchemaTypebox, simpleValid
} from './fixtures.js';

export function runValidateBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // Pre-compile everything before benchmarking
  const registry = new SchemaRegistry();

  registry.register(SimpleSchema);
  registry.register(NestedSchema);

  const tbSimple = TypeCompiler.Compile(SimpleSchemaTypebox);
  const tbNested = TypeCompiler.Compile(NestedSchemaTypebox);

  // Force our registry to lazily compile validators by running once
  registry.validate(SimpleSchema.$id, simpleValid);
  registry.validate(NestedSchema.$id, nestedValid);

  section('Validation — simple flat schema');

  results.push(bench('ours  (graph)     simple', () => {
    registry.validate(SimpleSchema.$id, simpleValid);
  }));

  results.push(bench('typebox TypeCompiler simple', () => {
    tbSimple.Check(simpleValid);
  }));

  section('Validation — nested schema');

  results.push(bench('ours  (graph)     nested', () => {
    registry.validate(NestedSchema.$id, nestedValid);
  }));

  results.push(bench('typebox TypeCompiler nested', () => {
    tbNested.Check(nestedValid);
  }));

  return results;
}
