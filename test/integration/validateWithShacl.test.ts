/**
 * Integration tests for JsonTology.validateWithShacl.
 *
 * Uses the full JsonTology facade: `toShacl()` produces SHACL shapes,
 * `toQuads()` produces ABox data, and `validateWithShacl()` evaluates them.
 *
 * Non-conforming data is crafted with the same predicate IRIs that `toQuads()`
 * produces (JsonTology's predicateResolver strips fragments). All schemas follow
 * the repo constraint: primitives with validation constraints must have their own
 * `$id` and be referenced via `$ref`.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/JsonTology.js';
import {
  RDF, SH, XSD
} from '../../src/constants/IRI.js';
import { ShaclValidator } from '../../src/modules/validation/ShaclValidator.js';
import { ShaclProjection } from '../../src/modules/rdf/ShaclProjection.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { Terms } from '../../src/modules/quads/Terms.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';

// ---------------------------------------------------------------------------
// Quad construction helpers
// ---------------------------------------------------------------------------

function makeTypeQuad(subject: string, classIri: string): QuadInterface {
  return {
    'equals': () => {
      return false;
    },
    'graph': Terms.defaultGraph(),
    'object': Terms.iri(classIri),
    'predicate': Terms.iri(RDF.type),
    'subject': Terms.iri(subject),
    'termType': 'Quad',
    'value': ''
  };
}

function makeStringQuad(subject: string, predicate: string, value: string): QuadInterface {
  return {
    'equals': () => {
      return false;
    },
    'graph': Terms.defaultGraph(),
    'object': Terms.literal(value, { 'datatype': Terms.iri(XSD.string) }),
    'predicate': Terms.iri(predicate),
    'subject': Terms.iri(subject),
    'termType': 'Quad',
    'value': ''
  };
}

function makeDecimalQuad(subject: string, predicate: string, value: number): QuadInterface {
  return {
    'equals': () => {
      return false;
    },
    'graph': Terms.defaultGraph(),
    'object': Terms.literal(String(value), { 'datatype': Terms.iri(XSD.decimal) }),
    'predicate': Terms.iri(predicate),
    'subject': Terms.iri(subject),
    'termType': 'Quad',
    'value': ''
  };
}

function makeIntegerQuad(subject: string, predicate: string, value: number): QuadInterface {
  return {
    'equals': () => {
      return false;
    },
    'graph': Terms.defaultGraph(),
    'object': Terms.literal(String(value), { 'datatype': Terms.iri(XSD.integer) }),
    'predicate': Terms.iri(predicate),
    'subject': Terms.iri(subject),
    'termType': 'Quad',
    'value': ''
  };
}

/**
 * Build an artificial node shape + property shape quad set.
 * `shapeIri` — the NodeShape IRI.
 * `psId`     — blank-node ID for the PropertyShape (without _: prefix).
 * `pathIri`  — sh:path value.
 * `constraintQuads` — additional quads added to the property shape blank node.
 */
function buildPropShapeQuads(
  shapeIri: string,
  psId: string,
  pathIri: string,
  constraintQuads: QuadInterface[]
): QuadInterface[] {
  return [
    {
      'equals': () => {
        return false;
      },
      'graph': Terms.defaultGraph(),
      'object': Terms.iri(SH.NodeShape),
      'predicate': Terms.iri(RDF.type),
      'subject': Terms.iri(shapeIri),
      'termType': 'Quad',
      'value': ''
    },
    {
      'equals': () => {
        return false;
      },
      'graph': Terms.defaultGraph(),
      'object': Terms.blank(psId),
      'predicate': Terms.iri(SH.property),
      'subject': Terms.iri(shapeIri),
      'termType': 'Quad',
      'value': ''
    },
    {
      'equals': () => {
        return false;
      },
      'graph': Terms.defaultGraph(),
      'object': Terms.iri(SH.PropertyShape),
      'predicate': Terms.iri(RDF.type),
      'subject': Terms.blank(psId),
      'termType': 'Quad',
      'value': ''
    },
    {
      'equals': () => {
        return false;
      },
      'graph': Terms.defaultGraph(),
      'object': Terms.iri(pathIri),
      'predicate': Terms.iri(SH.path),
      'subject': Terms.blank(psId),
      'termType': 'Quad',
      'value': ''
    },
    ...constraintQuads
  ];
}

