/**
 * Direct unit tests for RefDecoder.
 *
 * RefDecoder.run() walks a SchemaGraph alongside a value and applies
 * registered Transform decoders at every $ref boundary. We drive it through
 * real SchemaGraph + Transform instances — no mocking.
 *
 * For cross-schema decoder behaviour we exercise via JsonTology.instantiate()
 * (the observable integration point). For local-fragment and null/undefined
 * edge-cases we drive RefDecoder.run() directly with a minimal registry stub.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import {
  JsonTology, Transform
} from '../../src/index.js';
import { brand } from '../../src/types/Brand.js';
import type { InferSchemaType } from '../../src/types/Infer.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { RefDecoder } from '../../src/modules/graph/RefDecoder.js';
import type { RefDecoderRegistryInterface } from '../../src/interfaces/RefDecoderRegistry.js';

// ---------------------------------------------------------------------------
// Minimal registry stubs — used when we drive RefDecoder.run directly
// ---------------------------------------------------------------------------

/** Registry stub that knows about no schemas — simulates an isolated graph walk. */
const emptyRegistry: RefDecoderRegistryInterface = {
  'getGraph': (_schema: Record<string, unknown>) => {
    return _schema.$id === '__never__' ? undefined : undefined;
  },
  'getSchema': (_id: string) => {
    return _id === '__never__' ? undefined : undefined;
  },
  'resolveSchemaId': (rawId: string) => {
    return rawId;
  }
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DateRawSchema = {
  '$id': 'https://example.io/Date',
  'format': 'date-time',
  'type': 'string'
} as const;

// Normalize transform: decode canonicalizes a raw date string into the schema's
// canonical (branded) ISO date-time form; encode is the inverse pass-through.
const DateSchema = Transform.create(DateRawSchema, {
  'decode': (raw: string) => {
    return brand<InferSchemaType<typeof DateRawSchema>>(new Date(raw).toISOString());
  },
  'encode': (value) => {
    return value;
  }
});

const EventSchema = {
  '$id': 'https://example.io/Event',
  'properties': {
    'name': { 'type': 'string' },
    'startedAt': { '$ref': 'https://example.io/Date' }
  },
  'required': [
    'name',
    'startedAt'
  ],
  'type': 'object'
} as const;

const SelfRefSchema = {
  '$defs': {
    'Node': {
      'properties': {
        'child': { '$ref': '#/$defs/Node' },
        'label': { 'type': 'string' }
      },
      'type': 'object'
    }
  },
  '$id': 'https://example.io/SelfRef',
  'properties': { 'root': { '$ref': '#/$defs/Node' } },
  'type': 'object'
} as const;

const WrapperSchema = {
  '$id': 'https://example.io/Wrapper',
  'properties': { 'event': { '$ref': 'https://example.io/Event' } },
  'type': 'object'
} as const;

const EnumRefSchema = {
  '$defs': {
    'Color': {
      'enum': [
        'red',
        'green',
        'blue'
      ],
      'type': 'string'
    }
  },
  '$id': 'https://example.io/Palette',
  'properties': { 'color': { '$ref': '#/$defs/Color' } },
  'type': 'object'
} as const;

const UnregisteredRefSchema = {
  '$id': 'https://example.io/Orphan',
  'properties': { 'x': { '$ref': 'https://does-not-exist.io/Unknown' } },
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('RefDecoder.run()', { 'concurrency': true }, () => {
  void it('returns null unchanged — no graph walk needed for null root', () => {
    const graph = new SchemaGraph(EventSchema);

    const result = RefDecoder.run(graph, null, emptyRegistry);

    assert.equal(result, null);
  });

  void it('returns undefined unchanged', () => {
    const graph = new SchemaGraph(EventSchema);

    const result = RefDecoder.run(graph, undefined, emptyRegistry);

    assert.equal(result, undefined);
  });

  void it('applies cross-schema decoder at $ref boundary (via instantiate)', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.io',
      'schemas': [
        DateSchema,
        EventSchema
      ] as const
    });

    // The cross-schema decoder fires at the $ref boundary, normalizing the raw
    // date string into the canonical ISO date-time form.
    const result = jt.instantiate(EventSchema.$id, {
      'name': 'Launch',
      'startedAt': '2024-06-01'
    }) as unknown as {
      'name': string;
      'startedAt': string;
    };

    assert.equal(typeof result.startedAt, 'string', 'decoder should produce the canonical date-time string');
    assert.equal(result.startedAt, '2024-06-01T00:00:00.000Z', 'decoder should normalize to ISO');
  });

  void it('passes plain properties through unchanged when no decoder is registered', () => {
    const PlainSchema = {
      '$id': 'https://example.io/PlainObj',
      'properties': {
        'count': { 'type': 'number' },
        'label': { 'type': 'string' }
      },
      'type': 'object'
    } as const;

    const graph = new SchemaGraph(PlainSchema);
    const value = {
      'count': 7,
      'label': 'hello'
    };

    const result = RefDecoder.run(graph, value, emptyRegistry) as typeof value;

    assert.equal(result.count, 7);
    assert.equal(result.label, 'hello');
  });

  void it('terminates cleanly on self-referential schema — cycle detection', () => {
    const graph = new SchemaGraph(SelfRefSchema);
    const value = {
      'root': {
        'child': {
          'child': null,
          'label': 'inner'
        },
        'label': 'outer'
      }
    };

    // Must not throw (stack overflow / infinite recursion).
    assert.doesNotThrow(() => {
      RefDecoder.run(graph, value, emptyRegistry);
    });
  });

  void it('walks nested $ref in wrapping object schema (via instantiate)', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://example.io',
      'schemas': [
        DateSchema,
        EventSchema,
        WrapperSchema
      ] as const
    });

    // The nested cross-schema decoder fires through the wrapper at the $ref
    // boundary, normalizing the raw date string into the canonical ISO form.
    const result = jt.instantiate(WrapperSchema.$id, {
      'event': {
        'name': 'Demo',
        'startedAt': '2025-01-15'
      }
    }) as unknown as {
      'event': {
        'name': string;
        'startedAt': string;
      };
    };

    assert.equal(typeof result.event.startedAt, 'string', 'nested cross-schema decoder should fire through wrapper');
    assert.equal(result.event.startedAt, '2025-01-15T00:00:00.000Z');
  });

  void it('local fragment $ref (pointer) resolves without cross-schema lookup', () => {
    const graph = new SchemaGraph(EnumRefSchema);
    const value = { 'color': 'red' };

    // emptyRegistry cannot resolve cross-schema, but this $ref is local.
    // Color has no decoder, so value passes through unchanged.
    const result = RefDecoder.run(graph, value, emptyRegistry) as { 'color': string };

    assert.equal(result.color, 'red', 'local pointer $ref with no decoder should pass through');
  });

  void it('unregistered $ref target passes value through without throwing', () => {
    const graph = new SchemaGraph(UnregisteredRefSchema);
    const value = { 'x': 42 };

    assert.doesNotThrow(() => {
      const result = RefDecoder.run(graph, value, emptyRegistry) as { 'x': number };

      assert.equal(result.x, 42, 'unregistered $ref should not mutate value');
    });
  });

  void it('applies decoder for each array item via $ref items', () => {
    const TagSchema = Transform.create(
      {
        '$id': 'https://example.io/Tag',
        'type': 'string'
      } as const,
      {
        'decode': (raw: string) => {
          return raw.toLowerCase();
        },
        'encode': (str: string) => {
          return str;
        }
      }
    );

    const ListSchema = {
      '$id': 'https://example.io/TagList',
      'items': { '$ref': 'https://example.io/Tag' },
      'type': 'array'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': 'https://example.io',
      'schemas': [
        TagSchema,
        ListSchema
      ] as const
    });

    const result = jt.instantiate(ListSchema.$id, [
      'RED',
      'GREEN',
      'BLUE'
    ]) as string[];

    assert.deepEqual(result, [
      'red',
      'green',
      'blue'
    ], 'decoder should fire for each array item element');
  });
});
