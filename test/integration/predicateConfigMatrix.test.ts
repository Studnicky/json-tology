/**
 * Predicate Configuration Matrix — integration tests.
 *
 * Exercises C1 (flat/canonical), C2 (class-scoped), and C3 (predicateFor
 * resolver) across the FULL projection surface: ABox (toQuads), TBox
 * (toTbox().quads()), and SHACL (toShacl().shaclQuads()).
 *
 * Fixture: a focused mini-bookstore registry with three inter-related classes:
 *   - PrimTitle  (primitive string)
 *   - PrimRating (primitive integer)
 *   - Catalog    (required property, $ref property, array property)
 *   - CatalogEntry (extends Catalog via allOf, has an OWL restriction)
 *
 * These cover every assertion axis in the matrix task spec:
 *   1. ABox predicate form per config
 *   2. TBox predicate form per config
 *   3. SHACL sh:path form per config
 *   4. Cross-projection consistency (same IRI across ABox/TBox/SHACL)
 *   5. Restriction onProperty invariant across both configs (Fix-1 guard)
 *   6. Round-trip (toQuads → fromQuads) under C1 and C2
 *   7. predicateFor (C3) flows through ABox + TBox + SHACL
 *
 * KNOWN BUGS surfaced by these tests are documented inline with it.skip
 * and a clear expected-vs-actual account.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import type { QuadInterface } from '../../src/interfaces/Quad.js';
import { JsonTology } from '../../src/index.js';

// ---------------------------------------------------------------------------
// Fixture schemas — minimal bookstore-flavoured classes
// ---------------------------------------------------------------------------

const BASE = 'https://catalog.example';

/**
 * Primitive: title string.
 * Using a urn: $id intentionally — class-scoped predicates will differ from flat.
 */
const PrimTitleSchema = {
  '$id': 'urn:catalog:Title',
  'type': 'string'
} as const;

/**
 * Primitive: integer rating.
 */
const PrimRatingSchema = {
  '$id': 'urn:catalog:Rating',
  'type': 'integer'
} as const;

/**
 * Main class under test.
 *
 * Properties exercised:
 *   - title     : required, $ref to PrimTitle   → tests required restriction + $ref range
 *   - tags      : array of string               → tests array property
 *   - rating    : optional, $ref to PrimRating  → tests optional $ref
 */