// ---------------------------------------------------------------------------
// Bookstore domain schemas
// ---------------------------------------------------------------------------

const BASE = 'https://bookstore.example.com';

const GenreSchema = {
  '$id': `${BASE}/Genre`,
  'enum': [
    'fiction',
    'non-fiction',
    'biography',
    'science'
  ],
  'type': 'string'
} as const;

const AuthorSchema = {
  '$id': `${BASE}/Author`,
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

const BookSchema = {
  '$id': `${BASE}/Book`,
  'properties': {
    'author': { '$ref': `${BASE}/Author` },
    'genre': { '$ref': `${BASE}/Genre` },
    'title': { 'type': 'string' },
    'year': { 'type': 'integer' }
  },
  'required': ['title'],
  'type': 'object'
} as const;

const jt = JsonTology.create({
  'baseIri': BASE,
  'schemas': [
    GenreSchema,
    AuthorSchema,
    BookSchema
  ] as const
});

// ---------------------------------------------------------------------------
// Round-trip conformance
// ---------------------------------------------------------------------------

void describe('validateWithShacl — conforming round-trip', () => {
  void it('conforming Book instance produces { conforms: true, results: [] }', () => {
    const bookData = {
      'title': 'The Pragmatic Programmer',
      'year': 1999
    };
    const dataQuads = jt.toQuads(BookSchema, bookData);
    const report = jt.validateWithShacl(jt.toShacl(), dataQuads);

    assert.equal(report.conforms, true, 'Conforming book must produce conforms: true');
    assert.equal(report.results.length, 0, 'No violations for conforming instance');
  });

  void it('minimal conforming Book (title only) produces { conforms: true }', () => {
    const bookData = { 'title': 'Minimal Book' };
    const dataQuads = jt.toQuads(BookSchema, bookData);
    const report = jt.validateWithShacl(jt.toShacl(), dataQuads);

    assert.equal(report.conforms, true);
  });
});

// ---------------------------------------------------------------------------
// sh:minCount — missing required property
// Shapes come from JsonTology; data is hand-crafted using the predicate IRI
// that toQuads() produces (baseIri/propertyName, no fragment).
// ---------------------------------------------------------------------------

void describe('validateWithShacl — missing required field (sh:minCount)', () => {
  void it('produces MinCountConstraintComponent violation for missing title', () => {
    const SimpleBookSchema = {
      '$id': `${BASE}/SimpleBook`,
      'properties': {
        'subtitle': { 'type': 'string' },
        'title': { 'type': 'string' }
      },
      'required': ['title'],
      'type': 'object'
    } as const;

    const jtSimple = JsonTology.create({
      'baseIri': BASE,
      'schemas': [SimpleBookSchema] as const
    });

    const shapeQuads = jtSimple.toShacl().shaclQuads();

    // Discover the actual sh:path IRI for title from the emitted shapes
    const titlePathQuad = shapeQuads.find((quad) => {
      return quad.predicate.value === SH.path && quad.object.value.endsWith('/title');
    });

    assert.ok(titlePathQuad !== undefined, 'sh:path for title must exist in shapes');
    const titlePath = titlePathQuad.object.value;

    // Hand-craft a focus node without the title predicate
    const focusNode = `${BASE}/instances/badbook1`;
    // title absent — minCount 1 violation expected
    const data: QuadInterface[] = [makeTypeQuad(focusNode, `${BASE}/SimpleBook`)];
    const report = ShaclValidator.validate(shapeQuads, data);

    assert.equal(report.conforms, false);
    const violation = report.results.find((result) => {
      return result.sourceConstraintComponent === SH.MinCountConstraintComponent;
    });

    assert.ok(violation !== undefined, 'MinCountConstraintComponent violation expected');
    assert.equal(violation.focusNode, focusNode);
    assert.equal(violation.resultPath, titlePath);
    assert.equal(violation.resultSeverity, 'Violation');
  });
});

// ---------------------------------------------------------------------------
// sh:maxCount — too many values for a scalar property
// ---------------------------------------------------------------------------

void describe('validateWithShacl — too many values (sh:maxCount)', () => {
  void it('produces MaxCountConstraintComponent violation when scalar has multiple values', () => {
    const TitleOnlySchema = {
      '$id': `${BASE}/TitleOnly`,
      'properties': { 'title': { 'type': 'string' } },
      'type': 'object'
    } as const;

    const jtTitle = JsonTology.create({
      'baseIri': BASE,
      'schemas': [TitleOnlySchema] as const
    });

    const shapeQuads = jtTitle.toShacl().shaclQuads();
    const titlePath = shapeQuads.find((quad) => {
      return quad.predicate.value === SH.path && quad.object.value.includes('title');
    })?.object.value ?? `${BASE}/title`;

    const focusNode = `${BASE}/instances/maxcount1`;
    const data: QuadInterface[] = [
      makeTypeQuad(focusNode, `${BASE}/TitleOnly`),
      makeStringQuad(focusNode, titlePath, 'Title One'),
      makeStringQuad(focusNode, titlePath, 'Title Two')
    ];
    const report = ShaclValidator.validate(shapeQuads, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MaxCountConstraintComponent;
      }),
      'Expected MaxCountConstraintComponent violation'
    );
  });
});

