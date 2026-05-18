/**
 * Transform decode/encode benchmarks.
 *
 * Compares json-tology's Transform.create attached decoders against:
 *   - Zod's .transform() / .pipe() round-trip
 *   - TypeBox Value.Decode / Value.Encode
 *   - io-ts custom codec with .decode() / .encode()
 *
 * Valibot has no symmetric decode/encode primitive at this surface, so it is
 * not included for the round-trip case (would be unfair).
 */

import {
  type Static, Type
} from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import {
  Type as IotType,
  type Validation as IotValidation
} from 'io-ts';
import { z } from 'zod';
import { JsonTology } from '../../../src/JsonTology.js';
import { Transform } from '../../../src/modules/transform/Transform.js';
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

const DateSchemaIoTs = new IotType<Date, string, unknown>(
  'DateFromIsoString',
  (input): input is Date => {
    return input instanceof Date;
  },
  (input, context): IotValidation<Date> => {
    if (typeof input !== 'string') {
      return {
        '_tag': 'Left',
        'left': [{
          'context': context,
          'value': input
        }]
      };
    }
    const ms = Date.parse(input);

    if (Number.isNaN(ms)) {
      return {
        '_tag': 'Left',
        'left': [{
          'context': context,
          'value': input
        }]
      };
    }

    return {
      '_tag': 'Right',
      'right': new Date(ms)
    };
  },
  (output) => {
    return output.toISOString();
  }
);

const wireValue = '2024-01-15T10:30:00.000Z';
const decodedValue = new Date(wireValue);

export function runTransformBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // doc example with synthetic fixture schemas (strict-graph default does not throw because no inline duplicates)
  const jt = JsonTology.create({
    'baseIRI': 'urn:bench:transform',
    'schemas': [DateSchemaJt]
  });

  // Warm up
  jt.instantiate(DateSchemaJt, wireValue);
  Value.Decode(DateSchemaTypebox, wireValue);
  DateSchemaZod.parse(wireValue);
  DateSchemaIoTs.decode(wireValue);
  DateSchemaIoTs.encode(decodedValue);

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

  results.push(bench('decode date', 'io-ts', () => {
    DateSchemaIoTs.decode(wireValue);
  }));

  section('transform — encode rich → wire (Date → string)');

  results.push(bench('encode date', 'json-tology', () => {
    jt.encode(DateSchemaJt, decodedValue);
  }));

  results.push(bench('encode date', 'typebox', () => {
    Value.Encode(DateSchemaTypebox, decodedValue as DateOut);
  }));

  results.push(bench('encode date', 'io-ts', () => {
    DateSchemaIoTs.encode(decodedValue);
  }));

  // Zod 4 supports .pipe back; using zod codec round-trip via toJSON would be
  // an unrelated comparison. Encode is unique surface area for json-tology
  // and TypeBox in this fixture.
  return results;
}
