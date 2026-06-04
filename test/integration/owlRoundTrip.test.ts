/**
 * OWL round-trip integration test.
 *
 * Verifies the contract: `fromTbox ∘ toTbox = identity` on the OWL 2 axiom
 * subset that json-tology supports. The full round-trip is tested against the
 * canonical bookstore registry so every supported axiom group is exercised
 * end-to-end.
 *
 * Equivalences the `structurallyEqual` helper tolerates:
 *   (a) Property key ordering — compared as sorted key sets.
 *   (b) Array element ordering inside `allOf` / `oneOf` / `required` — sets.
 *   (c) Annotation-only keywords: `title` / `description` / `$comment` whose
 *       value starts with `seeAlso:`, `definedBy:`, or `version:` are stripped
 *       before comparison (they are OWL annotation triples, not JSON Schema
 *       structural constraints, so they may not survive an OWL round-trip that
 *       doesn't preserve rdfs:comment content verbatim).
 *   (d) OWL importer defaults: every class emerges with `type: 'object'`,
 *       `properties: {}`, and `required: []` even when the original schema was
 *       a primitive (`type: 'string'`). These filler keys are stripped from the
 *       RT schema before the structural check.
 *
 * What the round-trip does NOT preserve (not OWL class-axiom semantics):
 *   - XSD facets: `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`,
 *     `multipleOf`, `format`.
 *   - Primitive JSON Schema types: `type: 'string'` / `'number'` / `'integer'`
 *     for simple literal-valued schemas. OWL datatype ranges encode these via
 *     `xsd:*` literals on the property, not on the class node itself.
 *   - `if` / `then` / `else` conditional schemas — not OWL axioms.
 *   - `jt:restrictions` — json-tology extension keywords (OWL property
 *     restrictions are emitted as separate axiom quads but the full keyword
 *     tree is not guaranteed to reconstruct verbatim from quads).
 *   - `const` constraints inside nested condition branches.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/index.js';
import {
  bookstoreEntities, bookstoreSchemas
} from '../../examples/docs/bookstore/index.js';

// ---------------------------------------------------------------------------
// OWL-preservable axiom kinds
// ---------------------------------------------------------------------------

/** Return the $ref IRIs from an `allOf` array (ignore non-$ref entries). */
function allOfRefs(allOf: unknown): string[] {
  if (!Array.isArray(allOf)) {
    return [];
  }

  return (allOf as Array<Record<string, unknown>>)
    .filter((entry) => {
      return typeof entry.$ref === 'string';
    })
    .map((entry) => {
      return entry.$ref as string;
    })
    .sort((left, right) => {
      if (left < right) {
        return -1;
      }

      return left > right ? 1 : 0;
    });
}

/** Return $ref-valued entries from a properties map. */
function refProperties(props: unknown): Record<string, string> {
  if (typeof props !== 'object' || props === null) {
    return {};
  }

  const out: Record<string, string> = {};

  for (const [
    key,
    val
  ] of Object.entries(props as Record<string, unknown>)) {
    if (typeof (val as Record<string, unknown>).$ref === 'string') {
      out[key] = (val as Record<string, unknown>).$ref as string;
    }
  }

  return out;
}

