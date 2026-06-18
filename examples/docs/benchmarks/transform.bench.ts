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

import { Type } from '@sinclair/typebox';
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
    // Normalize: parse and re-emit as canonical ISO string
    return new Date(input).toISOString();
  },
  'encode': (canonical: string) => {
    // Encode reversal: return canonical ISO string to wire
    return canonical;
  }
});

const DateSchemaZod = z.string().datetime()
  .transform((input) => {
    return new Date(input).toISOString();
  });

const DateSchemaTypebox = Type.Transform(Type.String({ 'format': 'date-time' }))
  .Decode((input) => {
    return new Date(input).toISOString();
  })
  .Encode((canonical: string) => {
    return canonical;
  });

const DateSchemaIoTs = new IotType<string, string, unknown>(
  'DateFromIsoString',
  (input): input is string => {
    return typeof input === 'string';
  },
  (input, context): IotValidation<string> => {
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
      'right': new Date(ms).toISOString()
    };
  },
  (output) => {
    return output;
  }
);

const wireValue = '2024-01-15T10:30:00.000Z';
const canonicalValue = new Date(wireValue).toISOString();

export function runTransformBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // doc example with synthetic fixture schemas (strict-graph default does not throw because no inline duplicates)
  const jt = JsonTology.create({
    'baseIri': 'urn:bench:transform',
    'schemas': [DateSchemaJt]
  });

  // Warm up
  jt.instantiate(DateSchemaJt, wireValue);
  Value.Decode(DateSchemaTypebox, wireValue);
  DateSchemaZod.parse(wireValue);
  DateSchemaIoTs.decode(wireValue);
  DateSchemaIoTs.encode(canonicalValue);

  section('transform — decode wire → canonical (string normalize)');

  results.push(bench('decode date', 'json-tology', () => {
    return jt.instantiate(DateSchemaJt, wireValue);
  }));

  results.push(bench('decode date', 'typebox', () => {
    return Value.Decode(DateSchemaTypebox, wireValue);
  }));

  results.push(bench('decode date', 'zod', () => {
    return DateSchemaZod.parse(wireValue);
  }));

  results.push(bench('decode date', 'io-ts', () => {
    return DateSchemaIoTs.decode(wireValue);
  }));

  section('transform — encode canonical → wire (string reversal)');

  results.push(bench('encode date', 'json-tology', () => {
    return jt.encode(DateSchemaJt, canonicalValue);
  }));

  results.push(bench('encode date', 'typebox', () => {
    // interop: TypeBox's Transform Encode expects the statically-decoded shape.
    // canonicalValue is a `string`, which matches it, so it is accepted directly.
    return Value.Encode(DateSchemaTypebox, canonicalValue);
  }));

  results.push(bench('encode date', 'io-ts', () => {
    return DateSchemaIoTs.encode(canonicalValue);
  }));

  // Zod 4 supports .pipe back; using zod codec round-trip via toJSON would be
  // an unrelated comparison. Encode is unique surface area for json-tology
  // and TypeBox in this fixture.
  return results;
}
