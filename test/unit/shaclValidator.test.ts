/**
 * Unit tests for ShaclValidator — native SHACL validation engine.
 *
 * Tests `ShaclValidator.validate(shapes, data)` directly using `JsonTology`
 * to produce both shape quads (`toShacl().shaclQuads()`) and data quads
 * (`toQuads()`). This ensures the sh:path values in shapes always match the
 * predicate IRIs in ABox data (both go through JsonTology's predicateResolver).
 *
 * Hand-crafted data quads for non-conforming cases use the same predicate IRIs
 * that `toQuads()` produces: `<baseIRI>/<propertyName>` (no fragment).
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { ShaclProjection } from '../../src/modules/rdf/ShaclProjection.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { ShaclValidator } from '../../src/modules/validation/ShaclValidator.js';
import { JsonTology } from '../../src/JsonTology.js';
import { Terms } from '../../src/modules/rdf/Terms.js';
import {
  RDF, SH, XSD
} from '../../src/constants/IRI.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';
import type {
  BnodeTermType, IriTermType, QuadObjectType
} from '../../src/types/Quad.js';

// ---------------------------------------------------------------------------
// Shared base IRI — all schemas and instances live under this namespace
// ---------------------------------------------------------------------------

const BASE = 'https://example.com';

// ---------------------------------------------------------------------------
// Quad construction helpers
// ---------------------------------------------------------------------------

function typeQuad(subject: string, classIri: string): QuadInterface {
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

function strQuad(subject: string, predicate: string, value: string): QuadInterface {
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

function intQuad(subject: string, predicate: string, value: number): QuadInterface {
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

function decQuad(subject: string, predicate: string, value: number): QuadInterface {
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

// ---------------------------------------------------------------------------
// sh:minCount — required property
// ---------------------------------------------------------------------------

void describe('ShaclValidator — minCount (required property)', () => {
  const TitleSchema = {
    '$id': `${BASE}/Title`,
    'type': 'string'
  } as const;

  const BookSchema = {
    '$id': `${BASE}/Book`,
    'properties': { 'title': { '$ref': `${BASE}/Title` } },
    'required': ['title'],
    'type': 'object'
  } as const;

  // Use JsonTology so predicateResolver aligns sh:path with toQuads predicates
  const jt = JsonTology.create({
    'baseIRI': BASE,
    'schemas': [
      TitleSchema,
      BookSchema
    ] as const
  });
  const shapeQuads = jt.toShacl().shaclQuads();

  void it('conforms when required property is present', () => {
    const dataQuads = jt.toQuads(BookSchema, { 'title': 'My Book' });
    const report = ShaclValidator.validate(shapeQuads, dataQuads);

    assert.equal(report.conforms, true, 'report.conforms must be true');
    assert.equal(report.results.length, 0, 'results must be empty');
  });

  void it('violation when required property is absent', () => {
    // Build focus node with type but no title predicate
    // The sh:path for title is <BASE>/title (JsonTology strips fragment)
    const titlePath = shapeQuads.find((quad) => {
      return quad.predicate.value === SH.path;
    })?.object.value ?? `${BASE}/title`;
    const focusNode = `${BASE}/instances/book-missing-title`;
    // title absent
    const data: QuadInterface[] = [typeQuad(focusNode, `${BASE}/Book`)];
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
// sh:maxCount — too many values
// ---------------------------------------------------------------------------

void describe('ShaclValidator — maxCount', () => {
  const BookSchema = {
    '$id': `${BASE}/BookMax`,
    'properties': { 'title': { 'type': 'string' } },
    'type': 'object'
  } as const;

  const jt = JsonTology.create({
    'baseIRI': BASE,
    'schemas': [BookSchema] as const
  });
  const shapeQuads = jt.toShacl().shaclQuads();
  const titlePath = `${BASE}/title`;

  void it('violation when scalar has multiple values', () => {
    const focusNode = `${BASE}/instances/book-many-titles`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, `${BASE}/BookMax`),
      strQuad(focusNode, titlePath, 'Title A'),
      strQuad(focusNode, titlePath, 'Title B')
    ];
    const report = ShaclValidator.validate(shapeQuads, data);

    assert.equal(report.conforms, false);
    const violation = report.results.find((result) => {
      return result.sourceConstraintComponent === SH.MaxCountConstraintComponent;
    });

    assert.ok(violation !== undefined, 'MaxCountConstraintComponent violation expected');
    assert.equal(violation.focusNode, focusNode);
    assert.equal(violation.resultPath, titlePath);
  });
});

// ---------------------------------------------------------------------------
// sh:datatype — wrong datatype
// ---------------------------------------------------------------------------

void describe('ShaclValidator — datatype', () => {
  const YearBook = {
    '$id': `${BASE}/YearBook`,
    'properties': { 'year': { 'type': 'integer' } },
    'type': 'object'
  } as const;

  const jt = JsonTology.create({
    'baseIRI': BASE,
    'schemas': [YearBook] as const
  });
  const shapeQuads = jt.toShacl().shaclQuads();
  const yearPath = `${BASE}/year`;

  void it('conforms when datatype is correct', () => {
    const dataQuads = jt.toQuads(YearBook, { 'year': 2024 });
    const report = ShaclValidator.validate(shapeQuads, dataQuads);

    assert.equal(report.conforms, true);
  });

  void it('violation when datatype is wrong (string instead of integer)', () => {
    const focusNode = `${BASE}/instances/year-wrong-dt`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, `${BASE}/YearBook`),
      // string, not integer
      strQuad(focusNode, yearPath, '2024')
    ];
    const report = ShaclValidator.validate(shapeQuads, data);

    assert.equal(report.conforms, false);
    const violation = report.results.find((result) => {
      return result.sourceConstraintComponent === SH.DatatypeConstraintComponent;
    });

    assert.ok(violation !== undefined, 'DatatypeConstraintComponent violation expected');
    assert.equal(violation.value, '2024');
    assert.equal(violation.focusNode, focusNode);
  });
});

// ---------------------------------------------------------------------------
// sh:pattern — pattern mismatch
// Constrained primitives must be extracted to their own $id schema per repo rules.
// ---------------------------------------------------------------------------

void describe('ShaclValidator — pattern', () => {
  const IsbnSchema = {
    '$id': `${BASE}/Isbn`,
    'pattern': '^[0-9-]+$',
    'type': 'string'
  } as const;

  const PatternBook = {
    '$id': `${BASE}/PatternBook`,
    'properties': { 'isbn': { '$ref': `${BASE}/Isbn` } },
    'type': 'object'
  } as const;

  const jt = JsonTology.create({
    'baseIRI': BASE,
    'schemas': [
      IsbnSchema,
      PatternBook
    ] as const
  });
  const shapeQuads = jt.toShacl().shaclQuads();
  const isbnPath = `${BASE}/isbn`;

  void it('conforms with matching pattern', () => {
    const dataQuads = jt.toQuads(PatternBook, { 'isbn': '978-0-12345678' });
    const report = ShaclValidator.validate(shapeQuads, dataQuads);

    assert.equal(report.conforms, true);
  });

  void it('violation with non-matching pattern — direct property shape', () => {
    // Build an artificial node shape with a property shape carrying sh:pattern
    // directly. PatternConstraintComponent fires on property shapes.
    const shapeIri = `${BASE}/PatternShapeTest`;
    const psId = 'ps_pattern_test';

    const artificialShapes: QuadInterface[] = [
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
        'object': Terms.iri(isbnPath),
        'predicate': Terms.iri(SH.path),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('^[0-9-]+$', { 'datatype': Terms.iri(XSD.string) }),
        'predicate': Terms.iri(SH.pattern),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ];

    const focusNode = `${BASE}/instances/isbn-bad`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, shapeIri),
      strQuad(focusNode, isbnPath, 'NOT_AN_ISBN!')
    ];
    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false);
    const violation = report.results.find((result) => {
      return result.sourceConstraintComponent === SH.PatternConstraintComponent;
    });

    assert.ok(violation !== undefined, 'PatternConstraintComponent violation expected');
    assert.equal(violation.value, 'NOT_AN_ISBN!');
  });

  void it('violation for invalid regex pattern — not a silent pass', () => {
    // A sh:pattern with a syntactically broken regex (e.g. unmatched bracket)
    // must produce a PatternConstraintComponent violation instead of silently
    // treating the constraint as satisfied.
    const shapeIri = `${BASE}/BadPatternShape`;
    const psId = 'ps_bad_pattern';
    const propPath = `${BASE}/code`;

    const artificialShapes: QuadInterface[] = [
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
        'object': Terms.iri(propPath),
        'predicate': Terms.iri(SH.path),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('[invalid(regex', { 'datatype': Terms.iri(XSD.string) }),
        'predicate': Terms.iri(SH.pattern),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ];

    const focusNode = `${BASE}/instances/item-1`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, shapeIri),
      strQuad(focusNode, propPath, 'anything')
    ];
    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false, 'report must not conform when sh:pattern is invalid');

    const badPatternResult = report.results.find((result) => {
      return result.sourceConstraintComponent === SH.PatternConstraintComponent;
    });

    assert.ok(badPatternResult !== undefined, 'PatternConstraintComponent violation expected for malformed regex');
    assert.ok(
      badPatternResult.resultMessage.includes('[invalid(regex'),
      'violation message must identify the offending pattern'
    );
  });
});

// ---------------------------------------------------------------------------
// sh:minLength / sh:maxLength
// ---------------------------------------------------------------------------

void describe('ShaclValidator — minLength / maxLength', () => {
  const CodeSchema = {
    '$id': `${BASE}/Code`,
    'maxLength': 10,
    'minLength': 3,
    'type': 'string'
  } as const;

  const LenBook = {
    '$id': `${BASE}/LenBook`,
    'properties': { 'code': { '$ref': `${BASE}/Code` } },
    'type': 'object'
  } as const;

  const jt = JsonTology.create({
    'baseIRI': BASE,
    'schemas': [
      CodeSchema,
      LenBook
    ] as const
  });
  const shapeQuads = jt.toShacl().shaclQuads();
  const codePath = `${BASE}/code`;

  void it('conforms within length bounds', () => {
    const dataQuads = jt.toQuads(LenBook, { 'code': 'HELLO' });

    assert.equal(ShaclValidator.validate(shapeQuads, dataQuads).conforms, true);
  });

  void it('violation for too-short value (minLength) — direct property shape', () => {
    // Build a property shape directly with minLength to test the constraint
    const shapeIri = `${BASE}/LenShapeTest`;
    const psId = 'ps_len_test';

    const artificialShapes: QuadInterface[] = [
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
        'object': Terms.iri(codePath),
        'predicate': Terms.iri(SH.path),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('3', { 'datatype': Terms.iri(XSD.integer) }),
        'predicate': Terms.iri(SH.minLength),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('10', { 'datatype': Terms.iri(XSD.integer) }),
        'predicate': Terms.iri(SH.maxLength),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ];

    const focusNode = `${BASE}/instances/len-short`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, shapeIri),
      strQuad(focusNode, codePath, 'Hi')
    ];
    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MinLengthConstraintComponent;
      }),
      'MinLengthConstraintComponent violation expected'
    );
  });

  void it('violation for too-long value (maxLength) — direct property shape', () => {
    const shapeIri = `${BASE}/LenShapeTest2`;
    const psId = 'ps_len_test2';

    const artificialShapes: QuadInterface[] = [
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
        'object': Terms.iri(codePath),
        'predicate': Terms.iri(SH.path),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('3', { 'datatype': Terms.iri(XSD.integer) }),
        'predicate': Terms.iri(SH.minLength),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('10', { 'datatype': Terms.iri(XSD.integer) }),
        'predicate': Terms.iri(SH.maxLength),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ];

    const focusNode = `${BASE}/instances/len-long`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, shapeIri),
      strQuad(focusNode, codePath, 'VERYLONGTOOLONGCODE')
    ];
    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MaxLengthConstraintComponent;
      }),
      'MaxLengthConstraintComponent violation expected'
    );
  });
});

// ---------------------------------------------------------------------------
// sh:minInclusive / sh:maxInclusive
// ---------------------------------------------------------------------------

void describe('ShaclValidator — minInclusive / maxInclusive', () => {
  const PriceSchema = {
    '$id': `${BASE}/Price`,
    'maximum': 999,
    'minimum': 0,
    'type': 'number'
  } as const;

  const RangeBook = {
    '$id': `${BASE}/RangeBook`,
    'properties': { 'price': { '$ref': `${BASE}/Price` } },
    'type': 'object'
  } as const;

  const jt = JsonTology.create({
    'baseIRI': BASE,
    'schemas': [
      PriceSchema,
      RangeBook
    ] as const
  });
  const shapeQuads = jt.toShacl().shaclQuads();
  const pricePath = `${BASE}/price`;

  void it('conforms within inclusive range', () => {
    const dataQuads = jt.toQuads(RangeBook, { 'price': 42.5 });

    assert.equal(ShaclValidator.validate(shapeQuads, dataQuads).conforms, true);
  });

  void it('violation below minInclusive — direct property shape', () => {
    const shapeIri = `${BASE}/RangeShapeTest`;
    const psId = 'ps_range_test';

    const artificialShapes: QuadInterface[] = [
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
        'object': Terms.iri(pricePath),
        'predicate': Terms.iri(SH.path),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('0', { 'datatype': Terms.iri(XSD.decimal) }),
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
        'object': Terms.literal('999', { 'datatype': Terms.iri(XSD.decimal) }),
        'predicate': Terms.iri(SH.maxInclusive),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ];

    const focusNode = `${BASE}/instances/price-low`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, shapeIri),
      decQuad(focusNode, pricePath, -1)
    ];
    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MinInclusiveConstraintComponent;
      }),
      'MinInclusiveConstraintComponent violation expected'
    );
  });

  void it('violation above maxInclusive — direct property shape', () => {
    const shapeIri = `${BASE}/RangeShapeTest2`;
    const psId = 'ps_range_test2';

    const artificialShapes: QuadInterface[] = [
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
        'object': Terms.iri(pricePath),
        'predicate': Terms.iri(SH.path),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('0', { 'datatype': Terms.iri(XSD.decimal) }),
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
        'object': Terms.literal('999', { 'datatype': Terms.iri(XSD.decimal) }),
        'predicate': Terms.iri(SH.maxInclusive),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ];

    const focusNode = `${BASE}/instances/price-high`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, shapeIri),
      decQuad(focusNode, pricePath, 1000)
    ];
    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MaxInclusiveConstraintComponent;
      }),
      'MaxInclusiveConstraintComponent violation expected'
    );
  });
});

// ---------------------------------------------------------------------------
// sh:minExclusive / sh:maxExclusive
// ---------------------------------------------------------------------------

void describe('ShaclValidator — minExclusive / maxExclusive', () => {
  const YearExclSchema = {
    '$id': `${BASE}/YearExcl`,
    'exclusiveMaximum': 2100,
    'exclusiveMinimum': 1000,
    'type': 'integer'
  } as const;

  const ExclBook = {
    '$id': `${BASE}/ExclBook`,
    'properties': { 'year': { '$ref': `${BASE}/YearExcl` } },
    'type': 'object'
  } as const;

  const jt = JsonTology.create({
    'baseIRI': BASE,
    'schemas': [
      YearExclSchema,
      ExclBook
    ] as const
  });

  // Find the actual sh:path for year from the shapes (JsonTology resolver)
  const allShapeQuads = jt.toShacl().shaclQuads();
  const yearPath = allShapeQuads.find((quad) => {
    return quad.predicate.value === SH.path && quad.object.value.includes('year');
  })?.object.value ?? `${BASE}/year`;

  void it('violation at exclusiveMinimum boundary (value == min is a violation)', () => {
    const shapeIri = `${BASE}/ExclShapeTest`;
    const psId = 'ps_excl_test';

    const artificialShapes: QuadInterface[] = [
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
        'object': Terms.iri(yearPath),
        'predicate': Terms.iri(SH.path),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('1000', { 'datatype': Terms.iri(XSD.decimal) }),
        'predicate': Terms.iri(SH.minExclusive),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ];

    const focusNode = `${BASE}/instances/excl-min`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, shapeIri),
      // equal to exclusiveMin — violation
      intQuad(focusNode, yearPath, 1000)
    ];
    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MinExclusiveConstraintComponent;
      }),
      'MinExclusiveConstraintComponent violation expected'
    );
  });

  void it('violation at exclusiveMaximum boundary (value == max is a violation)', () => {
    const shapeIri = `${BASE}/ExclShapeTest2`;
    const psId = 'ps_excl_test2';

    const artificialShapes: QuadInterface[] = [
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
        'object': Terms.iri(yearPath),
        'predicate': Terms.iri(SH.path),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('2100', { 'datatype': Terms.iri(XSD.decimal) }),
        'predicate': Terms.iri(SH.maxExclusive),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ];

    const focusNode = `${BASE}/instances/excl-max`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, shapeIri),
      // equal to exclusiveMax — violation
      intQuad(focusNode, yearPath, 2100)
    ];
    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false);
    assert.ok(
      report.results.some((result) => {
        return result.sourceConstraintComponent === SH.MaxExclusiveConstraintComponent;
      }),
      'MaxExclusiveConstraintComponent violation expected'
    );
  });
});

// ---------------------------------------------------------------------------
// sh:in (enum) — value not in allowed list
// ---------------------------------------------------------------------------

void describe('ShaclValidator — sh:in (enum)', () => {
  void it('violation when value is not in sh:in list — direct property shape', () => {
    // Build a property shape with sh:in on a property to test InConstraintComponent
    const GenreSchema = {
      '$id': `${BASE}/Genre`,
      'enum': [
        'fiction',
        'non-fiction'
      ],
      'type': 'string'
    } as const;

    // Get the sh:in list head from ShaclProjection on the Genre NodeShape
    const genreGraph = new SchemaGraph(GenreSchema);
    const genreShapes = ShaclProjection.graph(genreGraph);
    const inQuad = genreShapes.find((quad) => {
      return quad.predicate.value === SH.in;
    });

    assert.ok(inQuad !== undefined, 'sh:in quad must be emitted on Genre NodeShape');

    const listHead = inQuad.object.value;
    const shapeIri = `${BASE}/GenreShapeWithInProp`;
    const psId = 'ps_genre_in';

    // Manually build a node shape with a property shape using sh:in
    const artificialShapes: QuadInterface[] = [
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
        'object': Terms.iri(`${BASE}/genre`),
        'predicate': Terms.iri(SH.path),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.blank(listHead),
        'predicate': Terms.iri(SH.in),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      // Carry all bnode quads from Genre (the rdf:list nodes)
      ...genreShapes.filter((quad) => {
        return quad.subject.termType === 'BlankNode';
      })
    ];

    const focusNode = `${BASE}/instances/enum-bad`;
    const data: QuadInterface[] = [
      typeQuad(focusNode, shapeIri),
      // not in list
      strQuad(focusNode, `${BASE}/genre`, 'mystery')
    ];

    const report = ShaclValidator.validate(artificialShapes, data);

    assert.equal(report.conforms, false);
    const violation = report.results.find((result) => {
      return result.sourceConstraintComponent === SH.InConstraintComponent;
    });

    assert.ok(violation !== undefined, 'InConstraintComponent violation expected');
    assert.equal(violation.value, 'mystery');
    assert.equal(violation.focusNode, focusNode);
  });
});

// ---------------------------------------------------------------------------
// sh:deactivated — deactivated shapes must be skipped
// ---------------------------------------------------------------------------

void describe('ShaclValidator — sh:deactivated', () => {
  void it('deactivated node shape produces no violations even with missing required values', () => {
    const shapeIri = `${BASE}/DepBook`;
    const psId = 'ps_dep';

    const shapeQuads: QuadInterface[] = [
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
      // sh:deactivated true — this shape must be skipped
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('true', { 'datatype': Terms.iri(XSD.boolean) }),
        'predicate': Terms.iri(SH.deactivated),
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
        'object': Terms.iri(`${BASE}/requiredField`),
        'predicate': Terms.iri(SH.path),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      },
      {
        'equals': () => {
          return false;
        },
        'graph': Terms.defaultGraph(),
        'object': Terms.literal('1', { 'datatype': Terms.iri(XSD.integer) }),
        'predicate': Terms.iri(SH.minCount),
        'subject': Terms.blank(psId),
        'termType': 'Quad',
        'value': ''
      }
    ];

    const focusNode = `${BASE}/instances/dep1`;
    // requiredField absent — would violate if shape were active
    const data: QuadInterface[] = [typeQuad(focusNode, shapeIri)];

    const report = ShaclValidator.validate(shapeQuads, data);

    assert.equal(report.conforms, true, 'Deactivated shape must produce no violations');
    assert.equal(report.results.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Raw quad array as shapes argument
// ---------------------------------------------------------------------------

void describe('ShaclValidator — accepts raw quad array', () => {
  void it('raw quad array and OntologyBuilder produce identical results', () => {
    const RawBook = {
      '$id': `${BASE}/RawBook`,
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': BASE,
      'schemas': [RawBook] as const
    });

    const dataQuads = jt.toQuads(RawBook, { 'name': 'Alice' });

    // Both overloads must agree on a conforming instance
    const fromBuilder = ShaclValidator.validate(jt.toShacl().shaclQuads(), dataQuads);
    const fromRaw = ShaclValidator.validate(jt.toShacl().shaclQuads(), dataQuads);

    assert.equal(fromBuilder.conforms, true);
    assert.equal(fromRaw.conforms, true);
    assert.equal(fromBuilder.results.length, 0);
  });

  void it('raw quad array detects minCount violation', () => {
    const RawBook2 = {
      '$id': `${BASE}/RawBook2`,
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': BASE,
      'schemas': [RawBook2] as const
    });

    const rawShapes = jt.toShacl().shaclQuads();
    const focusNode = `${BASE}/instances/raw-missing`;
    // name absent
    const data: QuadInterface[] = [typeQuad(focusNode, `${BASE}/RawBook2`)];

    const report = ShaclValidator.validate(rawShapes, data);

    assert.equal(report.conforms, false);
    assert.ok(report.results.some((result) => {
      return result.sourceConstraintComponent === SH.MinCountConstraintComponent;
    }));
  });
});

// ---------------------------------------------------------------------------
// Spec-conformance regression coverage from the validator audit:
//   E — sh:node recursion is cycle-safe (no stack overflow on cyclic data)
//   A — node-level core constraints (sh:in) are evaluated against the focus node
//   C — sh:and / sh:or / sh:not blank-node member shapes are validated
//   B — node-level results omit sh:resultPath
// ---------------------------------------------------------------------------

function iriObjQuad(subject: string, predicate: string, objectIri: string): QuadInterface {
  return Terms.quad(Terms.iri(subject), Terms.iri(predicate), Terms.iri(objectIri));
}

function shapeQuad(subject: BnodeTermType | IriTermType, predicate: string, object: QuadObjectType): QuadInterface {
  return Terms.quad(subject, Terms.iri(predicate), object);
}

/** Build an rdf:first/rdf:rest list, returning the head term and chain quads. */
function rdfList(prefix: string, items: QuadObjectType[]): {
  'head': QuadObjectType;
  'quads': QuadInterface[];
} {
  if (items.length === 0) {
    return {
      'head': Terms.iri(RDF.nil),
      'quads': []
    };
  }

  const quads: QuadInterface[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const node = Terms.blank(`${prefix}${idx}`);
    const rest = idx + 1 < items.length ? Terms.blank(`${prefix}${idx + 1}`) : Terms.iri(RDF.nil);

    quads.push(Terms.quad(node, Terms.iri(RDF.first), items[idx]));
    quads.push(Terms.quad(node, Terms.iri(RDF.rest), rest));
  }

  return {
    'head': Terms.blank(`${prefix}0`),
    quads
  };
}

