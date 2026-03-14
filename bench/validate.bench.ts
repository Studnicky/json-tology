/**
 * Validation benchmarks: json-tology vs TypeBox vs AJV vs Zod.
 */

import { TypeCompiler } from '@sinclair/typebox/compiler';
import { SchemaRegistry } from '../src/modules/registry/SchemaRegistry.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  AddressSchema, ajvValidateNested, ajvValidateSimple,
  CustomerSchema, NestedSchema,
  NestedSchemaTypebox, NestedSchemaZod, nestedValid, OrderItemSchema,
  simpleInvalid, SimpleSchema, SimpleSchemaTypebox, SimpleSchemaZod, simpleValid
} from './fixtures.js';

export function runValidateBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // Pre-compile everything
  const registry = new SchemaRegistry();

  registry.register(SimpleSchema);
  registry.register(AddressSchema);
  registry.register(CustomerSchema);
  registry.register(OrderItemSchema);
  registry.register(NestedSchema);

  const tbSimple = TypeCompiler.Compile(SimpleSchemaTypebox);
  const tbNested = TypeCompiler.Compile(NestedSchemaTypebox);

  // Force lazy compilation
  registry.validate(SimpleSchema.$id, simpleValid);
  registry.validate(NestedSchema.$id, nestedValid);

  // ── Simple valid ──────────────────────────────────────────────────────────

  section('Validation — simple flat schema (valid data)');

  results.push(bench('simple valid', 'json-tology', () => {
    registry.validate(SimpleSchema.$id, simpleValid);
  }));


  results.push(bench('simple valid', 'typebox', () => {
    tbSimple.Check(simpleValid);
  }));

  results.push(bench('simple valid', 'ajv', () => {
    ajvValidateSimple(simpleValid);
  }));

  results.push(bench('simple valid', 'zod', () => {
    SimpleSchemaZod.safeParse(simpleValid);
  }));

  // ── Simple invalid ────────────────────────────────────────────────────────

  section('Validation — simple flat schema (invalid data, error collection)');

  results.push(bench('simple invalid', 'json-tology', () => {
    registry.validate(SimpleSchema.$id, simpleInvalid);
  }));

  results.push(bench('simple invalid', 'typebox', () => {
    [...tbSimple.Errors(simpleInvalid)];
  }));

  results.push(bench('simple invalid', 'ajv', () => {
    ajvValidateSimple(simpleInvalid);
  }));

  results.push(bench('simple invalid', 'zod', () => {
    SimpleSchemaZod.safeParse(simpleInvalid);
  }));

  // ── Nested valid ──────────────────────────────────────────────────────────

  section('Validation — nested schema (valid data)');

  results.push(bench('nested valid', 'json-tology', () => {
    registry.validate(NestedSchema.$id, nestedValid);
  }));

  results.push(bench('nested valid', 'typebox', () => {
    tbNested.Check(nestedValid);
  }));

  results.push(bench('nested valid', 'ajv', () => {
    ajvValidateNested(nestedValid);
  }));

  results.push(bench('nested valid', 'zod', () => {
    NestedSchemaZod.safeParse(nestedValid);
  }));

  return results;
}
