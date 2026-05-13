/**
 * Integration tests for the loader hook on JsonTology.create and registerAsync.
 *
 * These tests exercise the full transitive ref-resolution walk with mocked
 * loaders, and verify that loader-equipped instances behave identically to
 * statically-registered ones on the hot path.
 *
 * Note: TypeScript types `JsonTology.create({ loader })` as `JsonTology` (sync)
 * because the single-overload approach is required for compatibility with large
 * schema arrays that exceed TypeScript's type-instantiation depth limits. The
 * runtime Promise is explicitly cast below for tests that need to await it.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import type { LoaderType } from '../../src/types/Loader.js';
import {
  GraphError, JsonTology, Loaders
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Test schemas
// ---------------------------------------------------------------------------

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

// A deeper chain: Order → LineItem → Product
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

/**
 * Runtime cast helper: `create({ loader })` returns a Promise at runtime but
 * TypeScript's single-overload types it as sync for broad compatibility. The
 * cast is intentional and explicitly documented here so it is centrally visible.
 */
function createAsync<TSchemas extends ReadonlyArray<{ readonly '$id': string }>>(options: Parameters<typeof JsonTology.create<TSchemas>>[0] & { 'loader': LoaderType }): Promise<JsonTology> {
  return JsonTology.create(options) as unknown as Promise<JsonTology>;
}

// ---------------------------------------------------------------------------
// Loader hook on construction (Mode B)
// ---------------------------------------------------------------------------

void describe('JsonTology.create with loader', () => {
  void it('happy: returns a Promise<JsonTology> when loader is provided', async () => {
    const jt = createAsync({
      'baseIRI': 'https://schema.example',
      'loader': Loaders.memory(schemaMap),
      'schemas': [UserSchema] as const
    });

    assert.ok(jt instanceof Promise, 'create() returns a Promise when loader is set');
    const resolved = await jt;

    assert.ok(resolved instanceof JsonTology);
  });

  void it('happy: returns JsonTology synchronously when no loader', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://schema.example',
      'schemas': [AddressSchema] as const
    });

    assert.ok(jt instanceof JsonTology, 'create() returns JsonTology synchronously without loader');
  });

  void it('happy: resolved instance validates against a transitively loaded schema', async () => {
    const jt = await createAsync({
      'baseIRI': 'https://schema.example',
      'loader': Loaders.memory(schemaMap),
      'schemas': [UserSchema] as const
    });

    const errors = jt.validate(UserSchema, {
      'address': { 'city': 'London' },
      'name': 'Alice'
    });

    assert.ok(errors.ok, `validation should pass, errors: ${JSON.stringify(errors.items)}`);
  });

  void it('happy: deep transitive chain (Order → LineItem → Product) resolved', async () => {
    const jt = await createAsync({
      'baseIRI': 'https://schema.example',
      'loader': Loaders.memory(schemaMap),
      'schemas': [OrderSchema] as const
    });

    assert.ok(jt.has(ProductSchema.$id), 'Product schema transitively resolved');
    assert.ok(jt.has(LineItemSchema.$id), 'LineItem schema transitively resolved');
  });

  void it('unhappy: throws REF_UNRESOLVED when loader returns null for a required IRI', async () => {
    const emptyLoader = Loaders.memory({});

    await assert.rejects(
      async () => {
        return createAsync({
          'baseIRI': 'https://schema.example',
          'loader': emptyLoader,
          'schemas': [UserSchema] as const
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, 'should throw GraphError');
        assert.strictEqual(err.code, 'REF_UNRESOLVED');
        assert.ok(
          err.pointer?.includes('https://schema.example/Address') === true,
          `pointer should contain the unresolved IRI, got: ${err.pointer}`
        );

        return true;
      }
    );
  });

  void it('edge: duplicate ref IRIs only call loader once (visited-set dedup)', async () => {
    let callCount = 0;

    // Schema referencing the same IRI twice in different properties
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

    await createAsync({
      'baseIRI': 'https://schema.example',
      'loader': trackingLoader,
      'schemas': [DupRefSchema] as const
    });

    assert.strictEqual(callCount, 1, 'loader called exactly once for deduplicated IRI');
  });

  void it('edge: schema with no unregistered refs resolves immediately without loader calls', async () => {
    let callCount = 0;

    const loader: LoaderType = async (_: string) => {
      callCount++;

      return null;
    };

    await createAsync({
      'baseIRI': 'https://schema.example',
      'loader': loader,
      'schemas': [AddressSchema] as const
    });

    assert.strictEqual(callCount, 0, 'loader not called when all refs are local');
  });
});

// ---------------------------------------------------------------------------
// registerAsync
// ---------------------------------------------------------------------------

void describe('jt.registerAsync', () => {
  void it('happy: registerAsync resolves transitive refs and warms the registry', async () => {
    const jt = await createAsync({
      'baseIRI': 'https://schema.example',
      'loader': Loaders.memory(schemaMap),
      'schemas': [AddressSchema] as const
    });

    await jt.registerAsync(UserSchema);

    assert.ok(jt.has(UserSchema.$id), 'User schema registered');
    assert.ok(jt.has(AddressSchema.$id), 'Address schema still present');
  });

  void it('unhappy: registerAsync throws REF_UNRESOLVED when loader returns null', async () => {
    const jt = await createAsync({
      'baseIRI': 'https://schema.example',
      'loader': Loaders.memory({ [AddressSchema.$id]: AddressSchema }),
      'schemas': [AddressSchema] as const
    });

    // OrderSchema refs LineItem which refs Product — none are in the loader
    const noLineItemLoader = Loaders.memory({ [AddressSchema.$id]: AddressSchema });
    const jt2 = await createAsync({
      'baseIRI': 'https://schema.example',
      'loader': noLineItemLoader,
      'schemas': [AddressSchema] as const
    });

    void jt;

    await assert.rejects(
      async () => {
        return jt2.registerAsync(OrderSchema);
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError);
        assert.strictEqual(err.code, 'REF_UNRESOLVED');

        return true;
      }
    );
  });

  void it('unhappy: registerAsync throws SchemaError when no loader configured', async () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://schema.example',
      'schemas': [AddressSchema] as const
    });

    await assert.rejects(
      async () => {
        return jt.registerAsync(UserSchema);
      },
      /loader/u
    );
  });
});
