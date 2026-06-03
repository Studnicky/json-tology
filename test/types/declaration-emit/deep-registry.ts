/**
 * Declaration-emit regression fixture (designs/0006 — the test that #7 exists for).
 *
 * Before the lazy-`TRefs` change, `JsonTology.create({ schemas })` returned
 * `JsonTology<SchemaMapFromTupleType<TSchemas>, …>`, which EAGERLY materialised
 * `ParseOutputType` for every registered schema. Exporting such an instance under
 * `declaration: true` forced TypeScript to write all of those branded output
 * types into the `.d.ts`, which on a deep/wide registry exceeded the instantiation
 * ceiling and emitted TS2589 ("Type instantiation is excessively deep and possibly
 * infinite").
 *
 * This fixture is a deliberately deep (6-level `$ref` chain) and wide (~20 sibling
 * schemas) registry whose `reg` instance and resolved `Root` type are EXPORTED, so
 * `tsc -p tsconfig.decl-emit.json` must walk and emit them. The build passing
 * (exit 0, no TS2589) is the regression assertion. Run via `npm run test:decl`.
 */

import { JsonTology } from '../../../src/index.js';
import type {
  InferType, SchemaReferencesMapType
} from '../../../src/types/index.js';

// 6-level deep $ref chain — each level references the next by bare $id IRI.
const L6Schema = {
  '$id': 'urn:decl:L6',
  'properties': {
    'value': {
      'maxLength': 64,
      'minLength': 1,
      'type': 'string'
    }
  },
  'required': ['value'],
  'type': 'object'
} as const;
const L5Schema = {
  '$id': 'urn:decl:L5',
  'properties': {
    'child': { '$ref': 'urn:decl:L6' },
    'tag': { 'type': 'string' }
  },
  'required': ['child'],
  'type': 'object'
} as const;
const L4Schema = {
  '$id': 'urn:decl:L4',
  'properties': {
    'child': { '$ref': 'urn:decl:L5' },
    'tag': { 'type': 'string' }
  },
  'required': ['child'],
  'type': 'object'
} as const;
const L3Schema = {
  '$id': 'urn:decl:L3',
  'properties': {
    'child': { '$ref': 'urn:decl:L4' },
    'tag': { 'type': 'string' }
  },
  'required': ['child'],
  'type': 'object'
} as const;
const L2Schema = {
  '$id': 'urn:decl:L2',
  'properties': {
    'child': { '$ref': 'urn:decl:L3' },
    'tag': { 'type': 'string' }
  },
  'required': ['child'],
  'type': 'object'
} as const;
const L1Schema = {
  '$id': 'urn:decl:L1',
  'properties': {
    'child': { '$ref': 'urn:decl:L2' },
    'tag': { 'type': 'string' }
  },
  'required': ['child'],
  'type': 'object'
} as const;

// ~15 flat sibling schemas — primitive datatypes with constraint brands.
const S01Schema = {
  '$id': 'urn:decl:S01',
  'format': 'uuid',
  'type': 'string'
} as const;
const S02Schema = {
  '$id': 'urn:decl:S02',
  'format': 'email',
  'type': 'string'
} as const;
const S03Schema = {
  '$id': 'urn:decl:S03',
  'maxLength': 200,
  'minLength': 1,
  'type': 'string'
} as const;
const S04Schema = {
  '$id': 'urn:decl:S04',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;
const S05Schema = {
  '$id': 'urn:decl:S05',
  'maximum': 5,
  'minimum': 1,
  'type': 'integer'
} as const;
const S06Schema = {
  '$id': 'urn:decl:S06',
  'minimum': 0,
  'type': 'number'
} as const;
const S07Schema = {
  '$id': 'urn:decl:S07',
  'enum': [
    'a',
    'b',
    'c'
  ],
  'type': 'string'
} as const;
const S08Schema = {
  '$id': 'urn:decl:S08',
  'type': 'boolean'
} as const;
const S09Schema = {
  '$id': 'urn:decl:S09',
  'format': 'date-time',
  'type': 'string'
} as const;
const S10Schema = {
  '$id': 'urn:decl:S10',
  'maxLength': 32,
  'type': 'string'
} as const;
const S11Schema = {
  '$id': 'urn:decl:S11',
  'multipleOf': 2,
  'type': 'integer'
} as const;
const S12Schema = {
  '$id': 'urn:decl:S12',
  'items': { '$ref': 'urn:decl:S01' },
  'type': 'array'
} as const;
const S13Schema = {
  '$id': 'urn:decl:S13',
  'properties': {
    'amount': { '$ref': 'urn:decl:S06' },
    'currency': { '$ref': 'urn:decl:S07' }
  },
  'required': [
    'amount',
    'currency'
  ],
  'type': 'object'
} as const;
const S14Schema = {
  '$id': 'urn:decl:S14',
  'properties': {
    'id': { '$ref': 'urn:decl:S01' },
    'name': { '$ref': 'urn:decl:S03' }
  },
  'required': ['id'],
  'type': 'object'
} as const;
const S15Schema = {
  '$id': 'urn:decl:S15',
  'properties': {
    'rating': { '$ref': 'urn:decl:S05' },
    'verified': { '$ref': 'urn:decl:S08' }
  },
  'required': ['rating'],
  'type': 'object'
} as const;

// Root aggregates the deep chain head plus a wide spread of siblings.
const RootSchema = {
  '$id': 'urn:decl:Root',
  'properties': {
    'a': { '$ref': 'urn:decl:S01' },
    'b': { '$ref': 'urn:decl:S02' },
    'c': { '$ref': 'urn:decl:S03' },
    'd': { '$ref': 'urn:decl:S04' },
    'deep': { '$ref': 'urn:decl:L1' },
    'money': { '$ref': 'urn:decl:S13' },
    'reviews': {
      'items': { '$ref': 'urn:decl:S15' },
      'type': 'array'
    },
    'tags': { '$ref': 'urn:decl:S12' },
    'who': { '$ref': 'urn:decl:S14' }
  },
  'required': [
    'deep',
    'who'
  ],
  'type': 'object'
} as const;

const schemas = [
  L6Schema,
  L5Schema,
  L4Schema,
  L3Schema,
  L2Schema,
  L1Schema,
  S01Schema,
  S02Schema,
  S03Schema,
  S04Schema,
  S05Schema,
  S06Schema,
  S07Schema,
  S08Schema,
  S09Schema,
  S10Schema,
  S11Schema,
  S12Schema,
  S13Schema,
  S14Schema,
  S15Schema,
  RootSchema
] as const;

/**
 * The exported instance. Its type is `JsonTology<SchemaReferencesMapType<typeof
 * schemas>>` — emitting THIS to a `.d.ts` is what tripped TS2589 under the eager
 * map. With lazy `TRefs` it must emit cleanly.
 */
// strict-graph is off: this fixture exists to stress declaration EMIT and type
// resolution, not registration hygiene, so inline primitive shapes are fine here.
export const deepRegistry = JsonTology.create({
  'baseIRI': 'urn:decl:',
  'enableStrictGraph': false,
  schemas
});

/** The fully-resolved deep root output type, also forced into the `.d.ts`. */
export type Root = InferType<typeof RootSchema, SchemaReferencesMapType<typeof schemas>>;
