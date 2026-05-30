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
    registry.validate(ReviewSchema.$id, reviewValid);
  }));

  results.push(bench('review valid', 'typebox', () => {
    tbReview.Check(reviewValid);
  }));

  results.push(bench('review valid', 'ajv', () => {
    ajvValidateReview(reviewValid);
  }));

  results.push(bench('review valid', 'zod', () => {
    ReviewSchemaZod.safeParse(reviewValid);
  }));

  results.push(bench('review valid', 'valibot', () => {
    safeParse(ReviewSchemaValibot, reviewValid);
  }));

  results.push(bench('review valid', 'io-ts', () => {
    ReviewSchemaIoTs.decode(reviewValid);
  }));

  section('Validation — Review (invalid data, error collection)');

  results.push(bench('review invalid', 'json-tology', () => {
    registry.validate(ReviewSchema.$id, reviewInvalid);
  }));

  results.push(bench('review invalid', 'typebox', () => {
    void [...tbReview.Errors(reviewInvalid)];
  }));

  results.push(bench('review invalid', 'ajv', () => {
    ajvValidateReview(reviewInvalid);
  }));

  results.push(bench('review invalid', 'zod', () => {
    ReviewSchemaZod.safeParse(reviewInvalid);
  }));

  results.push(bench('review invalid', 'valibot', () => {
    safeParse(ReviewSchemaValibot, reviewInvalid);
  }));

  results.push(bench('review invalid', 'io-ts', () => {
    ReviewSchemaIoTs.decode(reviewInvalid);
  }));

  section('Validation — Order (nested $ref graph, valid data)');

  results.push(bench('order valid', 'json-tology', () => {
    registry.validate(OrderSchema.$id, orderValid);
  }));

  results.push(bench('order valid', 'typebox', () => {
    tbOrder.Check(orderValid);
  }));

  results.push(bench('order valid', 'ajv', () => {
    ajvValidateOrder(orderValid);
  }));

  results.push(bench('order valid', 'zod', () => {
    OrderSchemaZod.safeParse(orderValid);
  }));

  results.push(bench('order valid', 'valibot', () => {
    safeParse(OrderSchemaValibot, orderValid);
  }));

  results.push(bench('order valid', 'io-ts', () => {
    OrderSchemaIoTs.decode(orderValid);
  }));

  return results;
}
