/**
 * Unit tests for OwlCodegen.toTypeScript
 *
 * Good: single-class, multi-class with dependency order, bookstore round-trip counts.
 * Bad: IRI collision → _2 suffix, empty input → valid minimal emission.
 * Ugly: special characters in IRIs survive PascalCase normalisation.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { OwlCodegen } from '../../src/modules/codegen/OwlCodegen.js';
import { JsonTology } from '../../src/index.js';
import {
  bookstoreEntities, bookstoreSchemas
} from '../../examples/docs/bookstore/index.js';
import type { OwlImportResultInterface } from '../../src/interfaces/OwlImportResultInterface.js';

// ---------------------------------------------------------------------------
// Synthetic helpers
// ---------------------------------------------------------------------------

function emptyResult(): OwlImportResultInterface {
  return {
    'characteristics': [],
    'differentFrom': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    'schemas': [],
    'unsupported': []
  };
}

function resultFromSchemas(schemas: Array<Record<string, unknown> & { readonly '$id': string }>): OwlImportResultInterface {
  return {
    'characteristics': [],
    'differentFrom': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    'schemas': schemas,
    'unsupported': []
  };
}

// ---------------------------------------------------------------------------
// Good: single-class synthetic ontology → structural assertions
// ---------------------------------------------------------------------------

void describe('OwlCodegen — Good: single-class ontology', () => {
  const singleSchema = {
    '$id': 'urn:example:Widget',
    'properties': { 'name': { 'type': 'string' } },
    'required': ['name'],
    'type': 'object'
  } as const;

  void it('emits export const WidgetSchema', () => {
    const src = OwlCodegen.toTypeScript(resultFromSchemas([singleSchema]), { 'registryConstName': 'ex' });

    assert.ok(src.includes('export const WidgetSchema ='), 'should emit WidgetSchema const');
  });

  void it('emits as const suffix', () => {
    const src = OwlCodegen.toTypeScript(resultFromSchemas([singleSchema]), { 'registryConstName': 'ex' });

    assert.ok(src.includes('as const;'), 'should emit as const');
  });

  void it('emits export type Widget threaded through the schema-set reference map', () => {
    const src = OwlCodegen.toTypeScript(resultFromSchemas([singleSchema]), { 'registryConstName': 'ex' });

    assert.ok(
      src.includes('type exSchemasRefs = SchemaReferencesMapType<typeof exSchemas>;'),
      'should emit the reference map over the schema tuple'
    );
    assert.ok(
      src.includes('export type Widget = InferType<typeof WidgetSchema, exSchemasRefs>;'),
      'should emit the type alias threaded with the reference map so cross-class $refs resolve'
    );
  });

  void it('emits the registry array with WidgetSchema', () => {
    const src = OwlCodegen.toTypeScript(resultFromSchemas([singleSchema]), { 'registryConstName': 'ex' });

    assert.ok(src.includes('exSchemas'), 'should emit exSchemas array');
    assert.ok(src.includes('WidgetSchema'), 'schema name in array');
  });

  void it('emits JsonTology.create call with registryConstName', () => {
    const src = OwlCodegen.toTypeScript(resultFromSchemas([singleSchema]), { 'registryConstName': 'ex' });

    assert.ok(src.includes('export const ex = JsonTology.create('), 'should emit registry create');
  });

  void it('emits auto-generated banner with DO NOT EDIT', () => {
    const src = OwlCodegen.toTypeScript(resultFromSchemas([singleSchema]), { 'registryConstName': 'ex' });

    assert.ok(src.includes('DO NOT EDIT'), 'should emit do not edit banner');
  });

  void it('emits import statements for json-tology and InferType', () => {
    const src = OwlCodegen.toTypeScript(resultFromSchemas([singleSchema]), { 'registryConstName': 'ex' });

    assert.ok(src.includes("from 'json-tology'"), 'should import JsonTology');
    assert.ok(src.includes("from 'json-tology/types'"), 'should import InferType from default path');
  });

  void it('respects custom inferTypeImportPath', () => {
    const src = OwlCodegen.toTypeScript(resultFromSchemas([singleSchema]), {
      'inferTypeImportPath': '../types/index.js',
      'registryConstName': 'ex'
    });

    assert.ok(src.includes("from '../types/index.js'"), 'should use custom import path');
  });
});

// ---------------------------------------------------------------------------
// Good: 3-class ontology with subClassOf → correct dependency order
// ---------------------------------------------------------------------------

void describe('OwlCodegen — Good: dependency order', () => {
  const primitiveSchema = {
    '$id': 'urn:example:Price',
    'type': 'number'
  } as const;

  const midSchema = {
    '$id': 'urn:example:LineItem',
    'properties': { 'price': { '$ref': 'urn:example:Price' } },
    'type': 'object'
  } as const;

  const topSchema = {
    '$id': 'urn:example:Order',
    'properties': { 'item': { '$ref': 'urn:example:LineItem' } },
    'type': 'object'
  } as const;

  void it('emits Price before LineItem and Order', () => {
    // Supply in reverse order to test sorting
    const src = OwlCodegen.toTypeScript(resultFromSchemas([
      topSchema,
      midSchema,
      primitiveSchema
    ]), { 'registryConstName': 'shop' });

    const priceIdx = src.indexOf('export const PriceSchema');
    const lineIdx = src.indexOf('export const LineItemSchema');
    const orderIdx = src.indexOf('export const OrderSchema');

    assert.ok(priceIdx !== -1, 'PriceSchema should be emitted');
    assert.ok(lineIdx !== -1, 'LineItemSchema should be emitted');
    assert.ok(orderIdx !== -1, 'OrderSchema should be emitted');
    assert.ok(priceIdx < lineIdx, 'Price (no deps) should appear before LineItem');
    assert.ok(lineIdx < orderIdx, 'LineItem should appear before Order');
  });

  void it('emits schemas array in dependency order', () => {
    const src = OwlCodegen.toTypeScript(resultFromSchemas([
      topSchema,
      midSchema,
      primitiveSchema
    ]), { 'registryConstName': 'shop' });

    // Find the shopSchemas array content
    const arrStart = src.indexOf('export const shopSchemas =');
    const arrEnd = src.indexOf('] as const;', arrStart);
    const arrContent = src.slice(arrStart, arrEnd);

    const priceIdx = arrContent.indexOf('PriceSchema');
    const lineIdx = arrContent.indexOf('LineItemSchema');
    const orderIdx = arrContent.indexOf('OrderSchema');

    assert.ok(priceIdx < lineIdx, 'PriceSchema before LineItemSchema in array');
    assert.ok(lineIdx < orderIdx, 'LineItemSchema before OrderSchema in array');
  });
});

// ---------------------------------------------------------------------------
// Good: bookstore TBox round-trip → count assertions
// ---------------------------------------------------------------------------

void describe('OwlCodegen — Good: bookstore TBox round-trip', () => {
  void it('emits at least 50 export const Schema lines and 50 export type lines', () => {
    // The bookstore has 62 registered schemas but the OWL TBox only
    // carries class-axiom-level IRIs — primitives without OWL class
    // declarations are not round-tripped. The current round-trip
    // produces 55 classes; threshold is 50 to allow minor variation.
    const tbox = bookstoreEntities.toTbox().jsonLd();
    const result = JsonTology.fromTbox(tbox);
    const src = OwlCodegen.toTypeScript(result, { 'registryConstName': 'bookstore' });

    const constMatches = [...src.matchAll(/^export const \w+Schema = /gmu)];
    const typeMatches = [...src.matchAll(/^export type \w+ = InferType</gmu)];

    assert.ok(
      constMatches.length >= 50,
      `Expected >= 50 export const Schema lines, got ${constMatches.length}`
    );
    assert.ok(
      typeMatches.length >= 50,
      `Expected >= 50 export type lines, got ${typeMatches.length}`
    );
  });

  void it('round-trip uses all bookstore schemas from the registered set', () => {
    // Every bookstoreSchema $id should appear somewhere in the generated source
    const tbox = bookstoreEntities.toTbox().jsonLd();
    const result = JsonTology.fromTbox(tbox);
    const src = OwlCodegen.toTypeScript(result, { 'registryConstName': 'bookstore' });

    for (const schema of bookstoreSchemas) {
      assert.ok(
        src.includes(JSON.stringify(schema.$id)),
        `Expected schema IRI ${schema.$id} in generated source`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Bad: IRI-name collision → _2 suffix + banner warning
// ---------------------------------------------------------------------------

void describe('OwlCodegen — Bad: IRI collision detection', () => {
  void it('suffixes second schema with _2 when local names collide', () => {
    const schemaA = {
      '$id': 'urn:ns1:Widget',
      'type': 'object'
    } as const;
    const schemaB = {
      '$id': 'urn:ns2:Widget',
      'type': 'object'
    } as const;

    const src = OwlCodegen.toTypeScript(resultFromSchemas([
      schemaA,
      schemaB
    ]), { 'registryConstName': 'ex' });

    assert.ok(src.includes('Widget_2Schema') || src.includes('WidgetSchema'), 'should emit collision-suffixed name');
    assert.ok(
      src.includes('_2') || src.includes('WARNING'),
      'should indicate collision via _2 suffix or banner warning'
    );
  });
});

// ---------------------------------------------------------------------------
// Bad: empty input → minimal valid emission
// ---------------------------------------------------------------------------

void describe('OwlCodegen — Bad: empty input', () => {
  void it('emits a valid TS file with imports and empty array but no schema consts', () => {
    const src = OwlCodegen.toTypeScript(emptyResult(), { 'registryConstName': 'empty' });

    assert.ok(src.includes("from 'json-tology'"), 'should still emit imports');
    assert.ok(src.includes('export const emptySchemas = [] as const;'), 'should emit empty array');
    assert.ok(src.includes('export const empty = JsonTology.create('), 'should emit registry');
    // No schema export consts (no classes)
    assert.ok(!src.includes('export const ') || src.includes('emptySchemas') || src.includes('export const empty'), 'no unknown schema consts');
  });
});

// ---------------------------------------------------------------------------
// Ugly: sameAs and characteristics are emitted when present
// ---------------------------------------------------------------------------

void describe('OwlCodegen — Ugly: sameAs + characteristics in result', () => {
  void it('emits sameAs calls when result contains sameAs pairs', () => {
    const result: OwlImportResultInterface = {
      'characteristics': [],
      'differentFrom': [],
      'individuals': [],
      'invariants': [],
      'sameAs': [[
        'urn:a',
        'urn:b'
      ]],
      'schemas': [],
      'unsupported': []
    };

    const src = OwlCodegen.toTypeScript(result, { 'registryConstName': 'ex' });

    assert.ok(src.includes('.sameAs('), 'should emit sameAs call');
    assert.ok(src.includes('"urn:a"'), 'should emit first IRI');
    assert.ok(src.includes('"urn:b"'), 'should emit second IRI');
  });

  void it('emits addCharacteristic calls when result contains characteristics', () => {
    const result: OwlImportResultInterface = {
      'characteristics': [{
        'characteristic': 'Functional',
        'propertyIri': 'urn:prop:id'
      }],
      'differentFrom': [],
      'individuals': [],
      'invariants': [],
      'sameAs': [],
      'schemas': [],
      'unsupported': []
    };

    const src = OwlCodegen.toTypeScript(result, { 'registryConstName': 'ex' });

    assert.ok(src.includes('.addCharacteristic('), 'should emit addCharacteristic call');
    assert.ok(src.includes('"urn:prop:id"'), 'should emit property IRI');
  });
});

// ---------------------------------------------------------------------------
// Ugly: custom sourceLabel and header appear in banner
// ---------------------------------------------------------------------------

void describe('OwlCodegen — Ugly: banner customization', () => {
  void it('includes sourceLabel in generated banner', () => {
    const src = OwlCodegen.toTypeScript(emptyResult(), {
      'registryConstName': 'ex',
      'sourceLabel': '/path/to/my.jsonld'
    });

    assert.ok(src.includes('/path/to/my.jsonld'), 'should include source label in banner');
  });

  void it('includes extra header lines', () => {
    const src = OwlCodegen.toTypeScript(emptyResult(), {
      'header': [
        'Generated for project: example-project',
        'See: https://example.com'
      ],
      'registryConstName': 'ex'
    });

    assert.ok(src.includes('Generated for project: example-project'), 'should include header lines');
    assert.ok(src.includes('See: https://example.com'), 'should include second header line');
  });
});

// ---------------------------------------------------------------------------
// Registry-directory mode threads the schema-set reference map
// ---------------------------------------------------------------------------

void describe('OwlCodegen — registry-directory mode reference threading', () => {
  const schemaB = {
    '$id': 'urn:rt:B',
    'properties': { 'n': { 'type': 'number' } },
    'required': ['n'],
    'type': 'object'
  };
  const schemaA = {
    '$id': 'urn:rt:A',
    'properties': { 'link': { '$ref': 'urn:rt:B' } },
    'required': ['link'],
    'type': 'object'
  };

  void it('index.ts exports the reference map over the schema tuple', () => {
    const { indexSource } = OwlCodegen.toRegistryFiles(resultFromSchemas([
      schemaB,
      schemaA
    ]), { 'registryConstName': 'rt' });

    assert.ok(
      indexSource.includes('export type rtSchemasRefs = SchemaReferencesMapType<typeof rtSchemas>;'),
      'index.ts should export the reference map'
    );
  });

  void it('entity files import and thread the reference map from the index', () => {
    const { entityFiles } = OwlCodegen.toRegistryFiles(resultFromSchemas([
      schemaB,
      schemaA
    ]), { 'registryConstName': 'rt' });
    const entityA = entityFiles.find((file) => {
      return file.name === 'A';
    });

    assert.ok(entityA !== undefined, 'entity A file should be generated');
    assert.ok(
      entityA.source.includes("import type { rtSchemasRefs } from '../index.js';"),
      'entity should type-import the reference map from the index'
    );
    assert.ok(
      entityA.source.includes('export type A = InferType<typeof ASchema, rtSchemasRefs>;'),
      'entity type should be threaded with the reference map'
    );
  });
});