// ---------------------------------------------------------------------------
// sh:datatype — wrong datatype
// ---------------------------------------------------------------------------

void describe('validateWithShacl — wrong datatype (sh:datatype)', () => {
  void it('produces DatatypeConstraintComponent violation for wrong datatype', () => {
    const YearBookSchema = {
      '$id': `${BASE}/YearBook`,
      'properties': { 'year': { 'type': 'integer' } },
      'type': 'object'
    } as const;

    const jtYear = JsonTology.create({
      'baseIri': BASE,
      'schemas': [YearBookSchema] as const
    });

    const shapeQuads = jtYear.toShacl().shaclQuads();
    const yearPath = shapeQuads.find((quad) => {
      return quad.predicate.value === SH.path && quad.object.value.includes('year');
    })?.object.value ?? `${BASE}/year`;

    const focusNode = `${BASE}/instances/dtype1`;
    const data: QuadInterface[] = [
      makeTypeQuad(focusNode, `${BASE}/YearBook`),
      // Provide year as decimal instead of integer
      makeDecimalQuad(focusNode, yearPath, 2020)
    ];
    const report = ShaclValidator.validate(shapeQuads, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.DatatypeConstraintComponent
          && result.focusNode === focusNode;
      }),
      'Expected DatatypeConstraintComponent violation'
    );
  });
});

// ---------------------------------------------------------------------------
// sh:pattern — pattern mismatch (direct property shape, constraint on psId bnode)
// ---------------------------------------------------------------------------

void describe('validateWithShacl — pattern mismatch (sh:pattern)', () => {
  void it('produces PatternConstraintComponent violation for non-matching value', () => {
    // Build shapes directly with a property shape carrying sh:pattern
    const shapeIri = `${BASE}/PatternBook`;
    const codePath = `${BASE}/code`;
    const psId = 'ps_pattern_int';

    const artificialShapes: QuadInterface[] = buildPropShapeQuads(shapeIri, psId, codePath, [{
      'equals': () => {
        return false;
      },
      'graph': Terms.defaultGraph(),
      'object': Terms.literal('^[A-Z]{3}-[0-9]+$', { 'datatype': Terms.iri(XSD.string) }),
      'predicate': Terms.iri(SH.pattern),
      'subject': Terms.blank(psId),
      'termType': 'Quad',
      'value': ''
    }]);

    const focusNode = `${BASE}/instances/pat1`;
    const data: QuadInterface[] = [
      makeTypeQuad(focusNode, shapeIri),
      makeStringQuad(focusNode, codePath, 'invalid-code')
    ];
    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false);
    const violation = report.results.find((result) => {
      return result.sourceConstraintComponent === SH.PatternConstraintComponent;
    });

    assert.ok(violation !== undefined, 'Expected PatternConstraintComponent violation');
    assert.equal(violation.value, 'invalid-code');
  });
});

// ---------------------------------------------------------------------------
// sh:minInclusive / sh:maxInclusive — out of range
// ---------------------------------------------------------------------------