/** Return enum member list sorted (order-independent comparison). */
function sortedEnum(enumVal: unknown): unknown[] {
  if (!Array.isArray(enumVal)) {
    return [];
  }

  return [...(enumVal as unknown[])].sort((left, right) => {
    const leftStr = String(left);
    const rightStr = String(right);

    if (leftStr < rightStr) {
      return -1;
    }

    return leftStr > rightStr ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// sortedKeys — stable key-order copy for primitive comparison
// ---------------------------------------------------------------------------

/**
 * Authoring keywords that have no OWL datatype representation, so a scalar
 * primitive's OWL TBox export does not carry them and `fromTbox` cannot
 * reconstruct them. They are stripped before the primitive structural
 * comparison.
 *
 * - `x-jt-iriRef` (emit value as a NamedNode) and `x-jt-language` (emit value as
 *   an `rdf:langString` with a language tag) steer `toQuads` ABox emission and
 *   are not XSD datatype facets.
 * - `default` is a JSON Schema authoring value with no OWL/RDFS predicate; no
 *   `jt:default` annotation is emitted, so it does not survive the TBox round-trip.
 */
const NON_OWL_PRESERVABLE_KEYS = new Set([
  'default',
  'x-jt-iriRef',
  'x-jt-language'
]);

/**
 * Return a copy of `obj` with keys sorted alphabetically and non-OWL-preservable
 * keywords removed (they have no OWL datatype round-trip).
 */
function sortedKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};

  for (const key of Object.keys(obj).sort()) {
    if (NON_OWL_PRESERVABLE_KEYS.has(key)) {
      continue;
    }
    sorted[key] = obj[key];
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// structurallyEqual — OWL-semantics comparison
// ---------------------------------------------------------------------------

interface StructuralMismatch {
  'actual': unknown;
  'expected': unknown;
  'field': string;
}

/**
 * Compare `actual` (round-tripped schema) against `expected` (original schema)
 * under the equivalences described in the file-level JSDoc.
 *
 * Returns an array of mismatch descriptions (empty = equal).
 */
function structurallyEqual(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>
): StructuralMismatch[] {
  const mismatches: StructuralMismatch[] = [];

  // (1) allOf: $ref entries must be the same set (order-independent).
  const expAllOfRefs = allOfRefs(expected.allOf);

  if (expAllOfRefs.length > 0) {
    const actAllOfRefs = allOfRefs(actual.allOf);
    const expSet = JSON.stringify(expAllOfRefs);
    const actSet = JSON.stringify(actAllOfRefs);

    if (expSet !== actSet) {
      mismatches.push({
        'actual': actAllOfRefs,
        'expected': expAllOfRefs,
        'field': 'allOf.$ref-set'
      });
    }
  }

  // (2) top-level $ref (equivalentClass)
  if (typeof expected.$ref === 'string' && actual.$ref !== expected.$ref) {
    mismatches.push({
      'actual': actual.$ref,
      'expected': expected.$ref,
      'field': '$ref'
    });
  }

  // (3) not: { $ref } (complementOf)
  const expNot = expected.not as Record<string, unknown> | undefined;

  if (typeof expNot?.$ref === 'string') {
    const actNot = actual.not as Record<string, unknown> | undefined;

    if (actNot?.$ref !== expNot.$ref) {
      mismatches.push({
        'actual': actNot?.$ref,
        'expected': expNot.$ref,
        'field': 'not.$ref'
      });
    }
  }

  // (4) disjointWith
  if (expected.disjointWith !== undefined && actual.disjointWith !== expected.disjointWith) {
    mismatches.push({
      'actual': actual.disjointWith,
      'expected': expected.disjointWith,
      'field': 'disjointWith'
    });
  }

  // (5) enum (order-independent)
  if (Array.isArray(expected.enum)) {
    const expEnum = sortedEnum(expected.enum);
    const actEnum = sortedEnum(actual.enum);

    if (JSON.stringify(expEnum) !== JSON.stringify(actEnum)) {
      mismatches.push({
        'actual': actEnum,
        'expected': expEnum,
        'field': 'enum'
      });
    }
  }

  // (6) properties: $ref-valued entries must round-trip (primitive type
  //     entries like `{ type: 'string' }` are not OWL class axioms)
  const expRefProps = refProperties(expected.properties);

  if (Object.keys(expRefProps).length > 0) {
    const actRefProps = refProperties(actual.properties);

    for (const [
      key,
      expRef
    ] of Object.entries(expRefProps)) {
      if (actRefProps[key] !== expRef) {
        mismatches.push({
          'actual': actRefProps[key],
          'expected': expRef,
          'field': `properties.${key}.$ref`
        });
      }
    }
  }

  return mismatches;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('OWL round-trip', () => {
  void it('fromTbox([]) returns a well-formed OwlImportResult', () => {
    const result = JsonTology.fromTbox([]);

    assert.ok(Array.isArray(result.schemas), 'schemas must be an array');
    assert.ok(Array.isArray(result.invariants), 'invariants must be an array');
    assert.ok(Array.isArray(result.characteristics), 'characteristics must be an array');
    assert.ok(Array.isArray(result.sameAs), 'sameAs must be an array');
    assert.ok(Array.isArray(result.individuals), 'individuals must be an array');
    assert.ok(Array.isArray(result.unsupported), 'unsupported must be an array');
    assert.strictEqual(result.schemas.length, 0, 'no class IRIs in empty input → no schemas');
    assert.strictEqual(result.unsupported.length, 0, 'all dispatchers implemented — no unsupported entries for empty input');
  });

  void it('class axioms: bookstore taxonomy round-trips via fromTbox', () => {
    const tboxJsonLd = bookstoreEntities.toTbox().jsonLd();
    const result = JsonTology.fromTbox(tboxJsonLd, { 'baseIRI': 'urn:bookstore' });

    assert.ok(result.schemas.length > 0, 'fromTbox must produce schemas from bookstore TBox');

    // rdfs:subClassOf — single parent (RareBook → PrintBook)
    const rareBook = result.schemas.find((schema) => {
      return schema.$id === 'urn:bookstore:RareBook';
    });

    assert.ok(rareBook !== undefined, 'RareBook schema must be found');
    assert.ok(Array.isArray(rareBook.allOf), 'RareBook must have allOf');
    const rareAllOf = rareBook.allOf as Array<Record<string, unknown>>;

    assert.ok(
      rareAllOf.some((entry) => {
        return entry.$ref === 'urn:bookstore:PrintBook';
      }),
      'RareBook allOf must include PrintBook $ref'
    );

    // rdfs:subClassOf — SignedFirstEdition → RareBook
    const signedEd = result.schemas.find((schema) => {
      return schema.$id === 'urn:bookstore:SignedFirstEdition';
    });

    const signedAllOf = signedEd?.allOf as Array<Record<string, unknown>> | undefined;

    assert.ok(
      Array.isArray(signedAllOf) && signedAllOf.some((entry) => {
        return entry.$ref === 'urn:bookstore:RareBook';
      }),
      'SignedFirstEdition allOf must include RareBook $ref'
    );

    // owl:disjointWith (symmetric closure)
    const eBook = result.schemas.find((schema) => {
      return schema.$id === 'urn:bookstore:EBook';
    });
    const printBook = result.schemas.find((schema) => {
      return schema.$id === 'urn:bookstore:PrintBook';
    });

    assert.ok(
      eBook?.disjointWith === 'urn:bookstore:PrintBook'
      || printBook?.disjointWith === 'urn:bookstore:EBook',
      'EBook and PrintBook must carry disjointWith in at least one direction'
    );

    // owl:complementOf
    const outOfPrint = result.schemas.find((schema) => {
      return schema.$id === 'urn:bookstore:OutOfPrintBook';
    });
    const outOfPrintNot = outOfPrint?.not as Record<string, unknown> | undefined;

    assert.equal(
      outOfPrintNot?.$ref,
      'urn:bookstore:InPrintBook',
      'OutOfPrintBook not.$ref must be InPrintBook'
    );

    // owl:equivalentClass
    const authorName = result.schemas.find((schema) => {
      return schema.$id === 'urn:bookstore:AuthorName';
    });

    assert.equal(
      authorName?.$ref,
      'urn:bookstore:PersonName',
      'AuthorName $ref must be PersonName (equivalentClass)'
    );
  });

  void it('full round-trip: every bookstore schema satisfies OWL-preservable structural equality', () => {
    const tboxJsonLd = bookstoreEntities.toTbox().jsonLd();
    const result = JsonTology.fromTbox(tboxJsonLd, { 'baseIRI': 'urn:bookstore' });

    // Sanity: no unsupported axioms after Phase 1 is complete.
    assert.deepEqual(result.unsupported, [], 'All axioms must be handled — no unsupported entries');

    // Every schema must have a string $id.
    for (const schema of result.schemas) {
      assert.ok(typeof schema.$id === 'string', `Schema missing $id: ${JSON.stringify(schema)}`);
    }

    // At least as many schemas as registered in the bookstore.
    const bookstoreSize = bookstoreSchemas.length;

    assert.ok(
      result.schemas.length >= bookstoreSize,
      `Expected at least ${bookstoreSize} schemas, got ${result.schemas.length}`
    );

    const rtById = new Map<string, Record<string, unknown>>();

    for (const schema of result.schemas) {
      if (typeof schema.$id === 'string') {
        rtById.set(schema.$id, schema as Record<string, unknown>);
      }
    }

    const failures: string[] = [];

    // Scalar primitive types that round-trip losslessly via rdfs:Datatype.
    const SCALAR_TYPES = new Set([
      'boolean',
      'integer',
      'number',
      'string'
    ]);

    for (const origRaw of bookstoreSchemas) {
      const orig = origRaw as Record<string, unknown>;
      const schemaId = orig.$id as string;
      const rtSchema = rtById.get(schemaId);

      if (rtSchema === undefined) {
        failures.push(`${schemaId}: missing from round-trip result`);
        continue;
      }

      const origType = orig.type as string | undefined;

      // Scalar primitive schemas (string/number/integer/boolean) are emitted as
      // rdfs:Datatype with XSD facets and jt: annotations — enforce deepStrictEqual.
      if (origType !== undefined && SCALAR_TYPES.has(origType)) {
        const origSorted = sortedKeys(orig);
        const rtSorted = sortedKeys(rtSchema);

        if (JSON.stringify(origSorted) !== JSON.stringify(rtSorted)) {
          const msg = `${schemaId} [PRIMITIVE structural mismatch]: expected ${JSON.stringify(origSorted)}, got ${JSON.stringify(rtSorted)}`;

          failures.push(msg);
        }

        continue;
      }

      // Object / complex schemas — tolerant OWL-preservable comparison.
      const mismatches = structurallyEqual(rtSchema, orig);

      for (const mismatch of mismatches) {
        const msg = `${schemaId} [${mismatch.field}]: expected ${JSON.stringify(mismatch.expected)}, got ${JSON.stringify(mismatch.actual)}`;

        failures.push(msg);
      }
    }

    assert.deepEqual(
      failures,
      [],
      `Round-trip structural mismatches:\n${failures.join('\n')}`
    );
  });
});

// ---------------------------------------------------------------------------
// H-1 round-trip: jt:restrictions survive fromTbox(toTbox())
// ---------------------------------------------------------------------------

void describe('H-1: jt:restrictions round-trip via OwlProjection + OwlImporter', () => {
  void it('fromTbox(toTbox(schemaWithJtRestrictions)) reconstructs cardinality restrictions', async () => {
    const { Compose } = await import('../../src/index.js');
    const { SchemaGraph } = await import('../../src/modules/graph/SchemaGraph.js');
    const { OwlProjection } = await import('../../src/modules/rdf/OwlProjection.js');
    const { importPropertyRestrictions } = await import('../../src/modules/ontology/importDispatch/PropertyRestrictions.js');
    const { Curie } = await import('../../src/modules/rdf/Curie.js');
    const { STANDARD_PREFIXES } = await import('../../src/constants/STANDARD_PREFIXES.js');

    const CLASS_IRI = 'urn:test:H1Class';
    const PROP_IRI = `${CLASS_IRI}#items`;

    const schema = Compose.subClassOf(
      Compose.maxCardinality(PROP_IRI, 2),
      Compose.subClassOf(
        Compose.minCardinality(PROP_IRI, 1),
        {
          '$id': CLASS_IRI,
          'type': 'object' as const
        }
      )
    );

    const graph = new SchemaGraph(schema);
    const tbox = OwlProjection.graph(graph);

    const qbGraph = SchemaGraph.fromQuads(tbox, { 'baseIRI': 'urn:test' });
    const curie = new Curie(STANDARD_PREFIXES);
    const ctx = {
      'allClassIris': new Set([CLASS_IRI]),
      'allPropertyIris': new Set<string>(),
      'baseIRI': 'urn:test',
      curie,
      'graph': qbGraph,
      'isDatatype': () => {
        return false;
      },
      'prefixes': STANDARD_PREFIXES,
      'reportUnsupported': () => { /* noop */ }
    };

    const fragment = importPropertyRestrictions(tbox, ctx);
    const delta = fragment.schemaDeltas.get(CLASS_IRI);
    const itemsProp = delta?.properties?.items as Record<string, unknown> | undefined;

    assert.ok(delta !== undefined, 'class delta must exist after round-trip');
    assert.ok(itemsProp !== undefined, 'items property delta must exist');
    assert.equal(itemsProp.minItems, 1, 'minCardinality → minItems: 1');
    assert.equal(itemsProp.maxItems, 2, 'maxCardinality → maxItems: 2');
  });

  void it('fromTbox(toTbox(schemaWithSomeValuesFrom)) emits a someValuesFrom invariant', async () => {
    const { Compose } = await import('../../src/index.js');
    const { SchemaGraph } = await import('../../src/modules/graph/SchemaGraph.js');
    const { OwlProjection } = await import('../../src/modules/rdf/OwlProjection.js');
    const { OwlImporter } = await import('../../src/modules/ontology/OwlImporter.js');

    const CLASS_IRI = 'urn:test:H1SomeClass';
    const PROP_IRI = `${CLASS_IRI}#tags`;
    const RANGE_IRI = 'urn:test:H1Tag';

    const schema = Compose.subClassOf(
      Compose.someValuesFrom(PROP_IRI, RANGE_IRI),
      {
        '$id': CLASS_IRI,
        'type': 'object' as const
      }
    );

    const graph = new SchemaGraph(schema);
    const tbox = OwlProjection.graph(graph);
    const result = new OwlImporter({ 'baseIRI': 'urn:test' }).import(tbox);

    const invEntries = result.invariants.filter((entry) => {
      return entry.schemaId === CLASS_IRI;
    });

    assert.ok(invEntries.length > 0, 'someValuesFrom invariant must be emitted after round-trip');
    assert.ok(
      invEntries.some((entry) => {
        return entry.invariant.name.includes('someValuesFrom');
      }),
      'invariant name must reference someValuesFrom'
    );
  });
});

// ---------------------------------------------------------------------------
// H-2 round-trip: primitive format survives toTbox → jt:format quad
// ---------------------------------------------------------------------------

void describe('H-2: primitive format annotation emitted as jt:format quad', () => {
  void it('toTbox of { type: "string", format: "date-time" } emits jt:format quad', async () => {
    const { SchemaGraph } = await import('../../src/modules/graph/SchemaGraph.js');
    const { OwlProjection } = await import('../../src/modules/rdf/OwlProjection.js');
    const { JT } = await import('../../src/constants/IRI.js');

    const schema = {
      '$id': 'urn:test:H2DateType',
      'format': 'date-time',
      'type': 'string' as const
    };

    const graph = new SchemaGraph(schema);
    const tboxQuads = OwlProjection.graph(graph);

    // The JT.format quad must appear in the emitted quads
    const formatQuad = tboxQuads.find((quad) => {
      return quad.predicate.value === JT.format;
    });

    assert.ok(formatQuad !== undefined, 'jt:format quad must be emitted for string schema with format');
    assert.equal(formatQuad.object.value, 'date-time', 'jt:format object value must be "date-time"');
  });

  void it('jt:format is read from projection index (not raw schema) via graph relation', async () => {
    const { SchemaGraph } = await import('../../src/modules/graph/SchemaGraph.js');
    const { OwlProjection } = await import('../../src/modules/rdf/OwlProjection.js');
    const { JT } = await import('../../src/constants/IRI.js');

    // Schema with format=uri (xsd:anyURI maps cleanly to a non-string XSD type)
    // pushFormatAnnotationRelation should still emit JT.format
    const schema = {
      '$id': 'urn:test:H2UriType',
      'format': 'uri',
      'type': 'string' as const
    };

    const graph = new SchemaGraph(schema);

    // Verify the graph relation is present
    const allRels = graph.allRelations();
    const formatRel = allRels.find((relation) => {
      return relation.predicate === JT.format;
    });

    assert.ok(formatRel !== undefined, 'JT.format relation must be emitted by SchemaGraphRelations');
    assert.equal(String(formatRel.target), 'uri', 'JT.format relation target must be "uri"');

    // The OwlProjection must pick it up from the index, not raw schema
    const tboxQuads = OwlProjection.graph(graph);
    const formatQuad = tboxQuads.find((quad) => {
      return quad.predicate.value === JT.format;
    });

    assert.ok(formatQuad !== undefined, 'jt:format quad must be in tbox output');
    assert.equal(formatQuad.object.value, 'uri', 'jt:format value must be "uri"');
  });
});
