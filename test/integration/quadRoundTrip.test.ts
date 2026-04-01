/**
 * Quad round-trip tests — toQuads/fromQuads via projectAbox + liftInstances
 *
 * Verifies that data projected into RDF quads can be lifted back into
 * equivalent typed JS objects through the JsonTology API.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SimpleSchema = {
  '$id': 'https://example.com/Simple',
  'properties': { 'label': { 'type': 'string' } },
  'required': ['label'],
  'type': 'object'
} as const;

const AllScalarsSchema = {
  '$id': 'https://example.com/AllScalars',
  'properties': {
    'active': { 'type': 'boolean' },
    'count': { 'type': 'integer' },
    'label': { 'type': 'string' },
    'score': { 'type': 'number' }
  },
  'required': [
    'active',
    'count',
    'label',
    'score'
  ],
  'type': 'object'
} as const;

const PersonSchema = {
  '$defs': {
    'Address': {
      'properties': {
        'city': { 'type': 'string' },
        'zip': { 'type': 'string' }
      },
      'required': [
        'city',
        'zip'
      ],
      'type': 'object'
    }
  },
  '$id': 'https://example.com/Person',
  'properties': {
    'address': { '$ref': '#/$defs/Address' },
    'name': { 'type': 'string' }
  },
  'required': [
    'address',
    'name'
  ],
  'type': 'object'
} as const;

const TagListSchema = {
  '$id': 'https://example.com/TagList',
  'properties': {
    'tags': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'tags',
    'title'
  ],
  'type': 'object'
} as const;

const WithDefaultsSchema = {
  '$id': 'https://example.com/WithDefaults',
  'properties': {
    'color': {
      'default': 'blue',
      'type': 'string'
    },
    'enabled': {
      'default': true,
      'type': 'boolean'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const OptionalPropsSchema = {
  '$id': 'https://example.com/OptionalProps',
  'properties': {
    'bio': { 'type': 'string' },
    'name': { 'type': 'string' },
    'nickname': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const EmptyObjectSchema = {
  '$id': 'https://example.com/EmptyObject',
  'properties': { 'note': { 'type': 'string' } },
  'type': 'object'
} as const;

const DeeplyNestedSchema = {
  '$defs': {
    'Inner': {
      'properties': { 'value': { 'type': 'string' } },
      'required': ['value'],
      'type': 'object'
    },
    'Middle': {
      'properties': { 'inner': { '$ref': '#/$defs/Inner' } },
      'required': ['inner'],
      'type': 'object'
    }
  },
  '$id': 'https://example.com/DeeplyNested',
  'properties': { 'middle': { '$ref': '#/$defs/Middle' } },
  'required': ['middle'],
  'type': 'object'
} as const;

const EnumSchema = {
  '$id': 'https://example.com/WithEnum',
  'properties': {
    'status': {
      'enum': [
        'active',
        'inactive',
        'pending'
      ],
      'type': 'string'
    }
  },
  'required': ['status'],
  'type': 'object'
} as const;

const AllOptionalSchema = {
  '$id': 'https://example.com/AllOptional',
  'properties': {
    'bio': { 'type': 'string' },
    'email': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'type': 'object'
} as const;

const BASE_IRI = 'https://example.com';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectAndLift(
  jt: JsonTology,
  schema: Record<string, unknown> & { '$id': string },
  data: unknown
): unknown[] {
  const quads = jt.materializer.projectAbox(schema, data, BASE_IRI);

  return jt.fromQuads(schema.$id, quads);
}

// ---------------------------------------------------------------------------
// Simple round-trip scenarios
// ---------------------------------------------------------------------------

interface SimpleRoundTripScenario {
  'check': (original: Record<string, unknown>, roundTripped: Record<string, unknown>) => void;
  'input': Record<string, unknown>;
  'name': string;
  'schema': Record<string, unknown> & { readonly '$id': string };
  'schemas': ReadonlyArray<Record<string, unknown>>;
}

const simpleRoundTripScenarios: SimpleRoundTripScenario[] = [
  {
    'check': (_original, output) => {
      assert.equal(output.label, 'hello', 'simple object — label');
    },
    'input': { 'label': 'hello' },
    'name': 'round-trips a simple object',
    'schema': SimpleSchema as unknown as Record<string, unknown> & { '$id': string },
    'schemas': [SimpleSchema]
  },
  {
    'check': (_original, output) => {
      assert.equal(output.label, 'test', 'all scalars — label');
      assert.equal(output.count, 42, 'all scalars — count');
      assert.equal(typeof output.count, 'number', 'all scalars — count type');
      assert.equal(output.score, 3.14, 'all scalars — score');
      assert.equal(typeof output.score, 'number', 'all scalars — score type');
      assert.equal(output.active, false, 'all scalars — active');
      assert.equal(typeof output.active, 'boolean', 'all scalars — active type');
    },
    'input': {
      'active': false,
      'count': 42,
      'label': 'test',
      'score': 3.14
    },
    'name': 'round-trips all scalar types: string, number, integer, boolean',
    'schema': AllScalarsSchema as unknown as Record<string, unknown> & { '$id': string },
    'schemas': [AllScalarsSchema]
  }
];

void describe('quad round-trip: simple scenarios', () => {
  for (const {
    check, input, name, schema, schemas
  } of simpleRoundTripScenarios) {
    void it(name, () => {
      const jt = JsonTology.create({
        'baseIRI': BASE_IRI,
        'schemas': schemas
      });
      const results = projectAndLift(jt, schema, input);

      assert.equal(results.length, 1, `${name} — result count`);
      const output = results[0] as Record<string, unknown>;

      check(input, output);
    });
  }
});

// ---------------------------------------------------------------------------
// Nested/structured round-trip scenarios
// ---------------------------------------------------------------------------

interface NestedRoundTripScenario {
  'check': (original: Record<string, unknown>, roundTripped: Record<string, unknown>) => void;
  'input': Record<string, unknown>;
  'name': string;
  'schema': Record<string, unknown> & { readonly '$id': string };
  'schemas': ReadonlyArray<Record<string, unknown>>;
}

const nestedRoundTripScenarios: NestedRoundTripScenario[] = [
  {
    'check': (_original, output) => {
      assert.equal(output.name, 'Alice', 'nested $ref — name');
      const addr = output.address as Record<string, unknown>;

      assert.equal(addr.city, 'Berlin', 'nested $ref — city');
      assert.equal(addr.zip, '10115', 'nested $ref — zip');
    },
    'input': {
      'address': {
        'city': 'Berlin',
        'zip': '10115'
      },
      'name': 'Alice'
    },
    'name': 'round-trips an object with a nested $ref',
    'schema': PersonSchema as unknown as Record<string, unknown> & { '$id': string },
    'schemas': [PersonSchema]
  },
  {
    'check': (_original, output) => {
      assert.equal(output.title, 'Sample', 'array property — title');
      assert.ok(Array.isArray(output.tags), 'array property — tags is array');
      assert.deepEqual((output.tags as string[]).sort(), [
        'alpha',
        'beta',
        'gamma'
      ], 'array property — tags values');
    },
    'input': {
      'tags': [
        'alpha',
        'beta',
        'gamma'
      ],
      'title': 'Sample'
    },
    'name': 'round-trips an object with an array property',
    'schema': TagListSchema as unknown as Record<string, unknown> & { '$id': string },
    'schemas': [TagListSchema]
  },
  {
    'check': (_original, output) => {
      const middle = output.middle as Record<string, unknown>;
      const inner = middle.inner as Record<string, unknown>;

      assert.equal(inner.value, 'deep', 'deeply nested — value');
    },
    'input': { 'middle': { 'inner': { 'value': 'deep' } } },
    'name': 'round-trips a deeply nested structure (3+ levels)',
    'schema': DeeplyNestedSchema as unknown as Record<string, unknown> & { '$id': string },
    'schemas': [DeeplyNestedSchema]
  }
];

void describe('quad round-trip: nested/structured scenarios', () => {
  for (const {
    check, input, name, schema, schemas
  } of nestedRoundTripScenarios) {
    void it(name, () => {
      const jt = JsonTology.create({
        'baseIRI': BASE_IRI,
        'schemas': schemas
      });
      const results = projectAndLift(jt, schema, input);

      assert.equal(results.length, 1, `${name} — result count`);
      const output = results[0] as Record<string, unknown>;

      check(input, output);
    });
  }
});

// ---------------------------------------------------------------------------
// Special-case round-trip scenarios
// ---------------------------------------------------------------------------

interface SpecialRoundTripScenario {
  'check': (original: Record<string, unknown>, results: unknown[], jt: JsonTology) => void;
  'input': Record<string, unknown>;
  'name': string;
  'schema': Record<string, unknown> & { readonly '$id': string };
  'schemas': ReadonlyArray<Record<string, unknown>>;
  'useMaterialize'?: boolean;
}

const specialRoundTripScenarios: SpecialRoundTripScenario[] = [
  {
    'check': (_original, results) => {
      assert.equal(results.length, 1, 'defaults — result count');
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.name, 'Test', 'defaults — name');
      assert.equal(output.color, 'blue', 'defaults — color');
      assert.equal(output.enabled, true, 'defaults — enabled');
    },
    'input': { 'name': 'Test' },
    'name': 'preserves defaults through materialize then round-trip',
    'schema': WithDefaultsSchema as unknown as Record<string, unknown> & { '$id': string },
    'schemas': [WithDefaultsSchema],
    'useMaterialize': true
  },
  {
    'check': (_original, results) => {
      assert.equal(results.length, 1, 'optional omitted — result count');
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.name, 'Alice', 'optional omitted — name');
      assert.equal('bio' in output, false, 'optional omitted — bio absent');
      assert.equal('nickname' in output, false, 'optional omitted — nickname absent');
    },
    'input': { 'name': 'Alice' },
    'name': 'omits absent optional properties after round-trip',
    'schema': OptionalPropsSchema as unknown as Record<string, unknown> & { '$id': string },
    'schemas': [OptionalPropsSchema]
  },
  {
    'check': (_original, results) => {
      assert.equal(results.length, 1, 'empty object — result count');
      const output = results[0] as Record<string, unknown>;

      assert.equal('note' in output, false, 'empty object — note absent');
    },
    'input': {},
    'name': 'round-trips an empty object with no required properties',
    'schema': EmptyObjectSchema as unknown as Record<string, unknown> & { '$id': string },
    'schemas': [EmptyObjectSchema]
  },
  // Edge cases
  {
    'check': (_original, results) => {
      assert.equal(results.length, 1, 'all-optional empty — result count');
      const output = results[0] as Record<string, unknown>;

      assert.equal('name' in output, false, 'all-optional empty — name absent');
      assert.equal('email' in output, false, 'all-optional empty — email absent');
      assert.equal('bio' in output, false, 'all-optional empty — bio absent');
    },
    'input': {},
    'name': 'all-optional properties with missing values round-trip as empty',
    'schema': AllOptionalSchema as unknown as Record<string, unknown> & { '$id': string },
    'schemas': [AllOptionalSchema]
  },
  {
    'check': (_original, results) => {
      assert.equal(results.length, 1, 'all-optional partial — result count');
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.name, 'Bob', 'all-optional partial — name');
      assert.equal('email' in output, false, 'all-optional partial — email absent');
      assert.equal('bio' in output, false, 'all-optional partial — bio absent');
    },
    'input': { 'name': 'Bob' },
    'name': 'all-optional properties with partial values',
    'schema': AllOptionalSchema as unknown as Record<string, unknown> & { '$id': string },
    'schemas': [AllOptionalSchema]
  }
];

void describe('quad round-trip: special cases', () => {
  for (const {
    check, input, name, schema, schemas, useMaterialize
  } of specialRoundTripScenarios) {
    void it(name, () => {
      const jt = JsonTology.create({
        'baseIRI': BASE_IRI,
        'schemas': schemas
      });

      const data = useMaterialize === true
        ? jt.materialize(schema, input)
        : input;

      const results = projectAndLift(jt, schema, data);

      check(input, results, jt);
    });
  }
});

// ---------------------------------------------------------------------------
// Multi-instance and enum round-trip scenarios
// ---------------------------------------------------------------------------

interface MultiEnumScenario {
  'check': (jt: JsonTology) => void;
  'name': string;
  'schemas': ReadonlyArray<Record<string, unknown>>;
}

const multiEnumScenarios: MultiEnumScenario[] = [
  {
    'check': (jt) => {
      const schemaRef = SimpleSchema as unknown as Record<string, unknown> & { '$id': string };
      const quads1 = jt.materializer.projectAbox(schemaRef, { 'label': 'first' }, BASE_IRI);
      const quads2 = jt.materializer.projectAbox(schemaRef, { 'label': 'second' }, BASE_IRI);
      const quads3 = jt.materializer.projectAbox(schemaRef, { 'label': 'third' }, BASE_IRI);
      const allQuads = [
        ...quads1,
        ...quads2,
        ...quads3
      ];
      const results = jt.fromQuads(SimpleSchema.$id, allQuads);

      assert.equal(results.length, 3, 'multi-instance — result count');
      const labels = (results as Array<Record<string, unknown>>)
        .map((result) => {
          return result.label;
        })
        .sort((left, right) => {
          return String(left).localeCompare(String(right));
        });

      assert.deepEqual(labels, [
        'first',
        'second',
        'third'
      ], 'multi-instance — labels');
    },
    'name': 'round-trips multiple instances from the same schema',
    'schemas': [SimpleSchema]
  },
  {
    'check': (jt) => {
      const enumValues = [
        'active',
        'inactive',
        'pending'
      ] as const;

      for (const status of enumValues) {
        const input = { 'status': status };
        const results = projectAndLift(
          jt,
          EnumSchema as unknown as Record<string, unknown> & { '$id': string },
          input
        );

        assert.equal(results.length, 1, `enum ${status} — result count`);
        const output = results[0] as Record<string, unknown>;

        assert.equal(output.status, status, `enum ${status} — value`);
      }
    },
    'name': 'round-trips an object with an enum property',
    'schemas': [EnumSchema]
  },
  // Edge case
  {
    'check': (jt) => {
      const schemaRef = EmptyObjectSchema as unknown as Record<string, unknown> & { '$id': string };
      const results = projectAndLift(jt, schemaRef, {});

      assert.equal(results.length, 1, 'empty object multi — result count');
      const output = results[0] as Record<string, unknown>;

      assert.equal('note' in output, false, 'empty object multi — note absent');
    },
    'name': 'empty object round-trip produces valid lift result',
    'schemas': [EmptyObjectSchema]
  }
];

void describe('quad round-trip: multi-instance and enum', () => {
  for (const {
    check, name, schemas
  } of multiEnumScenarios) {
    void it(name, () => {
      const jt = JsonTology.create({
        'baseIRI': BASE_IRI,
        'schemas': schemas
      });

      check(jt);
    });
  }
});
