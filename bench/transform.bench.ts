/**
 * Transform decode/encode benchmarks.
 *
 * Compares json-tology's Transform.create attached decoders against:
 *   - Zod's .transform() / .pipe() round-trip
 *   - TypeBox Value.Decode / Value.Encode
 *
 * Valibot has no symmetric decode/encode primitive at this surface, so it is
 * not included for the round-trip case (would be unfair).
 */

import {
  type Static, Type
} from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { z } from 'zod';
import { JsonTology } from '../src/JsonTology.js';
import { Transform } from '../src/modules/transform/Transform.js';
import {
  bench, type BenchResult, section
} from './harness.js';

// ---------------------------------------------------------------------------
// Schema: ISO date-time string  ↔  Date
// ---------------------------------------------------------------------------

const DateStringSchema = {
  '$id': 'DateString',
  'format': 'date-time',
  'type': 'string'
} as const;

const DateSchemaJt = Transform.create(DateStringSchema, {
  'decode': (input: string) => {
    return new Date(input);
  },
  'encode': (output: Date) => {
    return output.toISOString();
  }
});

const DateSchemaZod = z.string().datetime()
  .transform((input) => {
    return new Date(input);
  });

const DateSchemaTypebox = Type.Transform(Type.String({ 'format': 'date-time' }))
  .Decode((input) => {
    return new Date(input);
  })
  .Encode((output: Date) => {
    return output.toISOString();
  });

type DateOut = Static<typeof DateSchemaTypebox>;

const wireValue = '2024-01-15T10:30:00.000Z';
const decodedValue = new Date(wireValue);

export function runTransformBench(): BenchResult[] {
  const results: BenchResult[] = [];

  const jt = JsonTology.create({
    'baseIRI': 'urn:bench:transform',
    'schemas': [DateSchemaJt]
  });

  // Warm up
  jt.instantiate(DateSchemaJt, wireValue);
  Value.Decode(DateSchemaTypebox, wireValue);
  DateSchemaZod.parse(wireValue);

  section('transform — decode wire → rich (string → Date)');

  results.push(bench('decode date', 'json-tology', () => {
    jt.instantiate(DateSchemaJt, wireValue);
  }));

  results.push(bench('decode date', 'typebox', () => {
    Value.Decode(DateSchemaTypebox, wireValue);
  }));

  results.push(bench('decode date', 'zod', () => {
    DateSchemaZod.parse(wireValue);
  }));

  section('transform — encode rich → wire (Date → string)');

  results.push(bench('encode date', 'json-tology', () => {
    jt.encode(DateSchemaJt, decodedValue);
  }));

  results.push(bench('encode date', 'typebox', () => {
    Value.Encode(DateSchemaTypebox, decodedValue as DateOut);
  }));

  // Zod 4 supports .pipe back; using zod codec round-trip via toJSON would be
  // an unrelated comparison. Encode is unique surface area for json-tology
  // and TypeBox in this fixture.
  return results;
}
