/**
 * Integration tests for JsonTology.prefetch and the `prefetched` option on
 * JsonTology.create.
 *
 * `prefetch` runs the async transitive `$ref` walk via a loader and returns a
 * snapshot. `create()` consumes the snapshot synchronously via `prefetched`.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import type { LoaderType } from '../../src/types/Loader.js';
import {
  GraphError, JsonTology, Loaders
} from '../../src/index.js';

const AddressSchema = {
  '$id': 'https://schema.example/Address',
  'properties': {
    'city': { 'type': 'string' },
    'zip': { 'type': 'string' }
  },
  'required': ['city'],
  'type': 'object'
} as const;

const UserSchema = {
  '$id': 'https://schema.example/User',
  'properties': {
    'address': { '$ref': 'https://schema.example/Address' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const ProductSchema = {
  '$id': 'https://schema.example/Product',
  'properties': { 'sku': { 'type': 'string' } },
  'required': ['sku'],
  'type': 'object'
} as const;

const LineItemSchema = {
  '$id': 'https://schema.example/LineItem',
  'properties': {
    'product': { '$ref': 'https://schema.example/Product' },
    'qty': { 'type': 'number' }
  },
  'required': ['qty'],
  'type': 'object'
} as const;

const OrderSchema = {
  '$id': 'https://schema.example/Order',
  'properties': {
    'item': { '$ref': 'https://schema.example/LineItem' },
    'orderId': { 'type': 'string' }
  },
  'required': ['orderId'],
  'type': 'object'
} as const;

const schemaMap = {
  [AddressSchema.$id]: AddressSchema,
  [LineItemSchema.$id]: LineItemSchema,
  [OrderSchema.$id]: OrderSchema,
  [ProductSchema.$id]: ProductSchema,
  [UserSchema.$id]: UserSchema
} as const;

void describe('JsonTology.prefetch', () => {
  void it('happy: walks transitive refs from seed schemas and returns a snapshot', async () => {
    const snapshot = await JsonTology.prefetch({
      'loader': Loaders.memory(schemaMap),
      'schemas': [UserSchema]
    });

    assert.strictEqual(snapshot.version, 1);
    assert.ok(snapshot.schemas.has(UserSchema.$id), 'seed schema present');
    assert.ok(snapshot.schemas.has(AddressSchema.$id), 'transitive ref resolved');
  });

  void it('happy: deep chain (Order -> LineItem -> Product) closes', async () => {
    const snapshot = await JsonTology.prefetch({
      'loader': Loaders.memory(schemaMap),
      'schemas': [OrderSchema]
    });

    assert.ok(snapshot.schemas.has(OrderSchema.$id));
    assert.ok(snapshot.schemas.has(LineItemSchema.$id));
    assert.ok(snapshot.schemas.has(ProductSchema.$id));
  });

  void it('happy: rootIds loads schemas directly without a seed', async () => {
    const snapshot = await JsonTology.prefetch({
      'loader': Loaders.memory(schemaMap),
      'rootIds': [UserSchema.$id]
    });

    assert.ok(snapshot.schemas.has(UserSchema.$id));
    assert.ok(snapshot.schemas.has(AddressSchema.$id));
  });

  void it('unhappy: throws REF_UNRESOLVED when loader returns null for a required IRI', async () => {
    await assert.rejects(
      async () => {
        return JsonTology.prefetch({
          'loader': Loaders.memory({}),
          'schemas': [UserSchema]
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError);
        assert.strictEqual(err.code, 'REF_UNRESOLVED');
        assert.match(
          err.pointer ?? '',
          /https:\/\/schema\.example\/Address/u,
          `pointer should contain the unresolved IRI, got: ${err.pointer}`
        );

        return true;
      }
    );
  });

  void it('edge: duplicate ref IRIs only call loader once (visited-set dedup)', async () => {
    let callCount = 0;

    const DupRefSchema = {
      '$id': 'https://schema.example/DupRef',
      'properties': {
        'a': { '$ref': 'https://schema.example/Address' },
        'b': { '$ref': 'https://schema.example/Address' }
      },
      'type': 'object'
    } as const;

    const trackingLoader: LoaderType = async (iri: string) => {
      callCount++;

      return (schemaMap as Record<string, Record<string, unknown>>)[iri] ?? null;
    };

    await JsonTology.prefetch({
      'loader': trackingLoader,
      'schemas': [DupRefSchema]
    });

    assert.strictEqual(callCount, 1, 'loader called exactly once for deduplicated IRI');
  });

  void it('edge: schema with no unregistered refs resolves without loader calls', async () => {
    let callCount = 0;

    const loader: LoaderType = async (_: string) => {
      callCount++;

      return null;
    };

    await JsonTology.prefetch({
      'loader': loader,
      'schemas': [AddressSchema]
    });

    assert.strictEqual(callCount, 0, 'loader not called when all refs are local');
  });
});

void describe('JsonTology.create with prefetched snapshot', () => {
  void it('happy: validates against a transitively prefetched schema', async () => {
    const snapshot = await JsonTology.prefetch({
      'loader': Loaders.memory(schemaMap),
      'schemas': [UserSchema]
    });

    const jt = JsonTology.create({
      'baseIRI': 'https://schema.example',
      'prefetched': snapshot,
      'schemas': [UserSchema] as const
    });

    const errors = jt.validate(UserSchema, {
      'address': { 'city': 'London' },
      'name': 'Alice'
    });

    assert.ok(errors.ok, `validation should pass, errors: ${JSON.stringify(errors.items)}`);
    assert.ok(jt.registry.has(AddressSchema.$id), 'transitive schema available via registry');
  });

  void it('happy: schemas passed to create() win over snapshot on $id collision', async () => {
    const snapshot = await JsonTology.prefetch({
      'loader': Loaders.memory(schemaMap),
      'rootIds': [AddressSchema.$id]
    });

    const OverrideAddressSchema = {
      '$id': 'https://schema.example/Address',
      'properties': { 'overridden': { 'type': 'boolean' } },
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': 'https://schema.example',
      'prefetched': snapshot,
      'schemas': [OverrideAddressSchema] as const
    });

    const registered = jt.registry.get(AddressSchema.$id);

    assert.deepStrictEqual(registered?.properties, OverrideAddressSchema.properties);
  });
});