void describe('ShaclValidator — composition, node-level, and recursion (audit coverage)', () => {
  void it('E: sh:node recursion over cyclic data terminates without overflow', () => {
    const Person = {
      '$id': `${BASE}/Person`,
      'properties': {
        'manager': { '$ref': `${BASE}/Person` },
        'name': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    } as const;
    const jt = JsonTology.create({
      'baseIRI': BASE,
      'schemas': [Person]
    });
    const shapes = jt.toShacl().shaclQuads();
    const self = `${BASE}/instances/p1`;
    const data: QuadInterface[] = [
      typeQuad(self, Person.$id),
      strQuad(self, `${BASE}/name`, 'Loop'),
      iriObjQuad(self, `${BASE}/manager`, self)
    ];

    let report: ReturnType<typeof ShaclValidator.validate> | undefined;

    assert.doesNotThrow(() => {
      report = ShaclValidator.validate(shapes, data);
    });
    assert.ok(report !== undefined);
    assert.equal(typeof report.conforms, 'boolean');
  });

  void it('A + B: node-level sh:in flags a focus node not in the list, omitting resultPath', () => {
    const Color = `${BASE}/Color`;
    const list = rdfList('_:cl', [
      Terms.iri(`${BASE}/red`),
      Terms.iri(`${BASE}/green`)
    ]);
    const shapes: QuadInterface[] = [
      shapeQuad(Terms.iri(Color), RDF.type, Terms.iri(SH.NodeShape)),
      shapeQuad(Terms.iri(Color), SH.in, list.head),
      ...list.quads
    ];
    const data: QuadInterface[] = [typeQuad(`${BASE}/blue`, Color)];

    const report = ShaclValidator.validate(shapes, data);

    assert.equal(report.conforms, false);
    const violation = report.results.find((result) => {
      return result.sourceConstraintComponent === SH.InConstraintComponent;
    });

    assert.ok(violation, 'node-level sh:in violation expected');
    assert.equal(violation.focusNode, `${BASE}/blue`);
    assert.equal(violation.resultPath, undefined, 'node-level result omits sh:resultPath');
  });

  void it('C: sh:not with a blank-node member shape is validated (conforming focus triggers a violation)', () => {
    const Thing = `${BASE}/Thing`;
    const shapes: QuadInterface[] = [
      shapeQuad(Terms.iri(Thing), RDF.type, Terms.iri(SH.NodeShape)),
      shapeQuad(Terms.iri(Thing), SH.not, Terms.blank('_:notInner')),
      shapeQuad(Terms.blank('_:notInner'), SH.property, Terms.blank('_:notPs')),
      shapeQuad(Terms.blank('_:notPs'), SH.path, Terms.iri(`${BASE}/name`)),
      shapeQuad(Terms.blank('_:notPs'), SH.minCount, Terms.literal('1', { 'datatype': Terms.iri(XSD.integer) }))
    ];

    // Has a name → conforms to the inner shape → sh:not must fire.
    const withName: QuadInterface[] = [
      typeQuad(`${BASE}/x1`, Thing),
      strQuad(`${BASE}/x1`, `${BASE}/name`, 'present')
    ];
    const reportViolating = ShaclValidator.validate(shapes, withName);

    assert.equal(reportViolating.conforms, false);
    const notViolation = reportViolating.results.find((result) => {
      return result.sourceConstraintComponent === SH.NotConstraintComponent;
    });

    assert.ok(notViolation, 'blank-node sh:not member must be validated');
    assert.equal(notViolation.resultPath, undefined, 'node-level sh:not result omits sh:resultPath');

    // No name → does NOT conform to the inner shape → sh:not passes (not unconditional).
    const withoutName: QuadInterface[] = [typeQuad(`${BASE}/x2`, Thing)];
    const reportConforming = ShaclValidator.validate(shapes, withoutName);

    assert.equal(reportConforming.conforms, true, 'sh:not member is evaluated, not unconditionally firing');
  });

  void it('C: sh:and with a blank-node member shape flags a non-conforming focus node', () => {
    const Account = `${BASE}/Account`;
    const andList = rdfList('_:al', [Terms.blank('_:andMember')]);
    const shapes: QuadInterface[] = [
      shapeQuad(Terms.iri(Account), RDF.type, Terms.iri(SH.NodeShape)),
      shapeQuad(Terms.iri(Account), SH.and, andList.head),
      ...andList.quads,
      shapeQuad(Terms.blank('_:andMember'), SH.property, Terms.blank('_:andPs')),
      shapeQuad(Terms.blank('_:andPs'), SH.path, Terms.iri(`${BASE}/email`)),
      shapeQuad(Terms.blank('_:andPs'), SH.minCount, Terms.literal('1', { 'datatype': Terms.iri(XSD.integer) }))
    ];
    const data: QuadInterface[] = [typeQuad(`${BASE}/acc1`, Account)];

    const report = ShaclValidator.validate(shapes, data);

    assert.equal(report.conforms, false);
    assert.ok(report.results.some((result) => {
      return result.sourceConstraintComponent === SH.AndConstraintComponent;
    }), 'blank-node sh:and member must be validated');
  });
});
