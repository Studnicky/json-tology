/**
 * OWL bi-directionality e2e test: schema ⇄ OWL TBox.
 *
 * Exercises `toTbox() → fromTbox()` over the FULL bookstore registry and
 * asserts that the regenerated schemas are structurally equivalent to the
 * originals for every OWL-preservable axiom group.
 *
 * Axiom groups covered:
 *   A-1  Subclass hierarchy  Book ← PrintBook ← RareBook ← SignedFirstEdition
 *                            Book ← EBook
 *   A-2  Disjointness        EBook ⊥ PrintBook
 *   A-3  Flat / shared predicate  customerId (Customer ∪ Order ∪ Review domain)
 *   A-4  OWL property characteristics  inverseFunctional (customerId on Customer),
 *                                      functional (customerId on Review),
 *                                      symmetric+reflexive (SimilarBook.b),
 *                                      asymmetric (Sequel.predecessor),
 *                                      transitive+irreflexive (Order.placedAt)
 *   A-5  ABox-projection hint keywords x-jt-iriRef and x-jt-language are absent
 *        from the TBox (they carry no OWL datatype representation)
 *   A-6  No class-scoped predicates in the round-tripped result
 *        (shared customerId stays one property with a union domain, not three)
 *   A-7  complementOf  OutOfPrintBook = ¬InPrintBook
 *   A-8  equivalentClass  AuthorName ≡ PersonName
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  bookstoreEntities, bookstoreSchemas
} from '../../examples/docs/bookstore/index.js';
import { JsonTology } from '../../src/index.js';

// ---------------------------------------------------------------------------
// Shared: round-trip result (computed once)
// ---------------------------------------------------------------------------

const tboxJsonLd = bookstoreEntities.toTbox().jsonLdObject();
const tboxQuads = bookstoreEntities.toTbox().quads();
const fromTboxResult = JsonTology.fromTbox(tboxJsonLd, { 'baseIRI': 'urn:bookstore' });

/** Find a schema in the round-trip result by $id. */
function findRt(id: string): Record<string, unknown> | undefined {
  return fromTboxResult.schemas.find((schema) => {
    return schema.$id === id;
  }) as Record<string, unknown> | undefined;
}

/** Collect all $ref strings from an allOf array (order-independent). */
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
    .sort();
}

// ---------------------------------------------------------------------------
// A-0  Baseline
// ---------------------------------------------------------------------------

void describe('A-0: fromTbox baseline', () => {
  void it('produces schemas and zero unsupported entries', () => {
    assert.ok(
      fromTboxResult.schemas.length > 0,
      'fromTbox must produce schemas from a non-empty bookstore TBox'
    );
    assert.deepEqual(
      fromTboxResult.unsupported,
      [],
      `All axioms must be handled — unsupported: ${JSON.stringify(fromTboxResult.unsupported)}`
    );
  });

  void it('every round-tripped schema has a string $id', () => {
    for (const schema of fromTboxResult.schemas) {
      assert.ok(
        typeof schema.$id === 'string' && schema.$id.length > 0,
        `Schema missing $id: ${JSON.stringify(schema).slice(0, 80)}`
      );
    }
  });

  void it('round-tripped schema count >= bookstoreSchemas count', () => {
    assert.ok(
      fromTboxResult.schemas.length >= bookstoreSchemas.length,
      `Expected at least ${bookstoreSchemas.length} schemas, got ${fromTboxResult.schemas.length}`
    );
  });
});

// ---------------------------------------------------------------------------
// A-1  Subclass hierarchy
// ---------------------------------------------------------------------------

