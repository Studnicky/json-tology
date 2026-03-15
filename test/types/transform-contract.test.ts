import { JsonTology } from '../../src/JsonTology.js';
import { Transform } from '../../src/modules/transform/Transform.js';
import type { InferType } from '../../src/types/schema.js';
import type { ParseOutputType } from '../../src/types/transform.js';

const DateTimeSchema = {
  '$id': 'https://example.io/DateTime',
  'format': 'date-time',
  'type': 'string'
} as const;

const TransformedDateSchema = Transform.create(DateTimeSchema, {
  'decode': (raw: string) => {
    return new Date(raw);
  },
  'encode': (date: Date) => {
    return date.toISOString();
  }
});

const jt = JsonTology.create({
  'baseIRI': 'https://example.io',
  'schemas': [TransformedDateSchema] as const
});

type WireDate = InferType<typeof TransformedDateSchema>;
type ParsedDate = ParseOutputType<typeof TransformedDateSchema>;

const _wireTypeCheck: WireDate = '2024-01-01T00:00:00.000Z';
const _parsedTypeCheck: ParsedDate = new Date('2024-01-01T00:00:00.000Z');

const parsed = jt.parse(TransformedDateSchema, '2024-01-01T00:00:00.000Z');
const materialized = jt.materialize(TransformedDateSchema, '2024-01-01T00:00:00.000Z');
const encoded = jt.encode(TransformedDateSchema, new Date('2024-01-01T00:00:00.000Z'));

const _parsedDate: Date = parsed;
const _materializedWire: string = materialized;
const _encodedWire: string = encoded;

// @ts-expect-error parse() returns decoded output, not wire-form string
const _badParsed: string = parsed;
// @ts-expect-error materialize() returns wire-form output, not decoded Date
const _badMaterialized: Date = materialized;
// @ts-expect-error encode() returns wire-form output, not decoded Date
const _badEncoded: Date = encoded;

// @ts-expect-error materialize() expects wire-form input for transformed schemas
jt.materialize(TransformedDateSchema, new Date('2024-01-01T00:00:00.000Z'));
// @ts-expect-error encode() expects decoded input for transformed schemas
jt.encode(TransformedDateSchema, '2024-01-01T00:00:00.000Z');

void [
  _wireTypeCheck,
  _parsedTypeCheck,
  _parsedDate,
  _materializedWire,
  _encodedWire,
  _badParsed,
  _badMaterialized,
  _badEncoded
];
