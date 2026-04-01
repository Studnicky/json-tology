/**
 * Validation benchmarks: json-tology vs TypeBox vs AJV vs Zod.
 */

import { TypeCompiler } from '@sinclair/typebox/compiler';
import { SchemaRegistry } from '../src/modules/registry/schemaRegistry.js';
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

  // -- Simple valid --

  section('Validation — simple flat schema (valid data)');

  const simpleValidJt = bench('simple valid', 'json-tology', () => {
    registry.validate(SimpleSchema.$id, simpleValid);
  });

  results.push(simpleValidJt);

  const simpleValidTb = bench('simple valid', 'typebox', () => {
    tbSimple.Check(simpleValid);
  });

  results.push(simpleValidTb);

  const simpleValidAjv = bench('simple valid', 'ajv', () => {
    ajvValidateSimple(simpleValid);
  });

  results.push(simpleValidAjv);

  const simpleValidZod = bench('simple valid', 'zod', () => {
    SimpleSchemaZod.safeParse(simpleValid);
  });

  results.push(simpleValidZod);

  // -- Simple invalid --

  section('Validation — simple flat schema (invalid data, error collection)');

  const simpleInvalidJt = bench('simple invalid', 'json-tology', () => {
    registry.validate(SimpleSchema.$id, simpleInvalid);
  });

  results.push(simpleInvalidJt);

  const simpleInvalidTb = bench('simple invalid', 'typebox', () => {
    void [...tbSimple.Errors(simpleInvalid)];
  });

  results.push(simpleInvalidTb);

  const simpleInvalidAjv = bench('simple invalid', 'ajv', () => {
    ajvValidateSimple(simpleInvalid);
  });

  results.push(simpleInvalidAjv);

  const simpleInvalidZod = bench('simple invalid', 'zod', () => {
    SimpleSchemaZod.safeParse(simpleInvalid);
  });

  results.push(simpleInvalidZod);

  // -- Nested valid --

  section('Validation — nested schema (valid data)');

  const nestedValidJt = bench('nested valid', 'json-tology', () => {
    registry.validate(NestedSchema.$id, nestedValid);
  });

  results.push(nestedValidJt);

  const nestedValidTb = bench('nested valid', 'typebox', () => {
    tbNested.Check(nestedValid);
  });

  results.push(nestedValidTb);

  const nestedValidAjv = bench('nested valid', 'ajv', () => {
    ajvValidateNested(nestedValid);
  });

  results.push(nestedValidAjv);

  const nestedValidZod = bench('nested valid', 'zod', () => {
    NestedSchemaZod.safeParse(nestedValid);
  });

  results.push(nestedValidZod);

  return results;
}