void describe('validateWithShacl — range constraints (sh:minInclusive / sh:maxInclusive)', () => {
  const ratingPath = `${BASE}/rating`;

  void it('produces MinInclusiveConstraintComponent violation for value below minimum', () => {
    const shapeIri = `${BASE}/RangeBook`;
    const psId = 'ps_range_min';

    const shapes = buildPropShapeQuads(shapeIri, psId, ratingPath, [
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('1', { 'datatype': Terms.iri(XSD.decimal) }),
        'predicate': Terms.iri(SH.minInclusive),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('5', { 'datatype': Terms.iri(XSD.decimal) }),
        'predicate': Terms.iri(SH.maxInclusive),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ]);

    const focusNode = `${BASE}/instances/range1`;
    const data: QuadInterface[] = [
      makeTypeQuad(focusNode, shapeIri),
      makeDecimalQuad(focusNode, ratingPath, 0)
    ];
    const report = ShaclValidator.validate(shapes, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MinInclusiveConstraintComponent;
      }),
      'Expected MinInclusiveConstraintComponent violation'
    );
  });

  void it('produces MaxInclusiveConstraintComponent violation for value above maximum', () => {
    const shapeIri = `${BASE}/RangeBook2`;
    const psId = 'ps_range_max';

    const shapes = buildPropShapeQuads(shapeIri, psId, ratingPath, [
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('1', { 'datatype': Terms.iri(XSD.decimal) }),
        'predicate': Terms.iri(SH.minInclusive),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('5', { 'datatype': Terms.iri(XSD.decimal) }),
        'predicate': Terms.iri(SH.maxInclusive),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ]);

    const focusNode = `${BASE}/instances/range2`;
    const data: QuadInterface[] = [
      makeTypeQuad(focusNode, shapeIri),
      makeDecimalQuad(focusNode, ratingPath, 6)
    ];
    const report = ShaclValidator.validate(shapes, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MaxInclusiveConstraintComponent;
      }),
      'Expected MaxInclusiveConstraintComponent violation'
    );
  });
});

// ---------------------------------------------------------------------------
// sh:in — value not in enum list
// ---------------------------------------------------------------------------

void describe('validateWithShacl — sh:in (value not in enum list)', () => {
  void it('produces InConstraintComponent violation when property value is not in sh:in list', () => {
    const GenreGraph = new SchemaGraph(GenreSchema);
    const genreShapes = ShaclProjection.graph(GenreGraph);

    const inQuad = genreShapes.find((quad) => {
      return quad.predicate.value === SH.in;
    });

    assert.ok(inQuad !== undefined, 'sh:in quad must exist on Genre node shape');

    const listHead = inQuad.object.value;
    const shapeIri = `${BASE}/GenreShapeTest`;
    const psId = 'ps_genre_test';

    const inLinkQuad: QuadInterface = {
      'equals': () => {
        return false;
      },
      'graph': Terms.defaultGraph(),
      'object': Terms.blank(listHead),
      'predicate': Terms.iri(SH.in),
      'subject': Terms.blank(psId),
      'termType': 'Quad',
      'value': ''
    };

    const artificialShapes: QuadInterface[] = [
      ...buildPropShapeQuads(shapeIri, psId, `${BASE}/genre`, [inLinkQuad]),
      ...genreShapes.filter((quad) => {
        return quad.subject.termType === 'BlankNode';
      })
    ];

    const focusNode = `${BASE}/instances/enum1`;
    const data: QuadInterface[] = [
      makeTypeQuad(focusNode, shapeIri),
      makeStringQuad(focusNode, `${BASE}/genre`, 'mystery')
    ];

    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false);
    const inViolation = report.results.find((result) => {
      return result.sourceConstraintComponent === SH.InConstraintComponent;
    });

    assert.ok(inViolation !== undefined, 'Expected InConstraintComponent violation');
    assert.equal(inViolation.value, 'mystery');
    assert.equal(inViolation.focusNode, focusNode);
  });
});

// ---------------------------------------------------------------------------
// OntologyBuilder overload vs raw quad array
// ---------------------------------------------------------------------------