void describe('A-1: subclass hierarchy round-trips', () => {
  void it('Book ← EBook (rdfs:subClassOf)', () => {
    const eBook = findRt('urn:bookstore:EBook');

    assert.ok(eBook !== undefined, 'EBook schema must be in round-trip result');
    assert.ok(
      allOfRefs(eBook.allOf).includes('urn:bookstore:Book'),
      `EBook allOf must include Book $ref — allOf: ${JSON.stringify(eBook.allOf)}`
    );
  });

  void it('Book ← PrintBook (rdfs:subClassOf)', () => {
    const printBook = findRt('urn:bookstore:PrintBook');

    assert.ok(printBook !== undefined, 'PrintBook schema must be in round-trip result');
    assert.ok(
      allOfRefs(printBook.allOf).includes('urn:bookstore:Book'),
      `PrintBook allOf must include Book $ref — allOf: ${JSON.stringify(printBook.allOf)}`
    );
  });

  void it('PrintBook ← RareBook (rdfs:subClassOf)', () => {
    const rareBook = findRt('urn:bookstore:RareBook');

    assert.ok(rareBook !== undefined, 'RareBook schema must be in round-trip result');
    assert.ok(
      allOfRefs(rareBook.allOf).includes('urn:bookstore:PrintBook'),
      `RareBook allOf must include PrintBook $ref — allOf: ${JSON.stringify(rareBook.allOf)}`
    );
  });

  void it('RareBook ← SignedFirstEdition (rdfs:subClassOf)', () => {
    const sfe = findRt('urn:bookstore:SignedFirstEdition');

    assert.ok(sfe !== undefined, 'SignedFirstEdition schema must be in round-trip result');
    assert.ok(
      allOfRefs(sfe.allOf).includes('urn:bookstore:RareBook'),
      `SignedFirstEdition allOf must include RareBook $ref — allOf: ${JSON.stringify(sfe.allOf)}`
    );
  });
});

// ---------------------------------------------------------------------------
// A-2  Disjointness
// ---------------------------------------------------------------------------

void describe('A-2: EBook ⊥ PrintBook disjointWith round-trips', () => {
  void it('at least one of EBook/PrintBook carries disjointWith for the other', () => {
    const eBook = findRt('urn:bookstore:EBook');
    const printBook = findRt('urn:bookstore:PrintBook');

    const eBookDisjoint = eBook?.disjointWith;
    const printBookDisjoint = printBook?.disjointWith;

    const eBookSide = eBookDisjoint === 'urn:bookstore:PrintBook';
    const printBookSide = printBookDisjoint === 'urn:bookstore:EBook';

    assert.ok(
      eBookSide || printBookSide,
      'EBook ⊥ PrintBook: at least one direction must carry disjointWith. '
      + `eBook.disjointWith=${JSON.stringify(eBookDisjoint)} `
      + `printBook.disjointWith=${JSON.stringify(printBookDisjoint)}`
    );
  });
});

// ---------------------------------------------------------------------------
// A-3  Shared predicate — flat / union domain
// ---------------------------------------------------------------------------

void describe('A-3: shared customerId predicate — flat union domain in TBox', () => {
  const CUSTOMER_ID_IRI = 'https://bookstore.example/customerId';
  const OWL_OBJECT_PROPERTY = 'http://www.w3.org/2002/07/owl#ObjectProperty';
  const RDFS_DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';

  void it('TBox emits exactly one customerId property node (not three class-scoped copies)', () => {
    const custIdQuads = tboxQuads.filter((quad) => {
      return quad.subject.value === CUSTOMER_ID_IRI
        && quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
    });

    // There should be a property node for customerId; duplicates in the
    // same subject/predicate space are fine for type assertions, but the
    // subject IRI itself must be exactly the one flat IRI.
    assert.ok(
      custIdQuads.length > 0,
      'customerId must appear as a typed property subject in the TBox quads'
    );

    // At least one type triple must declare it as an OWL property.
    const isPropertyType = custIdQuads.some((quad) => {
      return quad.object.value === OWL_OBJECT_PROPERTY
        || quad.object.value === 'http://www.w3.org/2002/07/owl#DatatypeProperty';
    });

    assert.ok(isPropertyType, 'customerId must be typed as an OWL property');
  });

  void it('customerId TBox domain covers Customer, Order, and Review', () => {
    const domainQuads = tboxQuads.filter((quad) => {
      return quad.subject.value === CUSTOMER_ID_IRI
        && quad.predicate.value === RDFS_DOMAIN;
    });

    const domainIris = new Set(domainQuads.map((quad) => {
      return quad.object.value;
    }));

    assert.ok(
      domainIris.has('urn:bookstore:Customer'),
      `customerId rdfs:domain must include Customer — found: ${[...domainIris].join(', ')}`
    );
    assert.ok(
      domainIris.has('urn:bookstore:Order'),
      `customerId rdfs:domain must include Order — found: ${[...domainIris].join(', ')}`
    );
    assert.ok(
      domainIris.has('urn:bookstore:Review'),
      `customerId rdfs:domain must include Review — found: ${[...domainIris].join(', ')}`
    );
  });

  void it('TBox does not emit class-scoped predicate IRIs (no Customer#customerId vs Order#customerId)', () => {
    // Class-scoped IRIs would look like urn:bookstore:Customer#customerId;
    // the canonical flat predicate IRI is https://bookstore.example/customerId.
    const classScopedCustId = tboxQuads.filter((quad) => {
      return quad.subject.value !== CUSTOMER_ID_IRI
        && quad.subject.value.endsWith('#customerId');
    });

    assert.equal(
      classScopedCustId.length,
      0,
      `Found class-scoped customerId quads — flat predicates must be the default: ${classScopedCustId.map((quad) => {
        return quad.subject.value;
      }).join(', ')}`
    );
  });
});

