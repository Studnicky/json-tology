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
  AddressSchema, CustomerSchema, NestedSchema, NestedSchemaTypebox,
  nestedValid, OrderItemSchema
} from './fixtures.js';

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
    'schemas': [
      AddressSchema,
      CustomerSchema,
      OrderItemSchema,
      NestedSchema,
      EventSchemaJt
    ] as const
  });

  // Warm
  jt.dump(NestedSchema, nestedValid);
  jt.dumpJson(NestedSchema, nestedValid);
  jt.encode(EventSchemaJt, richEvent);

  section('serialize — dump (validated → wire), no transforms');

  results.push(bench('dump nested', 'json-tology', () => {
    jt.dump(NestedSchema, nestedValid);
  }));

  results.push(bench('dump nested', 'structuredClone', () => {
    structuredClone(nestedValid);
  }));

  results.push(bench('dump nested', 'typebox', () => {
    Value.Encode(NestedSchemaTypebox, nestedValid);
  }));

  section('serialize — dumpJson (validated → JSON string)');

  results.push(bench('dumpJson nested', 'json-tology', () => {
    jt.dumpJson(NestedSchema, nestedValid);
  }));

  results.push(bench('dumpJson nested', 'JSON.stringify', () => {
    JSON.stringify(nestedValid);
  }));

  section('serialize — encode rich → wire (with transforms)');

  results.push(bench('encode event', 'json-tology', () => {
    jt.encode(EventSchemaJt, richEvent);
  }));

  results.push(bench('encode event', 'typebox', () => {
    Value.Encode(EventSchemaTb, richEvent as EventTb);
  }));

  return results;
}
