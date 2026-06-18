/**
 * ABox declared-datatype agreement + CURIE predicate threading.
 *
 * Part 1 (F5/F9): the ABox literal datatype for numeric/boolean property values
 * is derived from the property's DECLARED schema type+format (read from the
 * canonical graph), not from the JavaScript runtime value. A property declared
 * `type: number, format: float` must emit the SAME xsd datatype in toQuads (ABox)
 * that toTbox/toShacl declares for it (xsd:float), rather than the runtime
 * heuristic xsd:double.
 *
 * Part 2 (Phase 5): a CURIE-valued `x-jt-predicate` (e.g. 'bk:title') is expanded
 * to a full IRI on toQuads emit (via the active Curie), and fromQuads matches the
 * full IRI back to the property on lift — a lossless round-trip.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';
import {
  SH, XSD
} from '../../src/constants/IRI.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';

function objectNamedNodeValue(quad: QuadInterface): string | undefined {
  const obj = quad.object;

  if (obj.termType === 'NamedNode') {
    return obj.value;
  }

  return undefined;
}

function literalDatatypeForPredicate(quads: QuadInterface[], predicate: string): string | undefined {
  for (const quad of quads) {
    if (quad.predicate.value === predicate && quad.object.termType === 'Literal') {
      return quad.object.datatype.value;
    }
  }

  return undefined;
}

void describe('ABox literal datatype is derived from the declared graph type', { 'concurrency': true }, () => {
  void it('type:number format:float emits xsd:float in ABox, matching the TBox/SHACL declaration', () => {
    const MeasurementSchema = {
      '$id': 'https://example.com/Measurement',
      'properties': {
        'temperature': {
          'format': 'float',
          'type': 'number'
        }
      },
      'required': ['temperature'],
      'type': 'object'
    } as const;

    // temperature value 23 is an integer at runtime — the old heuristic
    // (Number.isInteger ? integer : double) would have emitted xsd:integer.
    // The declared type number/float must win → xsd:float. The static
    // toQuads accepts `data: unknown`, so the branded float input is supplied
    // at the trust boundary without weakening the schema's declared format.
    const aboxQuads = JsonTology.toQuads(MeasurementSchema, { 'temperature': 23 });
    const predicate = 'http://json-tology.dev/_/static/temperature';
    const aboxDatatype = literalDatatypeForPredicate(aboxQuads, predicate);

    assert.equal(aboxDatatype, XSD.float, 'ABox literal datatype should be xsd:float (declared), not the runtime heuristic');

    // TBox/SHACL declares the SAME datatype via sh:datatype.
    const shaclQuads = JsonTology.toShacl([MeasurementSchema]).shaclQuads();
    const declaredDatatypes = shaclQuads
      .filter((quad) => {
        return quad.predicate.value === SH.datatype;
      })
      .map((quad) => {
        return objectNamedNodeValue(quad);
      });

    assert.ok(
      declaredDatatypes.includes(XSD.float),
      'SHACL should declare sh:datatype xsd:float for the float property'
    );
    assert.equal(aboxDatatype, XSD.float, 'ABox and TBox/SHACL must agree on the declared datatype');
  });

  void it('type:integer format:int32 emits xsd:int in ABox (declared precision wins)', () => {
    const CounterSchema = {
      '$id': 'https://example.com/Counter',
      'properties': {
        'count': {
          'format': 'int32',
          'type': 'integer'
        }
      },
      'required': ['count'],
      'type': 'object'
    } as const;

    const aboxQuads = JsonTology.toQuads(CounterSchema, { 'count': 7 });
    const aboxDatatype = literalDatatypeForPredicate(aboxQuads, 'http://json-tology.dev/_/static/count');

    assert.equal(aboxDatatype, XSD.int, 'ABox literal datatype should be xsd:int (declared int32), not xsd:integer');

    const shaclQuads = JsonTology.toShacl([CounterSchema]).shaclQuads();
    const declaredDatatypes = shaclQuads
      .filter((quad) => {
        return quad.predicate.value === SH.datatype;
      })
      .map((quad) => {
        return objectNamedNodeValue(quad);
      });

    assert.ok(declaredDatatypes.includes(XSD.int), 'SHACL should declare sh:datatype xsd:int for the int32 property');
  });

  void it('untyped/freeform numeric value falls back to the runtime heuristic', () => {
    const FreeformSchema = {
      '$id': 'https://example.com/Freeform',
      'properties': { 'value': {} },
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIri': 'https://example.com',
      'schemas': [FreeformSchema]
    });

    const intQuads = jt.toQuads(FreeformSchema, { 'value': 5 });
    const floatQuads = jt.toQuads(FreeformSchema, { 'value': 5.5 });
    const predicate = 'https://example.com/value';

    assert.equal(
      literalDatatypeForPredicate(intQuads, predicate),
      XSD.integer,
      'undeclared integer value should fall back to xsd:integer'
    );
    assert.equal(
      literalDatatypeForPredicate(floatQuads, predicate),
      XSD.double,
      'undeclared fractional value should fall back to xsd:double'
    );
  });
});

void describe('CURIE x-jt-predicate expands on toQuads and round-trips through fromQuads', { 'concurrency': true }, () => {
  void it('expands a CURIE x-jt-predicate to a full IRI and lifts it back', () => {
    const BookSchema = {
      '$id': 'https://example.com/Book',
      'properties': {
        'title': {
          'type': 'string',
          'x-jt-predicate': 'bk:title'
        }
      },
      'required': ['title'],
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIri': 'https://example.com',
      'prefixes': { 'bk': 'https://books.example.org/vocab#' },
      'schemas': [BookSchema]
    });

    const quads = jt.toQuads(BookSchema, { 'title': 'Dune' });
    const expandedPredicate = 'https://books.example.org/vocab#title';

    // The emitted predicate must be the expanded full IRI, never the CURIE.
    const titleQuad = quads.find((quad) => {
      return quad.predicate.value === expandedPredicate;
    });

    assert.ok(titleQuad !== undefined, 'toQuads should emit the CURIE predicate expanded to its full IRI');
    const curieQuad = quads.find((quad) => {
      return quad.predicate.value === 'bk:title';
    });

    assert.equal(curieQuad, undefined, 'no quad should carry the unexpanded CURIE predicate');

    // fromQuads must match the full-IRI predicate back to the `title` property.
    // Lift via the registered `$id` so the typed overload returns Book objects.
    const lifted = jt.fromQuads(BookSchema.$id, quads);

    assert.equal(lifted.length, 1, 'fromQuads should recover exactly one Book');
    const lifted0 = lifted.at(0);

    if (lifted0 === undefined) {
      throw new Error('expected lifted[0] to exist');
    }
    assert.equal(lifted0.title, 'Dune', 'CURIE predicate should round-trip back to the title property');
  });
});