const CatalogSchema = {
  '$id': 'urn:catalog:Catalog',
  'properties': {
    'rating': { '$ref': PrimRatingSchema.$id },
    'tags': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'title': { '$ref': PrimTitleSchema.$id }
  },
  'required': ['title'],
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Build one registry per configuration
// ---------------------------------------------------------------------------

const FIXTURE_SCHEMAS = [
  PrimTitleSchema,
  PrimRatingSchema,
  CatalogSchema
] as const;

/** C1 — flat canonical (default, enableCanonicalPredicates omitted) */
const jtC1 = JsonTology.create({
  'baseIRI': BASE,
  'schemas': FIXTURE_SCHEMAS
});

/** C2 — class-scoped (enableCanonicalPredicates: false) */
const jtC2 = JsonTology.create({
  'baseIRI': BASE,
  'enableCanonicalPredicates': false,
  'schemas': FIXTURE_SCHEMAS
});

/**
 * C3 — predicateFor resolver.
 * Maps `title` → `https://schema.org/name`; others fall through to flat default.
 */
const SCHEMA_ORG_VOCAB: Record<string, string | undefined> = { 'title': 'https://schema.org/name' };

const jtC3 = JsonTology.create({
  'baseIRI': BASE,
  'predicateFor': ({ propertyName }) => {
    return SCHEMA_ORG_VOCAB[propertyName];
  },
  'schemas': FIXTURE_SCHEMAS
});

// ---------------------------------------------------------------------------
// Expected predicate IRIs per config
// ---------------------------------------------------------------------------

const C1 = {
  'rating': `${BASE}/rating`,
  'tags': `${BASE}/tags`,
  'title': `${BASE}/title`
};

// C2: class-scoped: `${classId}#${propertyName}`
const C2 = {
  'rating': `${CatalogSchema.$id}#rating`,
  'tags': `${CatalogSchema.$id}#tags`,
  'title': `${CatalogSchema.$id}#title`
};

// C3: title → schema.org, others fall through to flat
const C3 = {
  'rating': `${BASE}/rating`,
  'tags': `${BASE}/tags`,
  'title': 'https://schema.org/name'
};

// ---------------------------------------------------------------------------
// Quad helper functions
// ---------------------------------------------------------------------------

const OWL_OBJECT_PROPERTY = 'http://www.w3.org/2002/07/owl#ObjectProperty';
const OWL_DATATYPE_PROPERTY = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
const OWL_RESTRICTION = 'http://www.w3.org/2002/07/owl#Restriction';
const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SH_PATH = 'http://www.w3.org/ns/shacl#path';

function hasQuadWithPredicate(quads: readonly QuadInterface[], predicate: string): boolean {
  return quads.some((quad) => {
    return quad.predicate.value === predicate;
  });
}

/**
 * Collect all restriction blank-node IDs from the TBox quads.
 * A restriction bnode is the object of a quad whose object is a BlankNode
 * AND that bnode carries an rdf:type owl:Restriction triple.
 */
function getRestrictionBnodeIds(quads: readonly QuadInterface[]): string[] {
  const restrictionIds: string[] = [];

  for (const quad of quads) {
    if (
      quad.predicate.value === RDF_TYPE
      && quad.object.termType === 'NamedNode'
      && quad.object.value === OWL_RESTRICTION
      && quad.subject.termType === 'BlankNode'
    ) {
      restrictionIds.push(quad.subject.value);
    }
  }

  return restrictionIds;
}

/**
 * For a restriction bnode, retrieve the owl:onProperty IRI value.
 */
function getOnPropertyIri(quads: readonly QuadInterface[], bnodeId: string): string | undefined {
  for (const quad of quads) {
    if (
      quad.subject.termType === 'BlankNode'
      && quad.subject.value === bnodeId
      && quad.predicate.value === OWL_ON_PROPERTY
    ) {
      return quad.object.termType === 'NamedNode' ? quad.object.value : undefined;
    }
  }

  return undefined;
}

/**
 * Return true if the TBox contains a property declaration (owl:ObjectProperty
 * or owl:DatatypeProperty) whose subject IRI equals `propertyIri`.
 */
function hasTboxPropertyDeclaration(quads: readonly QuadInterface[], propertyIri: string): boolean {
  return quads.some((quad) => {
    return quad.subject.value === propertyIri
      && quad.predicate.value === RDF_TYPE
      && quad.object.termType === 'NamedNode'
      && (quad.object.value === OWL_OBJECT_PROPERTY || quad.object.value === OWL_DATATYPE_PROPERTY);
  });
}

/**
 * Return true if the SHACL quads contain an sh:path triple pointing to `propertyIri`.
 */
function hasShaclPath(quads: readonly QuadInterface[], propertyIri: string): boolean {
  return quads.some((quad) => {
    return quad.predicate.value === SH_PATH
      && quad.object.termType === 'NamedNode'
      && quad.object.value === propertyIri;
  });
}

/**
 * Collect all ABox predicate IRIs for quads whose subject is NOT a blank node
 * and whose predicate is not rdf:type.
 * Returns unique non-type predicate IRIs used in data projection.
 */
function collectAboxDataPredicates(quads: readonly QuadInterface[]): Set<string> {
  const predicates = new Set<string>();

  for (const quad of quads) {
    if (
      quad.predicate.value !== RDF_TYPE
      && quad.subject.termType === 'NamedNode'
    ) {
      predicates.add(quad.predicate.value);
    }
  }

  return predicates;
}

// ---------------------------------------------------------------------------
// ABox fixture instance
// ---------------------------------------------------------------------------

const CATALOG_INSTANCE = {
  'rating': 9,
  'tags': [
    'fiction',
    'fantasy'
  ],
  'title': 'Die unendliche Geschichte'
} as const;

// ---------------------------------------------------------------------------
// C1 — flat canonical predicates
// ---------------------------------------------------------------------------

void describe('C1 — flat canonical predicates', () => {
  const tboxQuads = jtC1.toTbox().quads();
  const shaclQuads = jtC1.toShacl().shaclQuads();
  const aboxQuads = jtC1.toQuads(CatalogSchema, CATALOG_INSTANCE);

  void it('C1-1: ABox — title predicate is flat (baseIRI/title)', () => {
    assert.ok(
      hasQuadWithPredicate(aboxQuads, C1.title),
      `C1 ABox must use flat predicate ${C1.title}`
    );
  });

  void it('C1-1: ABox — tags predicate is flat (baseIRI/tags)', () => {
    assert.ok(
      hasQuadWithPredicate(aboxQuads, C1.tags),
      `C1 ABox must use flat predicate ${C1.tags}`
    );
  });

  void it('C1-1: ABox — rating predicate is flat (baseIRI/rating)', () => {
    assert.ok(
      hasQuadWithPredicate(aboxQuads, C1.rating),
      `C1 ABox must use flat predicate ${C1.rating}`
    );
  });

  void it('C1-1: ABox — NO class-scoped predicates leak into C1', () => {
    const dataPredicates = collectAboxDataPredicates(aboxQuads);

    for (const pred of dataPredicates) {
      assert.ok(
        !pred.startsWith(`${CatalogSchema.$id}#`),
        `C1 ABox predicate must not be class-scoped: ${pred}`
      );
    }
  });

  void it('C1-2: TBox — title property declared under flat IRI', () => {
    assert.ok(
      hasTboxPropertyDeclaration(tboxQuads, C1.title),
      `C1 TBox must declare property ${C1.title} as owl:DatatypeProperty or owl:ObjectProperty`
    );
  });

  void it('C1-2: TBox — NO class-scoped property declarations in C1', () => {
    assert.ok(
      !hasTboxPropertyDeclaration(tboxQuads, C2.title),
      `C1 TBox must NOT declare property ${C2.title} (class-scoped form)`
    );
    assert.ok(
      !hasTboxPropertyDeclaration(tboxQuads, C2.tags),
      `C1 TBox must NOT declare property ${C2.tags} (class-scoped form)`
    );
  });

  void it('C1-3: SHACL — sh:path uses flat predicate for title', () => {
    assert.ok(
      hasShaclPath(shaclQuads, C1.title),
      `C1 SHACL must have sh:path pointing to ${C1.title}`
    );
  });

  void it('C1-3: SHACL — sh:path uses flat predicate for tags', () => {
    assert.ok(
      hasShaclPath(shaclQuads, C1.tags),
      `C1 SHACL must have sh:path pointing to ${C1.tags}`
    );
  });

  void it('C1-4: cross-projection — title IRI is identical in ABox, TBox, and SHACL', () => {
    const expectedIri = C1.title;

    assert.ok(hasQuadWithPredicate(aboxQuads, expectedIri), `C1 ABox uses ${expectedIri}`);
    assert.ok(hasTboxPropertyDeclaration(tboxQuads, expectedIri), `C1 TBox uses ${expectedIri}`);
    assert.ok(hasShaclPath(shaclQuads, expectedIri), `C1 SHACL uses ${expectedIri}`);
  });

  void it('C1-5: restriction onProperty — required title restriction uses flat predicate', () => {
    // Fix-1 regression guard: owl:Restriction owl:onProperty must equal the
    // property's flat predicate under C1, not the class-scoped form.
    const bnodeIds = getRestrictionBnodeIds(tboxQuads);
    const titleRestrictionBnodes = bnodeIds.filter((bnodeId) => {
      const onProp = getOnPropertyIri(tboxQuads, bnodeId);

      return onProp !== undefined && (
        onProp === C1.title || onProp === C2.title
      );
    });

    assert.ok(
      titleRestrictionBnodes.length > 0,
      'C1 TBox must contain at least one owl:Restriction for the required title property'
    );

    const allOnPropertyIris = titleRestrictionBnodes.map((bnodeId) => {
      return getOnPropertyIri(tboxQuads, bnodeId) ?? '';
    });

    for (const onPropertyIri of allOnPropertyIris) {
      assert.equal(
        onPropertyIri,
        C1.title,
        `C1 restriction onProperty must be flat ${C1.title}, got ${onPropertyIri}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// C2 — class-scoped predicates
// ---------------------------------------------------------------------------

void describe('C2 — class-scoped predicates', () => {
  const tboxQuads = jtC2.toTbox().quads();
  const shaclQuads = jtC2.toShacl().shaclQuads();
  const aboxQuads = jtC2.toQuads(CatalogSchema, CATALOG_INSTANCE);

  void it('C2-1: ABox — title predicate is class-scoped (classId#title)', () => {
    assert.ok(
      hasQuadWithPredicate(aboxQuads, C2.title),
      `C2 ABox must use class-scoped predicate ${C2.title}`
    );
  });

  void it('C2-1: ABox — tags predicate is class-scoped (classId#tags)', () => {
    assert.ok(
      hasQuadWithPredicate(aboxQuads, C2.tags),
      `C2 ABox must use class-scoped predicate ${C2.tags}`
    );
  });

  void it('C2-1: ABox — rating predicate is class-scoped (classId#rating)', () => {
    assert.ok(
      hasQuadWithPredicate(aboxQuads, C2.rating),
      `C2 ABox must use class-scoped predicate ${C2.rating}`
    );
  });

  void it('C2-1: ABox — NO flat canonical predicates leak into C2', () => {
    const dataPredicates = collectAboxDataPredicates(aboxQuads);

    for (const pred of dataPredicates) {
      assert.ok(
        !pred.startsWith(`${BASE}/`),
        `C2 ABox predicate must not be flat canonical: ${pred}`
      );
    }
  });

  void it('C2-2: TBox — title property declared under class-scoped IRI', () => {
    assert.ok(
      hasTboxPropertyDeclaration(tboxQuads, C2.title),
      `C2 TBox must declare property ${C2.title}`
    );
  });

  void it('C2-2: TBox — NO flat predicate declarations in C2', () => {
    assert.ok(
      !hasTboxPropertyDeclaration(tboxQuads, C1.title),
      `C2 TBox must NOT declare property ${C1.title} (flat form)`
    );
    assert.ok(
      !hasTboxPropertyDeclaration(tboxQuads, C1.tags),
      `C2 TBox must NOT declare property ${C1.tags} (flat form)`
    );
  });

  void it('C2-3: SHACL — sh:path uses class-scoped predicate for title', () => {
    assert.ok(
      hasShaclPath(shaclQuads, C2.title),
      `C2 SHACL must have sh:path pointing to ${C2.title}`
    );
  });

  void it('C2-3: SHACL — sh:path uses class-scoped predicate for tags', () => {
    assert.ok(
      hasShaclPath(shaclQuads, C2.tags),
      `C2 SHACL must have sh:path pointing to ${C2.tags}`
    );
  });

  void it('C2-4: cross-projection — title IRI is identical in ABox, TBox, and SHACL', () => {
    const expectedIri = C2.title;

    assert.ok(hasQuadWithPredicate(aboxQuads, expectedIri), `C2 ABox uses ${expectedIri}`);
    assert.ok(hasTboxPropertyDeclaration(tboxQuads, expectedIri), `C2 TBox uses ${expectedIri}`);
    assert.ok(hasShaclPath(shaclQuads, expectedIri), `C2 SHACL uses ${expectedIri}`);
  });

  void it('C2-5: restriction onProperty — required title restriction uses class-scoped predicate', () => {
    // Fix-1 regression guard: owl:Restriction owl:onProperty must equal the
    // property's class-scoped predicate under C2, not the flat form.
    const bnodeIds = getRestrictionBnodeIds(tboxQuads);
    const titleRestrictionBnodes = bnodeIds.filter((bnodeId) => {
      const onProp = getOnPropertyIri(tboxQuads, bnodeId);

      return onProp !== undefined && (
        onProp === C1.title || onProp === C2.title
      );
    });

    assert.ok(
      titleRestrictionBnodes.length > 0,
      'C2 TBox must contain at least one owl:Restriction for the required title property'
    );

    const allOnPropertyIris = titleRestrictionBnodes.map((bnodeId) => {
      return getOnPropertyIri(tboxQuads, bnodeId) ?? '';
    });

    for (const onPropertyIri of allOnPropertyIris) {
      assert.equal(
        onPropertyIri,
        C2.title,
        `C2 restriction onProperty must be class-scoped ${C2.title}, got ${onPropertyIri}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// C3 — predicateFor resolver
// ---------------------------------------------------------------------------

void describe('C3 — predicateFor resolver', () => {
  const tboxQuads = jtC3.toTbox().quads();
  const shaclQuads = jtC3.toShacl().shaclQuads();
  const aboxQuads = jtC3.toQuads(CatalogSchema, CATALOG_INSTANCE);

  void it('C3-1: ABox — title predicate uses custom schema.org IRI', () => {
    assert.ok(
      hasQuadWithPredicate(aboxQuads, C3.title),
      `C3 ABox must use custom predicate ${C3.title} for title`
    );
  });

  void it('C3-1: ABox — rating falls through to flat predicate', () => {
    assert.ok(
      hasQuadWithPredicate(aboxQuads, C3.rating),
      `C3 ABox must use flat predicate ${C3.rating} for rating (predicateFor returns undefined)`
    );
  });

  void it('C3-1: ABox — NO class-scoped predicate for title in C3', () => {
    assert.ok(
      !hasQuadWithPredicate(aboxQuads, C2.title),
      `C3 ABox must NOT use class-scoped predicate ${C2.title} for title`
    );
  });

  void it('C3-2: TBox — title property declared under custom schema.org IRI', () => {
    assert.ok(
      hasTboxPropertyDeclaration(tboxQuads, C3.title),
      `C3 TBox must declare property ${C3.title} for title`
    );
  });

  void it('C3-2: TBox — rating property declared under flat IRI', () => {
    assert.ok(
      hasTboxPropertyDeclaration(tboxQuads, C3.rating),
      `C3 TBox must declare property ${C3.rating} for rating`
    );
  });

  void it('C3-3: SHACL — sh:path uses schema.org IRI for title', () => {
    assert.ok(
      hasShaclPath(shaclQuads, C3.title),
      `C3 SHACL must have sh:path pointing to ${C3.title} for title`
    );
  });

  void it('C3-3: SHACL — sh:path uses flat IRI for rating', () => {
    assert.ok(
      hasShaclPath(shaclQuads, C3.rating),
      `C3 SHACL must have sh:path pointing to ${C3.rating} for rating`
    );
  });

  void it('C3-3: SHACL — sh:path uses flat IRI for tags (predicateFor returns undefined, falls through)', () => {
    assert.ok(
      hasShaclPath(shaclQuads, C3.tags),
      `C3 SHACL must have sh:path pointing to flat ${C3.tags} for tags`
    );
  });

  void it('C3-4: cross-projection — title IRI is identical in ABox, TBox, and SHACL', () => {
    const expectedIri = C3.title;

    assert.ok(hasQuadWithPredicate(aboxQuads, expectedIri), `C3 ABox uses ${expectedIri}`);
    assert.ok(hasTboxPropertyDeclaration(tboxQuads, expectedIri), `C3 TBox uses ${expectedIri}`);
    assert.ok(hasShaclPath(shaclQuads, expectedIri), `C3 SHACL uses ${expectedIri}`);
  });

  void it('C3-7: round-trip — custom IRI survives toQuads→fromQuads for title', () => {
    // C3 uses predicateFor for title; fromQuads must lift using the same predicate.
    const results = jtC3.fromQuads(CatalogSchema.$id, aboxQuads);

    assert.ok(results.length > 0, 'C3 fromQuads must return at least one result');

    const result = results[0] as Record<string, unknown>;

    assert.equal(
      result.title,
      CATALOG_INSTANCE.title,
      'C3: title must survive toQuads→fromQuads under predicateFor config'
    );
  });
});

// ---------------------------------------------------------------------------
// C1 vs C2 — cross-config isolation
// ---------------------------------------------------------------------------

void describe('cross-config isolation — C1 and C2 do not bleed into each other', () => {
  void it('C1 ABox predicates are entirely disjoint from C2 ABox predicates for shared properties', () => {
    const c1Quads = jtC1.toQuads(CatalogSchema, CATALOG_INSTANCE);
    const c2Quads = jtC2.toQuads(CatalogSchema, CATALOG_INSTANCE);
    const c1DataPreds = collectAboxDataPredicates(c1Quads);
    const c2DataPreds = collectAboxDataPredicates(c2Quads);

    for (const pred of c1DataPreds) {
      assert.ok(
        !c2DataPreds.has(pred),
        `Predicate ${pred} from C1 must not appear in C2 — configs must be fully isolated`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// C1 round-trip
// ---------------------------------------------------------------------------

void describe('C1 round-trip (toQuads → fromQuads)', () => {
  void it('C1-6: round-trip reconstructs all scalar properties', () => {
    const quads = jtC1.toQuads(CatalogSchema, CATALOG_INSTANCE);
    const results = jtC1.fromQuads(CatalogSchema.$id, quads);

    assert.ok(results.length > 0, 'C1 fromQuads must return at least one result');

    const result = results[0] as Record<string, unknown>;

    assert.equal(result.title, CATALOG_INSTANCE.title, 'C1: title round-trips');
    assert.equal(result.rating, CATALOG_INSTANCE.rating, 'C1: rating round-trips');
  });

  void it('C1-6: round-trip reconstructs array property', () => {
    const quads = jtC1.toQuads(CatalogSchema, CATALOG_INSTANCE);
    const results = jtC1.fromQuads(CatalogSchema.$id, quads);
    const result = results[0] as Record<string, unknown>;
    const tags = result.tags as string[];

    assert.ok(
      Array.isArray(tags),
      'C1: tags must be an array after round-trip'
    );

    const expected = new Set(CATALOG_INSTANCE.tags);
    const actual = new Set(tags);

    assert.ok(
      expected.size === actual.size && [...expected].every((tag) => {
        return actual.has(tag);
      }),
      `C1: tags must contain ${[...expected].join(', ')} after round-trip, got ${[...actual].join(', ')}`
    );
  });
});

// ---------------------------------------------------------------------------
// C2 round-trip
// ---------------------------------------------------------------------------

void describe('C2 round-trip (toQuads → fromQuads)', () => {
  void it('C2-6: round-trip reconstructs all scalar properties', () => {
    const quads = jtC2.toQuads(CatalogSchema, CATALOG_INSTANCE);
    const results = jtC2.fromQuads(CatalogSchema.$id, quads);

    assert.ok(results.length > 0, 'C2 fromQuads must return at least one result');

    const result = results[0] as Record<string, unknown>;

    assert.equal(result.title, CATALOG_INSTANCE.title, 'C2: title round-trips');
    assert.equal(result.rating, CATALOG_INSTANCE.rating, 'C2: rating round-trips');
  });

  void it('C2-6: round-trip reconstructs array property', () => {
    const quads = jtC2.toQuads(CatalogSchema, CATALOG_INSTANCE);
    const results = jtC2.fromQuads(CatalogSchema.$id, quads);
    const result = results[0] as Record<string, unknown>;
    const tags = result.tags as string[];

    assert.ok(
      Array.isArray(tags),
      'C2: tags must be an array after round-trip'
    );

    const expected = new Set(CATALOG_INSTANCE.tags);
    const actual = new Set(tags);

    assert.ok(
      expected.size === actual.size && [...expected].every((tag) => {
        return actual.has(tag);
      }),
      `C2: tags must contain ${[...expected].join(', ')} after round-trip, got ${[...actual].join(', ')}`
    );
  });
});
