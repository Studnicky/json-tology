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
  ajvValidateOrder, ajvValidateReview,
  bookstoreBenchSchemas,
  OrderSchemaIoTs, OrderSchemaTypebox, OrderSchemaValibot, OrderSchemaZod,
  orderValid,
  reviewInvalid, ReviewSchemaIoTs, ReviewSchemaTypebox, ReviewSchemaValibot,
  ReviewSchemaZod, reviewValid
} from './fixtures.js';
import {
  OrderSchema, ReviewSchema
} from '../bookstore/index.js';

export function runValidateBench(): BenchResult[] {
  const results: BenchResult[] = [];

  const registry = new SchemaRegistry({ 'enableStrictGraph': false });

  for (const schema of bookstoreBenchSchemas) {
    registry.set(schema as Record<string, unknown>);
  }

  const tbReview = TypeCompiler.Compile(ReviewSchemaTypebox);
  const tbOrder = TypeCompiler.Compile(OrderSchemaTypebox);

  // Force lazy compilation
  registry.validate(ReviewSchema.$id, reviewValid);
  registry.validate(OrderSchema.$id, orderValid);

  section('Validation — Review (flat object, valid data)');

  results.push(bench('review valid', 'json-tology', () => {
    return registry.validate(ReviewSchema.$id, reviewValid);
  }));

  results.push(bench('review valid', 'typebox', () => {
    return tbReview.Check(reviewValid);
  }));

  results.push(bench('review valid', 'ajv', () => {
    return ajvValidateReview(reviewValid);
  }));

  results.push(bench('review valid', 'zod', () => {
    return ReviewSchemaZod.safeParse(reviewValid);
  }));

  results.push(bench('review valid', 'valibot', () => {
    return safeParse(ReviewSchemaValibot, reviewValid);
  }));

  results.push(bench('review valid', 'io-ts', () => {
    return ReviewSchemaIoTs.decode(reviewValid);
  }));

  section('Validation — Review (invalid data, error collection)');

  results.push(bench('review invalid', 'json-tology', () => {
    return registry.validate(ReviewSchema.$id, reviewInvalid);
  }));

  results.push(bench('review invalid', 'typebox', () => {
    return [...tbReview.Errors(reviewInvalid)];
  }));

  results.push(bench('review invalid', 'ajv', () => {
    return ajvValidateReview(reviewInvalid);
  }));

  results.push(bench('review invalid', 'zod', () => {
    return ReviewSchemaZod.safeParse(reviewInvalid);
  }));

  results.push(bench('review invalid', 'valibot', () => {
    return safeParse(ReviewSchemaValibot, reviewInvalid);
  }));

  results.push(bench('review invalid', 'io-ts', () => {
    return ReviewSchemaIoTs.decode(reviewInvalid);
  }));

  section('Validation — Order (nested $ref graph, valid data)');

  results.push(bench('order valid', 'json-tology', () => {
    return registry.validate(OrderSchema.$id, orderValid);
  }));

  results.push(bench('order valid', 'typebox', () => {
    return tbOrder.Check(orderValid);
  }));

  results.push(bench('order valid', 'ajv', () => {
    return ajvValidateOrder(orderValid);
  }));

  results.push(bench('order valid', 'zod', () => {
    return OrderSchemaZod.safeParse(orderValid);
  }));

  results.push(bench('order valid', 'valibot', () => {
    return safeParse(OrderSchemaValibot, orderValid);
  }));

  results.push(bench('order valid', 'io-ts', () => {
    return OrderSchemaIoTs.decode(orderValid);
  }));

  return results;
}
