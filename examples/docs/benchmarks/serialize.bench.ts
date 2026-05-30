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

import {
  type Static, Type
} from '@sinclair/typebox';
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
      return {
        'at': new Date(raw.at),
        'name': raw.name
      };
    },
    'encode': (rich: { 'at': Date;
      'name': string }) => {
      return {
        'at': rich.at.toISOString(),
        'name': rich.name
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
      'at': new Date(raw.at),
      'name': raw.name
    };
  })
  .Encode((rich: { 'at': Date;
    'name': string }) => {
    return {
      'at': rich.at.toISOString(),
      'name': rich.name
    };
  });

type EventTb = Static<typeof EventSchemaTb>;

const richEvent = {
  'at': new Date('2024-06-01T12:00:00.000Z'),
  'name': 'Launch'
};

export function runSerializeBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // -------------------------------------------------------------------------
  // dump — schema without transforms (compares to JSON.stringify baseline)
  // -------------------------------------------------------------------------
  const jt = JsonTology.create({
    'baseIRI': 'urn:bench:serialize',
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
  jt.encode(EventSchemaJt, richEvent);

  section('serialize — dump Order (validated → wire), no transforms');

  results.push(bench('dump order', 'json-tology', () => {
    jt.dump(OrderSchema, orderInstantiated);
  }));

  results.push(bench('dump order', 'structuredClone', () => {
    structuredClone(orderInstantiated);
  }));

  results.push(bench('dump order', 'typebox', () => {
    Value.Encode(OrderSchemaTypebox, orderValid);
  }));

  section('serialize — dumpJson Order (validated → JSON string)');

  results.push(bench('dumpJson order', 'json-tology', () => {
    jt.dumpJson(OrderSchema, orderInstantiated);
  }));

  results.push(bench('dumpJson order', 'JSON.stringify', () => {
    JSON.stringify(orderValid);
  }));

  section('serialize — encode rich → wire (with transforms)');

  results.push(bench('encode event', 'json-tology', () => {
    jt.encode(EventSchemaJt, richEvent);
  }));

  results.push(bench('encode event', 'typebox', () => {
    // interop: TypeBox's Transform Encode expects a statically-decoded EventTb
    // type, but richEvent is a plain object literal without the Transform brand.
    // TypeBox has no typed path from a plain object to its encoded form here.
    Value.Encode(EventSchemaTb, richEvent as unknown as EventTb);
  }));

  return results;
}
