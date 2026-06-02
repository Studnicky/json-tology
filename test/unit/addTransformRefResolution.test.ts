/**
 * Registry-resolved decode input for instance-bound transforms.
 *
 * `jt.addTransform(WireSchema, { decode, encode })` types the `decode` input as
 * `InferSchemaType<TSchema, TSchema, TRefs>`, where `TRefs` is the instance's
 * RAW-schema references map (set by `JsonTology.create` /`set` from the
 * registered schemas). So a wire schema whose properties `$ref` registered
 * primitives / nested sub-schemas gets a FULLY TYPED `input` — readable directly
 * (`input.title` is `string`, `input.nested.inner` is `string`, `input.flag` is
 * `boolean`) with NO caller-supplied references type param and NO hand-written
 * decode-read view. Contrast `Transform.create` (static, no registry), whose
 * decode input resolves cross-`$ref` leaves to `unknown`/`{}`.
 *
 * This test is the type-level guarantee: it compiles only if the `$ref` leaves
 * resolve to concrete primitive types. The runtime assertions confirm the decode
 * actually runs at `instantiate` time and reads the values through.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';

const NameSchema = {
  '$id': 'urn:codec:Name',
  'minLength': 1,
  'type': 'string'
} as const;

const PriceSchema = {
  '$id': 'urn:codec:Price',
  'minimum': 0,
  'type': 'number'
} as const;

const ActiveSchema = {
  '$id': 'urn:codec:Active',
  'type': 'boolean'
} as const;

const VendorSchema = {
  '$id': 'urn:codec:Vendor',
  'properties': { 'vendorName': { '$ref': 'urn:codec:Name' } },
  'type': 'object'
} as const;

const ProductWireSchema = {
  '$id': 'urn:codec:ProductWire',
  'additionalProperties': true,
  'properties': {
    'active': { '$ref': 'urn:codec:Active' },
    'price': { '$ref': 'urn:codec:Price' },
    'title': { '$ref': 'urn:codec:Name' },
    'vendor': { '$ref': 'urn:codec:Vendor' }
  },
  'type': 'object'
} as const;

interface ProductOut {
  'amount': number;
  'kind': 'product';
  'label': string;
  'live': boolean;
  'seller': string;
}

void describe('addTransform decode input resolves registered $refs to readable types', { 'concurrency': true }, () => {
  void it('reads $ref-typed leaves (string/number/boolean/nested) off the decode input with no view', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:codec',
      'schemas': [
        NameSchema,
        PriceSchema,
        ActiveSchema,
        VendorSchema,
        ProductWireSchema
      ]
    });

    const codec = jt.addTransform(ProductWireSchema, {
      // `input` is fully typed from the registry: title/seller → string,
      // price → number, active → boolean. Reading these compiles ONLY because
      // the $refs resolved (otherwise they'd be `{}`/`unknown`).
      'decode': (input): ProductOut => {
        const label: string = input.title ?? '';
        const amount: number = input.price ?? 0;
        const live: boolean = input.active ?? false;
        const seller: string = input.vendor?.vendorName ?? '';

        return {
          'amount': amount,
          'kind': 'product',
          'label': label,
          'live': live,
          'seller': seller
        };
      },
      'encode': (out): Record<string, unknown> => {
        return {
          'active': out.live,
          'price': out.amount,
          'title': out.label,
          'vendor': { 'vendorName': out.seller }
        };
      }
    });

    // Passing the codec (a TransformedType) selects the schema-object overload,
    // whose ParseOutputType is the decoded ProductOut — no cast.
    const decoded = jt.instantiate(codec, {
      'active': true,
      'price': 19.99,
      'title': 'Widget',
      'vendor': { 'vendorName': 'Acme' }
    });

    assert.equal(decoded.kind, 'product');
    assert.equal(decoded.label, 'Widget');
    assert.equal(decoded.amount, 19.99);
    assert.equal(decoded.live, true);
    assert.equal(decoded.seller, 'Acme');

    // The codec round-trips back to the wire shape through encode.
    const reEncoded = jt.encode(codec, decoded) as { 'title'?: unknown };

    assert.equal(reEncoded.title, 'Widget');
  });
});