// ---------------------------------------------------------------------------
// A-4  OWL property characteristics
// ---------------------------------------------------------------------------

void describe('A-4: property characteristics in TBox', () => {
  const OWL_INVERSE_FUNCTIONAL = 'http://www.w3.org/2002/07/owl#InverseFunctionalProperty';
  const OWL_FUNCTIONAL = 'http://www.w3.org/2002/07/owl#FunctionalProperty';
  const OWL_SYMMETRIC = 'http://www.w3.org/2002/07/owl#SymmetricProperty';
  const OWL_REFLEXIVE = 'http://www.w3.org/2002/07/owl#ReflexiveProperty';
  const OWL_ASYMMETRIC = 'http://www.w3.org/2002/07/owl#AsymmetricProperty';
  const OWL_TRANSITIVE = 'http://www.w3.org/2002/07/owl#TransitiveProperty';
  const OWL_IRREFLEXIVE = 'http://www.w3.org/2002/07/owl#IrreflexiveProperty';
  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

  /** Return all rdf:type IRIs declared on a subject in the TBox quads. */
  function typesOf(subjectIri: string): Set<string> {
    const types = new Set<string>();

    for (const quad of tboxQuads) {
      if (quad.subject.value === subjectIri && quad.predicate.value === RDF_TYPE) {
        types.add(quad.object.value);
      }
    }

    return types;
  }

  void it('Customer.customerId is declared owl:InverseFunctionalProperty', () => {
    const types = typesOf('https://bookstore.example/customerId');

    assert.ok(
      types.has(OWL_INVERSE_FUNCTIONAL),
      `customerId must be typed as InverseFunctionalProperty — types: ${[...types].join(', ')}`
    );
  });

  void it('Review.customerId is declared owl:FunctionalProperty', () => {
    // The shared customerId property carries both inverseFunctional (Customer)
    // and functional (Review) on the same flat property IRI.
    const types = typesOf('https://bookstore.example/customerId');

    assert.ok(
      types.has(OWL_FUNCTIONAL),
      `customerId must be typed as FunctionalProperty — types: ${[...types].join(', ')}`
    );
  });

  void it('SimilarBook.b is declared owl:SymmetricProperty and owl:ReflexiveProperty', () => {
    const types = typesOf('https://bookstore.example/b');

    assert.ok(
      types.has(OWL_SYMMETRIC),
      `b must be typed as SymmetricProperty — types: ${[...types].join(', ')}`
    );
    assert.ok(
      types.has(OWL_REFLEXIVE),
      `b must be typed as ReflexiveProperty — types: ${[...types].join(', ')}`
    );
  });

  void it('Sequel.predecessor is declared owl:AsymmetricProperty', () => {
    const types = typesOf('https://bookstore.example/predecessor');

    assert.ok(
      types.has(OWL_ASYMMETRIC),
      `predecessor must be typed as AsymmetricProperty — types: ${[...types].join(', ')}`
    );
  });

  void it('Order.placedAt is declared owl:TransitiveProperty and owl:IrreflexiveProperty', () => {
    const types = typesOf('https://bookstore.example/placedAt');

    assert.ok(
      types.has(OWL_TRANSITIVE),
      `placedAt must be typed as TransitiveProperty — types: ${[...types].join(', ')}`
    );
    assert.ok(
      types.has(OWL_IRREFLEXIVE),
      `placedAt must be typed as IrreflexiveProperty — types: ${[...types].join(', ')}`
    );
  });
});

// ---------------------------------------------------------------------------
// A-5  ABox-projection hint keywords absent from TBox
// ---------------------------------------------------------------------------

