/**
 * Compose edge-case tests — boundary conditions and degenerate inputs
 * for extend, pick, omit, partial, required, intersection, discriminatedUnion.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Compose } from '../../src/modules/composition/compose.js';

const BaseSchema = {
  '$id': 'https://example.io/base',
  'properties': {
    'age': { 'type': 'number' },
    'email': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': [
    'name',
    'age'
  ],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// extend
// ---------------------------------------------------------------------------

type ComposeResult = Record<string, unknown> & {
  '$id': string;
  'properties': Record<string, unknown>;
  'required': string[];
};

interface ExtendScenario {
  'additionalProps': Record<string, { readonly 'type': string }>;
  'assertions': (result: ComposeResult) => void;
  'name': string;
  'newId': string;
}

const extendScenarios: ExtendScenario[] = [
  {
    'additionalProps': {},
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/extended-empty', 'extend empty properties — $id');
      assert.ok('name' in result.properties, 'extend empty properties — name present');
      assert.ok('age' in result.properties, 'extend empty properties — age present');
      assert.ok('email' in result.properties, 'extend empty properties — email present');
      assert.strictEqual(Object.keys(result.properties).length, 3, 'extend empty properties — count');
      assert.deepStrictEqual([...result.required].sort((left, right) => {
        return left.localeCompare(right);
      }), [
        'age',
        'name'
      ], 'extend empty properties — required');
    },
    'name': 'returns base schema unchanged when additional properties is empty',
    'newId': 'https://example.io/extended-empty'
  },
  {
    'additionalProps': { 'flag': { 'type': 'boolean' } },
    'assertions': (result) => {
      assert.strictEqual(result.$id, '', 'edge: extend empty $id — $id is empty string');
      assert.ok('name' in result.properties, 'edge: extend empty $id — name present');
      assert.ok('flag' in result.properties, 'edge: extend empty $id — flag present');
    },
    'name': 'edge: extend with empty $id produces schema with empty string $id',
    'newId': ''
  },
  {
    'additionalProps': { 'role': { 'type': 'string' } },
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/base', 'extend same $id — $id preserved');
      assert.ok('role' in result.properties, 'extend same $id — role present');
      assert.ok('name' in result.properties, 'extend same $id — name present');
    },
    'name': 'preserves $id from base when newId matches original — but newId always wins',
    'newId': 'https://example.io/base'
  },
  {
    'additionalProps': { 'extra': { 'type': 'boolean' } },
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/base', 'extend $id handling — $id preserved');
      assert.ok('extra' in result.properties, 'extend $id handling — extra present');
      assert.ok('name' in result.properties, 'extend $id handling — name present');
    },
    'name': 'preserves base $id when newId matches original',
    'newId': 'https://example.io/base'
  }
];

void describe('Compose.extend() edge cases', () => {
  for (const scenario of extendScenarios) {
    void it(scenario.name, () => {
      const result = Compose.extend(
        BaseSchema,
        scenario.additionalProps as Record<string, never>,
        scenario.newId
      ) as unknown as ComposeResult;

      scenario.assertions(result);
    });
  }
});

// ---------------------------------------------------------------------------
// pick
// ---------------------------------------------------------------------------

interface PickScenario {
  'assertions': (result: ComposeResult) => void;
  'keys': readonly string[];
  'name': string;
  'newId': string;
}

const pickScenarios: PickScenario[] = [
  {
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/pick-empty', 'pick zero keys — $id');
      assert.deepStrictEqual(result.properties, {}, 'pick zero keys — properties');
      assert.strictEqual(result.type, 'object', 'pick zero keys — type');
      assert.ok(!('required' in result) || result.required.length === 0, 'pick zero keys — required');
    },
    'keys': [],
    'name': 'returns schema with type:object and no properties when picking zero keys',
    'newId': 'https://example.io/pick-empty'
  },
  {
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/pick-missing', 'pick non-existent — $id');
      assert.deepStrictEqual(result.properties, {}, 'pick non-existent — properties');
      assert.ok(!('required' in result) || result.required.length === 0, 'pick non-existent — required');
    },
    'keys': [
      'nonexistent',
      'alsoMissing'
    ],
    'name': 'ignores properties that do not exist on source',
    'newId': 'https://example.io/pick-missing'
  },
  {
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/pick-ghost', 'edge: pick non-existent single — $id');
      assert.deepStrictEqual(result.properties, {}, 'edge: pick non-existent single — empty properties');
    },
    'keys': ['ghost'],
    'name': 'edge: pick with single non-existent property returns empty schema',
    'newId': 'https://example.io/pick-ghost'
  }
];

void describe('Compose.pick() edge cases', () => {
  for (const scenario of pickScenarios) {
    void it(scenario.name, () => {
      const result = Compose.pick(
        BaseSchema,
        scenario.keys as unknown as readonly never[],
        scenario.newId
      ) as unknown as ComposeResult;

      scenario.assertions(result);
    });
  }
});

// ---------------------------------------------------------------------------
// omit
// ---------------------------------------------------------------------------

interface OmitScenario {
  'assertions': (result: ComposeResult) => void;
  'keys': readonly string[];
  'name': string;
  'newId': string;
}

const omitScenarios: OmitScenario[] = [
  {
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/omit-all-required', 'omit all required — $id');
      assert.ok(!('name' in result.properties), 'omit all required — name removed');
      assert.ok(!('age' in result.properties), 'omit all required — age removed');
      assert.ok('email' in result.properties, 'omit all required — email remains');
      assert.ok(!('required' in result), 'omit all required — required absent');
    },
    'keys': [
      'name',
      'age'
    ],
    'name': 'produces empty or absent required array when all required fields are removed',
    'newId': 'https://example.io/omit-all-required'
  },
  {
    'assertions': (result) => {
      assert.ok(!('name' in result.properties), 'omit name — name removed');
      assert.ok('age' in result.properties, 'omit name — age remains');
      assert.ok('email' in result.properties, 'omit name — email remains');
      assert.ok(result.required.includes('age'), 'omit name — age still required');
      assert.ok(!result.required.includes('name'), 'omit name — name no longer required');
    },
    'keys': ['name'],
    'name': 'updates required array when a required property is removed',
    'newId': 'https://example.io/omit-name'
  }
];

void describe('Compose.omit() edge cases', () => {
  for (const scenario of omitScenarios) {
    void it(scenario.name, () => {
      const result = Compose.omit(
        BaseSchema,
        scenario.keys as unknown as readonly never[],
        scenario.newId
      ) as unknown as ComposeResult;

      scenario.assertions(result);
    });
  }
});

// ---------------------------------------------------------------------------
// partial
// ---------------------------------------------------------------------------

interface PartialScenario {
  'assertions': (result: ComposeResult) => void;
  'name': string;
  'newId': string;
  'schema': Record<string, unknown>;
}

const partialScenarios: PartialScenario[] = [
  {
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/still-optional', 'partial no-op — $id');
      assert.ok(!('required' in result), 'partial no-op — required absent');
      assert.ok('tag' in result.properties, 'partial no-op — tag present');
    },
    'name': 'is a no-op on a schema that already has no required',
    'newId': 'https://example.io/still-optional',
    'schema': {
      '$id': 'https://example.io/optional',
      'properties': { 'tag': { 'type': 'string' } },
      'type': 'object'
    }
  },
  {
    'assertions': (result) => {
      assert.ok(!('required' in result), 'partial then required — partial removes required');

      const restored = Compose.required(result, 'https://example.io/restored-base') as unknown as ComposeResult;

      assert.deepStrictEqual(
        [...restored.required].sort((left, right) => {
          return left.localeCompare(right);
        }),
        [
          'age',
          'email',
          'name'
        ],
        'partial then required — all restored'
      );
    },
    'name': 'partial then required restores all properties as required',
    'newId': 'https://example.io/partial-base',
    'schema': BaseSchema
  }
];

void describe('Compose.partial() edge cases', () => {
  for (const scenario of partialScenarios) {
    void it(scenario.name, () => {
      const result = Compose.partial(
        scenario.schema as never,
        scenario.newId
      ) as unknown as ComposeResult;

      scenario.assertions(result);
    });
  }
});

// ---------------------------------------------------------------------------
// intersection
// ---------------------------------------------------------------------------

type IntersectionResult = Record<string, unknown> & {
  '$id': string;
  'allOf': Array<Record<string, unknown>>;
};

interface IntersectionScenario {
  'assertions': (result: IntersectionResult) => void;
  'name': string;
  'newId': string;
  'schemas': ReadonlyArray<Record<string, unknown>>;
}

const intersectionScenarios: IntersectionScenario[] = [
  {
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/no-overlap', 'no overlap — $id');
      assert.strictEqual(result.allOf.length, 2, 'no overlap — allOf length');
      assert.deepStrictEqual(result.allOf[0], {
        '$id': 'https://example.io/a',
        'properties': { 'foo': { 'type': 'string' } },
        'type': 'object'
      }, 'no overlap — first schema');
      assert.deepStrictEqual(result.allOf[1], {
        '$id': 'https://example.io/b',
        'properties': { 'bar': { 'type': 'number' } },
        'type': 'object'
      }, 'no overlap — second schema');
    },
    'name': 'produces allOf with both schemas when properties do not overlap',
    'newId': 'https://example.io/no-overlap',
    'schemas': [
      {
        '$id': 'https://example.io/a',
        'properties': { 'foo': { 'type': 'string' } },
        'type': 'object'
      },
      {
        '$id': 'https://example.io/b',
        'properties': { 'bar': { 'type': 'number' } },
        'type': 'object'
      }
    ]
  },
  {
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/empty-allof', 'edge: empty allOf — $id');
      assert.strictEqual(result.allOf.length, 0, 'edge: empty allOf — allOf is empty');
    },
    'name': 'edge: intersection with empty schemas array produces empty allOf',
    'newId': 'https://example.io/empty-allof',
    'schemas': []
  },
  {
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/conflicting', 'conflicting types — $id');
      assert.strictEqual(result.allOf.length, 2, 'conflicting types — allOf length');
      assert.strictEqual(
        (result.allOf[0]).type,
        'string',
        'conflicting types — first type'
      );
      assert.strictEqual(
        (result.allOf[1]).type,
        'number',
        'conflicting types — second type'
      );
    },
    'name': 'produces unsatisfiable allOf when types conflict',
    'newId': 'https://example.io/conflicting',
    'schemas': [
      {
        '$id': 'https://example.io/str',
        'type': 'string'
      },
      {
        '$id': 'https://example.io/num',
        'type': 'number'
      }
    ]
  }
];

void describe('Compose.intersection() edge cases', () => {
  for (const scenario of intersectionScenarios) {
    void it(scenario.name, () => {
      const result = Compose.intersection(
        scenario.schemas as unknown as readonly never[],
        scenario.newId
      ) as unknown as IntersectionResult;

      scenario.assertions(result);
    });
  }
});

// ---------------------------------------------------------------------------
// discriminatedUnion
// ---------------------------------------------------------------------------

type DiscriminatedUnionResult = Record<string, unknown> & {
  '$id': string;
  'discriminator': Record<string, unknown>;
  'oneOf': Array<Record<string, unknown>>;
};

interface DiscriminatedUnionScenario {
  'assertions': (result: DiscriminatedUnionResult) => void;
  'discriminator': string;
  'name': string;
  'newId': string;
  'variants': ReadonlyArray<Record<string, unknown>>;
}

const discriminatedUnionScenarios: DiscriminatedUnionScenario[] = [
  {
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/single-variant', 'single variant — $id');
      assert.deepStrictEqual(result.discriminator, { 'propertyName': 'kind' }, 'single variant — discriminator');
      assert.strictEqual(result.oneOf.length, 1, 'single variant — oneOf length');
      assert.deepStrictEqual(result.oneOf[0], {
        '$id': 'https://example.io/circle',
        'properties': {
          'kind': { 'const': 'circle' },
          'radius': { 'type': 'number' }
        },
        'required': ['kind'],
        'type': 'object'
      }, 'single variant — variant content');
    },
    'discriminator': 'kind',
    'name': 'handles degenerate case with only one variant',
    'newId': 'https://example.io/single-variant',
    'variants': [{
      '$id': 'https://example.io/circle',
      'properties': {
        'kind': { 'const': 'circle' },
        'radius': { 'type': 'number' }
      },
      'required': ['kind'],
      'type': 'object'
    }]
  },
  {
    'assertions': (result) => {
      assert.strictEqual(result.$id, 'https://example.io/mixed-discriminator', 'mixed discriminator — $id');
      assert.deepStrictEqual(result.discriminator, { 'propertyName': 'tag' }, 'mixed discriminator — discriminator');
      assert.strictEqual(result.oneOf.length, 2, 'mixed discriminator — oneOf length');

      const first = result.oneOf[0];
      const second = result.oneOf[1];
      const firstProps = first.properties as Record<string, Record<string, unknown>>;
      const secondProps = second.properties as Record<string, Record<string, unknown>>;

      assert.strictEqual(firstProps.tag.type, 'string', 'mixed discriminator — first tag type');
      assert.strictEqual(secondProps.tag.type, 'number', 'mixed discriminator — second tag type');
    },
    'discriminator': 'tag',
    'name': 'accepts variants where discriminator property has different types',
    'newId': 'https://example.io/mixed-discriminator',
    'variants': [
      {
        '$id': 'https://example.io/v-string',
        'properties': { 'tag': { 'type': 'string' } },
        'type': 'object'
      },
      {
        '$id': 'https://example.io/v-number',
        'properties': { 'tag': { 'type': 'number' } },
        'type': 'object'
      }
    ]
  }
];

void describe('Compose.discriminatedUnion() edge cases', () => {
  for (const scenario of discriminatedUnionScenarios) {
    void it(scenario.name, () => {
      const result = Compose.discriminatedUnion(
        scenario.discriminator,
        scenario.variants as unknown as readonly never[],
        scenario.newId
      ) as unknown as DiscriminatedUnionResult;

      scenario.assertions(result);
    });
  }
});