void describe('validateWithShacl — OntologyBuilder overload', () => {
  void it('accepts OntologyBuilder and raw quad array interchangeably', () => {
    const OBBookSchema = {
      '$id': `${BASE}/OBBook`,
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    } as const;

    const jtOB = JsonTology.create({
      'baseIri': BASE,
      'schemas': [OBBookSchema] as const
    });

    const bookData = { 'name': 'Alice in Wonderland' };
    const dataQuads = jtOB.toQuads(OBBookSchema, bookData);

    const builderReport = jtOB.validateWithShacl(jtOB.toShacl(), dataQuads);
    const rawReport = jtOB.validateWithShacl(jtOB.toShacl().shaclQuads(), dataQuads);

    assert.equal(builderReport.conforms, rawReport.conforms);
    assert.equal(builderReport.results.length, rawReport.results.length);
  });
});

// ---------------------------------------------------------------------------
// Full bookstore round-trip conformance
// ---------------------------------------------------------------------------

void describe('validateWithShacl — bookstore round-trip conformance', () => {
  void it('toShacl() + toQuads() round-trip: conforming book conforms', () => {
    const bookData = {
      'title': 'Clean Code',
      'year': 2008
    };
    const dataQuads = jt.toQuads(BookSchema, bookData);
    const shapeQuads = jt.toShacl().shaclQuads();
    const report = ShaclValidator.validate(shapeQuads, dataQuads);

    assert.equal(report.conforms, true, `Expected conforms: true, got: ${report.results.map((result) => {
      return result.resultMessage;
    }).join('; ')}`);
  });

  void it('multiple conforming books all conform', () => {
    const books = [
      {
        'title': 'The Mythical Man-Month',
        'year': 1975
      },
      {
        'title': 'Design Patterns',
        'year': 1994
      },
      {
        'title': 'Refactoring',
        'year': 1999
      }
    ];
    const shapeQuads = jt.toShacl().shaclQuads();

    for (const book of books) {
      const dataQuads = jt.toQuads(BookSchema, book);
      const report = ShaclValidator.validate(shapeQuads, dataQuads);

      assert.equal(report.conforms, true, `Book "${book.title}" should conform but got: ${report.results.map((result) => {
        return result.resultMessage;
      }).join('; ')}`);
    }
  });
});

// ---------------------------------------------------------------------------
// sh:minExclusive / sh:maxExclusive
// ---------------------------------------------------------------------------

void describe('validateWithShacl — exclusive range (sh:minExclusive / sh:maxExclusive)', () => {
  const yearPath = `${BASE}/year`;

  void it('violation at exclusive minimum boundary', () => {
    const shapeIri = `${BASE}/ExclBook`;
    const psId = 'ps_excl_min';

    const shapes = buildPropShapeQuads(shapeIri, psId, yearPath, [{
      'equals': () => {
        return false;
      },
      'graph': Terms.defaultGraph(),
      'object': Terms.literal('1000', { 'datatype': Terms.iri(XSD.decimal) }),
      'predicate': Terms.iri(SH.minExclusive),
      'subject': Terms.blank(psId),
      'termType': 'Quad',
      'value': ''
    }]);

    const focusNode = `${BASE}/instances/excl1`;
    const data: QuadInterface[] = [
      makeTypeQuad(focusNode, shapeIri),
      // equal to exclusiveMin — violation
      makeIntegerQuad(focusNode, yearPath, 1000)
    ];
    const report = ShaclValidator.validate(shapes, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MinExclusiveConstraintComponent;
      }),
      'Expected MinExclusiveConstraintComponent violation'
    );
  });

  void it('violation at exclusive maximum boundary', () => {
    const shapeIri = `${BASE}/ExclBook2`;
    const psId = 'ps_excl_max';

    const shapes = buildPropShapeQuads(shapeIri, psId, yearPath, [{
      'equals': () => {
        return false;
      },
      'graph': Terms.defaultGraph(),
      'object': Terms.literal('2100', { 'datatype': Terms.iri(XSD.decimal) }),
      'predicate': Terms.iri(SH.maxExclusive),
      'subject': Terms.blank(psId),
      'termType': 'Quad',
      'value': ''
    }]);

    const focusNode = `${BASE}/instances/excl2`;
    const data: QuadInterface[] = [
      makeTypeQuad(focusNode, shapeIri),
      // equal to exclusiveMax — violation
      makeIntegerQuad(focusNode, yearPath, 2100)
    ];
    const report = ShaclValidator.validate(shapes, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MaxExclusiveConstraintComponent;
      }),
      'Expected MaxExclusiveConstraintComponent violation'
    );
  });
});