void describe('A-5: x-jt-iriRef and x-jt-language absent from round-tripped schemas', () => {
  /**
   * x-jt-iriRef and x-jt-language are ABox-projection hints that steer
   * toQuads emission (NamedNode vs literal; language-tagged literal).
   * They have no OWL datatype representation, so fromTbox cannot reconstruct
   * them. The round-tripped schemas must not carry these keys.
   */
  void it('no round-tripped schema carries x-jt-iriRef', () => {
    for (const schema of fromTboxResult.schemas) {
      assert.ok(
        !('x-jt-iriRef' in schema),
        `Schema ${schema.$id} must not carry x-jt-iriRef after round-trip`
      );
    }
  });

  void it('no round-tripped schema carries x-jt-language', () => {
    for (const schema of fromTboxResult.schemas) {
      assert.ok(
        !('x-jt-language' in schema),
        `Schema ${schema.$id} must not carry x-jt-language after round-trip`
      );
    }
  });

  void it('DownloadUrl schema (x-jt-iriRef: true) round-trips without that key', () => {
    const downloadUrl = findRt('urn:bookstore:DownloadUrl');

    assert.ok(downloadUrl !== undefined, 'DownloadUrl must appear in round-trip result');
    assert.ok(
      !('x-jt-iriRef' in downloadUrl),
      'DownloadUrl must not carry x-jt-iriRef after round-trip'
    );
  });

  void it('Provenance schema (x-jt-language: de) round-trips without that key', () => {
    const provenance = findRt('urn:bookstore:Provenance');

    assert.ok(provenance !== undefined, 'Provenance must appear in round-trip result');
    assert.ok(
      !('x-jt-language' in provenance),
      'Provenance must not carry x-jt-language after round-trip'
    );
  });
});

// ---------------------------------------------------------------------------
// A-6  No class-scoped predicates reintroduced
// ---------------------------------------------------------------------------

void describe('A-6: round-trip does not reintroduce class-scoped predicates', () => {
  void it('no round-tripped schema carries class-scoped property keys (e.g. Customer#customerId)', () => {
    for (const schema of fromTboxResult.schemas) {
      const properties = (schema as Record<string, unknown>).properties;

      if (properties === null || typeof properties !== 'object') {
        continue;
      }

      for (const key of Object.keys(properties)) {
        assert.ok(
          !key.includes('#'),
          `Schema ${schema.$id} has class-scoped property key after round-trip: "${key}"`
        );
      }
    }
  });

  void it('shared customerId stays as a single property across Customer/Order/Review', () => {
    // In a class-scoped predicate world, the round-trip would emit three
    // distinct $ids: Customer#customerId, Order#customerId, Review#customerId.
    // In the flat canonical world there is exactly one: https://bookstore.example/customerId.
    const custIdVariants = fromTboxResult.schemas.filter((schema) => {
      return typeof schema.$id === 'string' && schema.$id.endsWith('customerId');
    });

    // Expect either 0 (property nodes don't become schemas) or at most 1
    // (the flat shared property IRI as a primitive schema).
    assert.ok(
      custIdVariants.length <= 1,
      `Expected at most 1 customerId schema in round-trip result, got ${custIdVariants.length}: ${
        custIdVariants.map((schema) => {
          return schema.$id;
        }).join(', ')}`
    );
  });
});

// ---------------------------------------------------------------------------
// A-7  complementOf  OutOfPrintBook = ¬InPrintBook
// ---------------------------------------------------------------------------

void describe('A-7: OutOfPrintBook complementOf InPrintBook round-trips', () => {
  void it('OutOfPrintBook carries not.$ref = InPrintBook', () => {
    const outOfPrint = findRt('urn:bookstore:OutOfPrintBook');

    assert.ok(outOfPrint !== undefined, 'OutOfPrintBook must be in round-trip result');

    const notClause = outOfPrint.not as Record<string, unknown> | undefined;

    assert.ok(notClause !== undefined, 'OutOfPrintBook must carry a not clause');
    assert.equal(
      notClause.$ref,
      'urn:bookstore:InPrintBook',
      `OutOfPrintBook not.$ref must be InPrintBook, got ${JSON.stringify(notClause.$ref)}`
    );
  });
});

// ---------------------------------------------------------------------------
// A-8  equivalentClass  AuthorName ≡ PersonName
// ---------------------------------------------------------------------------

void describe('A-8: AuthorName equivalentClass PersonName round-trips', () => {
  void it('AuthorName carries $ref = PersonName', () => {
    const authorName = findRt('urn:bookstore:AuthorName');

    assert.ok(authorName !== undefined, 'AuthorName must be in round-trip result');
    assert.equal(
      authorName.$ref,
      'urn:bookstore:PersonName',
      `AuthorName $ref must be PersonName (equivalentClass), got ${JSON.stringify(authorName.$ref)}`
    );
  });
});

