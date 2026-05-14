/**
 * Validation benchmarks: json-tology vs TypeBox vs AJV vs Zod vs Valibot vs io-ts.
 */

import { TypeCompiler } from '@sinclair/typebox/compiler';
import { safeParse } from 'valibot';
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  AddressSchema, ajvValidateNested, ajvValidateSimple,
  CustomerSchema, NestedSchema,
  NestedSchemaIoTs,
  NestedSchemaTypebox, NestedSchemaValibot, NestedSchemaZod, nestedValid,
  OrderItemSchema, simpleInvalid,
  SimpleSchema, SimpleSchemaIoTs, SimpleSchemaTypebox, SimpleSchemaValibot,
  SimpleSchemaZod, simpleValid
} from './fixtures.js';

export function runValidateBench(): BenchResult[] {
  const results: BenchResult[] = [];

  const registry = new SchemaRegistry();

  registry.set(SimpleSchema);
  registry.set(AddressSchema);
  registry.set(CustomerSchema);
  registry.set(OrderItemSchema);
  registry.set(NestedSchema);

  const tbSimple = TypeCompiler.Compile(SimpleSchemaTypebox);
  const tbNested = TypeCompiler.Compile(NestedSchemaTypebox);

  // Force lazy compilation
  registry.validate(SimpleSchema.$id, simpleValid);
  registry.validate(NestedSchema.$id, nestedValid);

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

  results.push(bench('simple valid', 'valibot', () => {
    safeParse(SimpleSchemaValibot, simpleValid);
  }));

  results.push(bench('simple valid', 'io-ts', () => {
    SimpleSchemaIoTs.decode(simpleValid);
  }));

  section('Validation — simple flat schema (invalid data, error collection)');

  results.push(bench('simple invalid', 'json-tology', () => {
    registry.validate(SimpleSchema.$id, simpleInvalid);
  }));

  results.push(bench('simple invalid', 'typebox', () => {
    void [...tbSimple.Errors(simpleInvalid)];
  }));

  results.push(bench('simple invalid', 'ajv', () => {
    ajvValidateSimple(simpleInvalid);
  }));

  results.push(bench('simple invalid', 'zod', () => {
    SimpleSchemaZod.safeParse(simpleInvalid);
  }));

  results.push(bench('simple invalid', 'valibot', () => {
    safeParse(SimpleSchemaValibot, simpleInvalid);
  }));

  results.push(bench('simple invalid', 'io-ts', () => {
    SimpleSchemaIoTs.decode(simpleInvalid);
  }));

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

  results.push(bench('nested valid', 'valibot', () => {
    safeParse(NestedSchemaValibot, nestedValid);
  }));

  results.push(bench('nested valid', 'io-ts', () => {
    NestedSchemaIoTs.decode(nestedValid);
  }));

  return results;
}
