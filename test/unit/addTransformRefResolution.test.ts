/**
 * Registry-resolved decode OUTPUT for instance-bound normalize transforms.
 *
 * `jt.addTransform(Schema, { decode, encode })` types the `decode` OUTPUT as
 * `InferSchemaType<TSchema, TSchema, TRefs>` — the schema's canonical form,
 * where `TRefs` is the instance's RAW-schema references map (set by
 * `JsonTology.create` / `set` from the registered schemas). So a schema whose
 * properties `$ref` registered primitives / nested sub-schemas gets a FULLY
 * TYPED canonical output: `title` resolves to a length-branded string, `price`
 * to a minimum-branded number, `active` to boolean, `vendor.vendorName` to a
 * branded string. `decode` consumes the raw wire payload (author-supplied,
 * decoupled from the schema) and produces that canonical form, branding each
 * resolved leaf explicitly.
 *
 * This is the type-level guarantee: it compiles only if the `$ref` leaves of the
 * canonical OUTPUT resolve to concrete branded types. The runtime assertions
 * confirm the decode runs at `instantiate` time and produces the canonical shape.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';
import { brand } from '../../src/modules/data/Brand.js';
import type {
  MinimumBrandType, MinLengthBrandType
} from '../../src/types/ConstraintBrands.js';

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

const ProductSchema = {
  '$id': 'urn:codec:Product',
  'additionalProperties': true,
  'properties': {
    'active': { '$ref': 'urn:codec:Active' },
    'price': { '$ref': 'urn:codec:Price' },
    'title': { '$ref': 'urn:codec:Name' },
    'vendor': { '$ref': 'urn:codec:Vendor' }
  },
  'type': 'object'
} as const;

// The raw wire payload is snake-cased, foreign-shaped, and decoupled from the
// schema. We read its fields with the dynamic accessor (`raw['is_active']`)
// rather than declaring a snake_case interface — wire keys belong to the
// source's contract, not ours.

void describe('addTransform decode output resolves registered $refs to readable canonical types', { 'concurrency': true }, () => {
  void it('produces a canonical output whose $ref-typed leaves resolve to branded types', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:codec',
      'schemas': [
        NameSchema,
        PriceSchema,
        ActiveSchema,
        VendorSchema,
        ProductSchema
      ]
    });

    const codec = jt.addTransform(ProductSchema, {
      // `decode` consumes the raw wire payload and produces the canonical form.
      // The output type is `InferSchemaType<ProductSchema, …, TRefs>`, so each
      // $ref-resolved leaf is branded — `brand()` infers the expected brand from
      // the contextual property type. This compiles ONLY because the $refs
      // resolved (title → length-branded string, price → minimum-branded number).
      'decode': (raw: Record<string, unknown>) => {
        const seller = raw['seller'] as Record<string, unknown>;

        return {
          'active': raw['is_active'] as boolean,
          'price': brand<MinimumBrandType<0> & number>(raw['sticker_price']),
          'title': brand<MinLengthBrandType<1> & string>(raw['wire_title']),
          'vendor': { 'vendorName': brand<MinLengthBrandType<1> & string>(seller['seller_name']) }
        };
      },
      // encode writes the wire keys through the dynamic accessor — they belong
      // to the source's contract, not declared as literal property names.
      'encode': (canonical) => {
        const wire: Record<string, unknown> = {};
        const seller: Record<string, unknown> = {};

        seller['seller_name'] = canonical.vendor?.vendorName ?? '';
        wire['is_active'] = canonical.active ?? false;
        wire['seller'] = seller;
        wire['sticker_price'] = canonical.price ?? 0;
        wire['wire_title'] = canonical.title ?? '';

        return wire;
      }
    });

    // Passing the codec (a TransformedType) selects the schema-object overload,
    // whose ParseOutputType is the canonical Product — no cast.
    const decoded = jt.instantiate(codec, {
      'is_active': true,
      'seller': { 'seller_name': 'Acme' },
      'sticker_price': 19.99,
      'wire_title': 'Widget'
    });

    assert.equal(decoded.title, 'Widget');
    assert.equal(decoded.price, 19.99);
    assert.equal(decoded.active, true);
    assert.equal(decoded.vendor?.vendorName, 'Acme');

    // The codec round-trips back to the wire shape through encode.
    const reEncoded = jt.encode(codec, decoded);
    const reEncodedSeller = reEncoded['seller'] as Record<string, unknown>;

    assert.equal(reEncoded['wire_title'], 'Widget');
    assert.equal(reEncodedSeller['seller_name'], 'Acme');
  });
});
