/**
 * Serialization benchmarks: dump / dumpJson vs JSON.stringify and TypeBox encoders.
 *
 * dump applies registered Transform encoders and projects the validated value
 * back to wire form. We compare against:
 *   - hand-written JSON.stringify (the trivial baseline)
 *   - TypeBox Value.Encode (its closest analog when transforms are attached)
 *
 * For schemas without transforms, dump should approach JSON.stringify cost.
 * dumpJson is dump + JSON.stringify in one pass.
 */

import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { JsonTology } from '../../../src/JsonTology.js';
import { Transform } from '../../../src/modules/transform/Transform.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  bookstoreBenchSchemas, OrderSchemaTypebox, orderValid
} from './fixtures.js';
import { OrderSchema } from '../bookstore/index.js';

// ---------------------------------------------------------------------------
// Schema with a transform — exercises the encode path
// ---------------------------------------------------------------------------

const EventSchemaJt = Transform.create(
  {
    '$id': 'urn:bench:Event',
    'properties': {
      'at': {
        'format': 'date-time',
        'type': 'string'
      },
      'name': { 'type': 'string' }
    },
    'required': [
      'at',
      'name'
    ],
    'type': 'object'
  } as const,
  {
    'decode': (raw: { 'at': string;
      'name': string }) => {
      // Normalize: parse date and re-emit as canonical ISO string
      return {
        'at': new Date(raw.at).toISOString(),
        'name': raw.name
      };
    },
    'encode': (canonical: { 'at': string;
      'name': string }) => {
      // Encode reversal: return to wire form
      return {
        'at': canonical.at,
        'name': canonical.name
      };
    }
  }
);

const EventSchemaTb = Type.Transform(Type.Object({
  'at': Type.String({ 'format': 'date-time' }),
  'name': Type.String()
}))
  .Decode((raw) => {
    return {
      'at': new Date(raw.at).toISOString(),
      'name': raw.name
    };
  })
  .Encode((canonical: { 'at': string;
    'name': string }) => {
    return {
      'at': canonical.at,
      'name': canonical.name
    };
  });

const canonicalEvent = {
  'at': new Date('2024-06-01T12:00:00.000Z').toISOString(),
  'name': 'Launch'
};

export function runSerializeBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // -------------------------------------------------------------------------
  // dump — schema without transforms (compares to JSON.stringify baseline)
  // -------------------------------------------------------------------------
  const jt = JsonTology.create({
    'baseIri': 'urn:bench:serialize',
    'enableStrictGraph': false,
    'schemas': [
      ...bookstoreBenchSchemas,
      EventSchemaJt
    ]
  });

  // Instantiate raw fixture to get the branded order type required by dump/dumpJson
  const orderInstantiated = jt.instantiate(OrderSchema, orderValid);

  // Warm
  jt.dump(OrderSchema, orderInstantiated);
  jt.dumpJson(OrderSchema, orderInstantiated);
  jt.encode(EventSchemaJt, canonicalEvent);

  section('serialize — dump Order (validated → wire), no transforms');

  results.push(bench('dump order', 'json-tology', () => {
    return jt.dump(OrderSchema, orderInstantiated);
  }));

  results.push(bench('dump order', 'structuredClone', () => {
    return structuredClone(orderInstantiated);
  }));

  results.push(bench('dump order', 'typebox', () => {
    return Value.Encode(OrderSchemaTypebox, orderValid);
  }));

  section('serialize — dumpJson Order (validated → JSON string)');

  results.push(bench('dumpJson order', 'json-tology', () => {
    return jt.dumpJson(OrderSchema, orderInstantiated);
  }));

  results.push(bench('dumpJson order', 'JSON.stringify', () => {
    return JSON.stringify(orderValid);
  }));

  section('serialize — encode canonical → wire (with transforms)');

  results.push(bench('encode event', 'json-tology', () => {
    return jt.encode(EventSchemaJt, canonicalEvent);
  }));

  results.push(bench('encode event', 'typebox', () => {
    // interop: TypeBox's Transform Encode expects the statically-decoded shape.
    // canonicalEvent matches it structurally ({ at: string; name: string }), so it is
    // accepted directly — no cast needed.
    return Value.Encode(EventSchemaTb, canonicalEvent);
  }));

  return results;
}