// ---------------------------------------------------------------------------
// A-9  characteristics preserved in fromTbox result
// ---------------------------------------------------------------------------

void describe('A-9: property characteristics preserved in fromTbox characteristics array', () => {
  void it('fromTbox result.characteristics contains inverseFunctional for customerId', () => {
    const custInvFn = fromTboxResult.characteristics.find((charEntry) => {
      return charEntry.propertyIri === 'https://bookstore.example/customerId'
        && charEntry.characteristic.toLowerCase().includes('inverse');
    });

    assert.ok(
      custInvFn !== undefined,
      `fromTbox characteristics must include inverseFunctional for customerId — got: ${JSON.stringify(fromTboxResult.characteristics.slice(0, 5))}`
    );
  });

  void it('fromTbox result.characteristics contains symmetric for SimilarBook.b', () => {
    const sym = fromTboxResult.characteristics.find((charEntry) => {
      return charEntry.propertyIri === 'https://bookstore.example/b'
        && charEntry.characteristic.toLowerCase().includes('symmetric');
    });

    assert.ok(
      sym !== undefined,
      `fromTbox characteristics must include symmetric for b — got: ${JSON.stringify(fromTboxResult.characteristics.slice(0, 5))}`
    );
  });

  void it('fromTbox result.characteristics contains asymmetric for Sequel.predecessor', () => {
    const asym = fromTboxResult.characteristics.find((charEntry) => {
      return charEntry.propertyIri === 'https://bookstore.example/predecessor'
        && charEntry.characteristic.toLowerCase().includes('asymmetric');
    });

    assert.ok(
      asym !== undefined,
      'fromTbox characteristics must include asymmetric for predecessor'
    );
  });
});

// ---------------------------------------------------------------------------
// A-10  owl:onProperty restriction IRIs must match the flat property IRIs
//
// SURFACED BUG: every owl:Restriction in the TBox references its property via
// a CLASS-SCOPED IRI (e.g. `urn:bookstore:Customer#customerId`,
// `urn:bookstore:Book#authors`) while the actual property declaration
// (rdfs:domain / rdfs:range) and the ABox assertions use the FLAT property IRI
// (e.g. `https://bookstore.example/customerId`,
// `https://bookstore.example/authors`).
//
// Because the restriction onProperty IRI and the property-assertion IRI differ,
// an OWL reasoner cannot connect a cardinality / value restriction to the
// instances it should constrain — the restriction is effectively orphaned.
//
// The CORRECT behaviour (asserted below) is that every owl:onProperty target
// is a flat property IRI that also appears as the subject of an rdfs:domain
// declaration. This test is `it.skip`-ped because it cannot pass until the OWL
// projection emits restrictions against the flat property IRI in src/.
//
// TODO(src): OwlProjection restriction emission must use the flat property IRI
// (the one carrying rdfs:domain/range) as owl:onProperty, not the
// class-scoped `<ClassIRI>#<prop>` form.
// ---------------------------------------------------------------------------

void describe('A-10: owl:onProperty restriction IRIs match flat property IRIs', () => {
  const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
  const RDFS_DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';
  const RDF_LIST_MEMBER_PREFIX = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#_';

  void it('every owl:onProperty target is a flat property IRI', () => {
    // Flat property IRIs = subjects of an rdfs:domain declaration.
    const flatProps = new Set<string>();

    for (const quad of tboxQuads) {
      if (quad.predicate.value === RDFS_DOMAIN) {
        flatProps.add(quad.subject.value);
      }
    }

    // owl:onProperty targets, excluding RDF container-membership properties
    // (rdf:_1 … rdf:_n) which are list infrastructure, not domain properties.
    const onPropertyTargets = tboxQuads
      .filter((quad) => {
        return quad.predicate.value === OWL_ON_PROPERTY
          && !quad.object.value.startsWith(RDF_LIST_MEMBER_PREFIX);
      })
      .map((quad) => {
        return quad.object.value;
      });

    const mismatches = onPropertyTargets.filter((iri) => {
      return !flatProps.has(iri);
    });

    assert.deepEqual(
      mismatches,
      [],
      'owl:onProperty must reference flat property IRIs (carrying rdfs:domain), '
      + `but these class-scoped IRIs were used instead:\n${[...new Set(mismatches)].sort().join('\n')}`
    );
  });
});
