/**
 * Unit tests for importProperties — OWL 2 §8.1 / §9.2
 *
 * Covered axioms:
 *   - owl:ObjectProperty  + rdfs:domain + rdfs:range (class IRI)  → $ref property slot
 *   - owl:DatatypeProperty + rdfs:domain + rdfs:range (xsd:string) → type: 'string' slot
 *   - multi-domain: same property applies to two classes
 *   - rdfs:subPropertyOf → characteristics entry
 *   - owl:inverseOf      → characteristics entry (no structural delta)
 *   - Bookstore round-trip: Book/Customer/Order property round-trip via OwlImporter
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { Properties } from '../../src/modules/ontology/importDispatch/Properties.js';
import { OwlImporter } from '../../src/modules/ontology/OwlImporter.js';
import type {
  OwlImportContextType, OwlImportFragmentType
} from '../../src/types/OwlImport.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { Terms } from '../../src/modules/quads/Terms.js';
import { Curie } from '../../src/modules/quads/Curie.js';
import { STANDARD_PREFIXES } from '../../src/constants/STANDARD_PREFIXES.js';
import { OwlProjection } from '../../src/modules/rdf/OwlProjection.js';
import {
  OWL, RDF, RDFS, XSD
} from '../../src/constants/IRI.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_IRI = 'urn:example';

function makeCtx(
  quads: QuadInterface[],
  extraClassIris: string[] = []
): OwlImportContextType {
  const graph = SchemaGraph.fromQuads(quads, { 'baseIRI': BASE_IRI });
  const curie = new Curie(STANDARD_PREFIXES);
  const unsupported: Array<{ 'axiomIri': string;
    'subjectIri': null | string }> = [];

  const allClassIris = new Set<string>(extraClassIris);
  const allPropertyIris = new Set<string>();
  const rdfTypeIri = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const owlClassFullIri = 'http://www.w3.org/2002/07/owl#Class';
  const owlObjectPropertyFullIri = 'http://www.w3.org/2002/07/owl#ObjectProperty';
  const owlDatatypePropertyFullIri = 'http://www.w3.org/2002/07/owl#DatatypeProperty';

  for (const quad of quads) {
    if (quad.predicate.value === rdfTypeIri && quad.object.termType === 'NamedNode') {
      const objectValue = quad.object.value;

      if (
        objectValue === owlClassFullIri
        || objectValue === OWL.Class
      ) {
        allClassIris.add(quad.subject.value);
      }

      if (
        objectValue === owlObjectPropertyFullIri
        || objectValue === OWL.ObjectProperty
        || objectValue === owlDatatypePropertyFullIri
        || objectValue === OWL.DatatypeProperty
      ) {
        allPropertyIris.add(quad.subject.value);
      }
    }
  }

  return {
    allClassIris,
    allPropertyIris,
    'baseIRI': BASE_IRI,
    curie,
    graph,
    'isDatatype': (iri: string) => {
      return iri.startsWith('http://www.w3.org/2001/XMLSchema#')
        || iri.startsWith('xsd:');
    },
    'prefixes': STANDARD_PREFIXES,
    'reportUnsupported': (axiomIri, subjectIri) => {
      unsupported.push({
        axiomIri,
        subjectIri
      });
    }
  };
}

function getProps(fragment: OwlImportFragmentType, classIri: string): Record<string, unknown> {
  const delta = fragment.schemaDeltas.get(classIri);

  return (delta?.properties ?? {});
}

// ---------------------------------------------------------------------------
// Manual quad builder (for axioms that OwlProjection does not emit)
// ---------------------------------------------------------------------------

function makeQuad(
  subject: string,
  predicate: string,
  objectValue: string
): QuadInterface {
  return Terms.quad(
    Terms.iri(subject),
    Terms.iri(predicate),
    Terms.iri(objectValue)
  );
}

// Build a minimal set of quads: declare P as owl:ObjectProperty,
// rdfs:domain → C, rdfs:range → R, and declare C as owl:Class.
function buildObjectPropertyQuads(
  propIri: string,
  domainIri: string,
  rangeIri: string
): QuadInterface[] {
  return [
    makeQuad(domainIri, RDF.type, OWL.Class),
    makeQuad(propIri, RDF.type, OWL.ObjectProperty),
    makeQuad(propIri, RDFS.domain, domainIri),
    makeQuad(propIri, RDFS.range, rangeIri)
  ];
}

function buildDatatypePropertyQuads(
  propIri: string,
  domainIri: string,
  rangeIri: string
): QuadInterface[] {
  return [
    makeQuad(domainIri, RDF.type, OWL.Class),
    makeQuad(propIri, RDF.type, OWL.DatatypeProperty),
    makeQuad(propIri, RDFS.domain, domainIri),
    makeQuad(propIri, RDFS.range, rangeIri)
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('importProperties', { 'concurrency': false }, () => {
  void describe('empty input', () => {
    void it('returns an empty fragment for zero quads', () => {
      const ctx = makeCtx([]);
      const fragment = Properties.dispatch([], ctx);

      assert.equal(fragment.schemaDeltas.size, 0, 'no schemaDeltas from empty quads');
      assert.deepEqual(fragment.characteristics, []);
      assert.deepEqual(fragment.invariants, []);
      assert.deepEqual(fragment.sameAs, []);
      assert.deepEqual(fragment.individuals, []);
    });
  });

  void describe('owl:ObjectProperty + rdfs:domain + rdfs:range (class IRI)', () => {
    const PERSON_IRI = 'urn:example:Person';
    const ORDER_IRI = 'urn:example:Order';
    const CUSTOMER_PROP_IRI = `${ORDER_IRI}#customer`;

    void it('adds a $ref property slot to the domain class delta', () => {
      const quads = buildObjectPropertyQuads(CUSTOMER_PROP_IRI, ORDER_IRI, PERSON_IRI);
      const ctx = makeCtx(quads, [PERSON_IRI]);
      const fragment = Properties.dispatch(quads, ctx);
      const props = getProps(fragment, ORDER_IRI);

      assert.ok(
        typeof props.customer === 'object' && props.customer !== null,
        'customer property should be in delta'
      );
      const propSchema = props.customer as Record<string, unknown>;

      assert.equal(propSchema.$ref, PERSON_IRI, 'customer property should have $ref to Person');
    });

    void it('sets type: "object" on the class delta', () => {
      const quads = buildObjectPropertyQuads(CUSTOMER_PROP_IRI, ORDER_IRI, PERSON_IRI);
      const ctx = makeCtx(quads, [PERSON_IRI]);
      const fragment = Properties.dispatch(quads, ctx);
      const delta = fragment.schemaDeltas.get(ORDER_IRI);

      assert.equal(delta?.type, 'object', 'class delta type should be object');
    });
  });

  void describe('owl:DatatypeProperty + rdfs:domain + rdfs:range (xsd:string)', () => {
    const CLASS_IRI = 'urn:example:Book';
    const TITLE_PROP = `${CLASS_IRI}#title`;

    void it('produces type: "string" when range is xsd:string (full IRI)', () => {
      const quads = buildDatatypePropertyQuads(TITLE_PROP, CLASS_IRI, 'http://www.w3.org/2001/XMLSchema#string');
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);
      const props = getProps(fragment, CLASS_IRI);

      assert.ok(props.title !== undefined, 'title property should be in delta');
      const propSchema = props.title as Record<string, unknown>;

      assert.equal(propSchema.type, 'string', 'xsd:string → type: string');
      assert.equal(propSchema.$ref, undefined, 'no $ref for xsd primitive');
    });

    void it('produces type: "string" when range is xsd:string (prefixed)', () => {
      const quads = buildDatatypePropertyQuads(TITLE_PROP, CLASS_IRI, XSD.string);
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);
      const props = getProps(fragment, CLASS_IRI);
      const propSchema = props.title as Record<string, unknown>;

      assert.equal(propSchema.type, 'string', 'prefixed xsd:string → type: string');
    });

    void it('produces type: "string" when range is rdf:langString (full IRI)', () => {
      const quads = buildDatatypePropertyQuads(TITLE_PROP, CLASS_IRI, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);
      const props = getProps(fragment, CLASS_IRI);
      const propSchema = props.title as Record<string, unknown>;

      assert.equal(propSchema.type, 'string', 'rdf:langString (full IRI) → type: string');
      assert.equal(propSchema.$ref, undefined, 'no $ref for rdf:langString');
    });

    void it('produces type: "string" when range is rdf:langString (prefixed)', () => {
      const quads = buildDatatypePropertyQuads(TITLE_PROP, CLASS_IRI, 'rdf:langString');
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);
      const props = getProps(fragment, CLASS_IRI);
      const propSchema = props.title as Record<string, unknown>;

      assert.equal(propSchema.type, 'string', 'rdf:langString (prefixed) → type: string');
    });

    void it('produces type: "integer" when range is xsd:integer (full IRI)', () => {
      const AGE_PROP = `${CLASS_IRI}#age`;
      const quads = buildDatatypePropertyQuads(AGE_PROP, CLASS_IRI, 'http://www.w3.org/2001/XMLSchema#integer');
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);
      const props = getProps(fragment, CLASS_IRI);
      const propSchema = props.age as Record<string, unknown>;

      assert.equal(propSchema.type, 'integer', 'xsd:integer → type: integer');
    });

    void it('produces type: "boolean" when range is xsd:boolean', () => {
      const FLAG_PROP = `${CLASS_IRI}#inStock`;
      const quads = buildDatatypePropertyQuads(FLAG_PROP, CLASS_IRI, XSD.boolean);
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);
      const props = getProps(fragment, CLASS_IRI);
      const propSchema = props.inStock as Record<string, unknown>;

      assert.equal(propSchema.type, 'boolean', 'xsd:boolean → type: boolean');
    });

    void it('produces format: "date-time" when range is xsd:dateTime', () => {
      const TS_PROP = `${CLASS_IRI}#publishedOn`;
      const quads = buildDatatypePropertyQuads(TS_PROP, CLASS_IRI, XSD.dateTime);
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);
      const props = getProps(fragment, CLASS_IRI);
      const propSchema = props.publishedOn as Record<string, unknown>;

      assert.equal(propSchema.type, 'string', 'xsd:dateTime → type: string');
      assert.equal(propSchema.format, 'date-time', 'xsd:dateTime → format: date-time');
    });

    void it('produces format: "date" when range is xsd:date', () => {
      const DATE_PROP = `${CLASS_IRI}#releaseDate`;
      const quads = buildDatatypePropertyQuads(DATE_PROP, CLASS_IRI, XSD.date);
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);
      const props = getProps(fragment, CLASS_IRI);
      const propSchema = props.releaseDate as Record<string, unknown>;

      assert.equal(propSchema.format, 'date', 'xsd:date → format: date');
    });

    void it('produces format: "uri" when range is xsd:anyURI', () => {
      const URL_PROP = `${CLASS_IRI}#homepage`;
      const quads = buildDatatypePropertyQuads(URL_PROP, CLASS_IRI, XSD.anyURI);
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);
      const props = getProps(fragment, CLASS_IRI);
      const propSchema = props.homepage as Record<string, unknown>;

      assert.equal(propSchema.type, 'string', 'xsd:anyURI → type: string');
      assert.equal(propSchema.format, 'uri', 'xsd:anyURI → format: uri');
    });
  });

  void describe('multi-domain: same property on two classes', () => {
    const CLASS_A = 'urn:example:ClassA';
    const CLASS_B = 'urn:example:ClassB';
    const PROP_IRI = 'urn:example:sharedProp#name';

    void it('adds the property slot to every domain class', () => {
      const quads: QuadInterface[] = [
        makeQuad(CLASS_A, RDF.type, OWL.Class),
        makeQuad(CLASS_B, RDF.type, OWL.Class),
        makeQuad(PROP_IRI, RDF.type, OWL.DatatypeProperty),
        makeQuad(PROP_IRI, RDFS.domain, CLASS_A),
        makeQuad(PROP_IRI, RDFS.domain, CLASS_B),
        makeQuad(PROP_IRI, RDFS.range, XSD.string)
      ];
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);

      const propsA = getProps(fragment, CLASS_A);
      const propsB = getProps(fragment, CLASS_B);

      assert.ok(propsA.name !== undefined, 'CLASS_A should have name property');
      assert.ok(propsB.name !== undefined, 'CLASS_B should have name property');

      assert.equal((propsA.name as Record<string, unknown>).type, 'string');
      assert.equal((propsB.name as Record<string, unknown>).type, 'string');
    });
  });

  void describe(RDFS.subPropertyOf, () => {
    void it('emits a characteristics entry for the sub-property relation', () => {
      const CLASS_IRI = 'urn:example:Vehicle';
      const PARENT_PROP = 'urn:example:Vehicle#speed';
      const CHILD_PROP = 'urn:example:Vehicle#topSpeed';

      const quads: QuadInterface[] = [
        makeQuad(CLASS_IRI, RDF.type, OWL.Class),
        makeQuad(PARENT_PROP, RDF.type, OWL.DatatypeProperty),
        makeQuad(PARENT_PROP, RDFS.domain, CLASS_IRI),
        makeQuad(PARENT_PROP, RDFS.range, XSD.decimal),
        makeQuad(CHILD_PROP, RDF.type, OWL.DatatypeProperty),
        makeQuad(CHILD_PROP, RDFS.domain, CLASS_IRI),
        makeQuad(CHILD_PROP, RDFS.range, XSD.decimal),
        makeQuad(CHILD_PROP, RDFS.subPropertyOf, PARENT_PROP)
      ];
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);

      const ch = fragment.characteristics.find((entry) => {
        return entry.propertyIri === CHILD_PROP;
      });

      assert.ok(ch !== undefined, 'characteristics entry for CHILD_PROP');
      assert.ok(
        ch.characteristic.includes('subPropertyOf'),
        `characteristic should mention subPropertyOf; got: ${ch.characteristic}`
      );
      assert.ok(
        ch.characteristic.includes(PARENT_PROP),
        `characteristic should include parent IRI; got: ${ch.characteristic}`
      );
    });
  });

  void describe(OWL.inverseOf, () => {
    void it('emits a characteristics entry and no structural delta', () => {
      const BOOK_IRI = 'urn:example:Book';
      const AUTHOR_IRI = 'urn:example:Author';
      const WROTE_PROP = `${AUTHOR_IRI}#wrote`;
      const WRITTEN_BY_PROP = `${BOOK_IRI}#writtenBy`;

      const quads: QuadInterface[] = [
        makeQuad(BOOK_IRI, RDF.type, OWL.Class),
        makeQuad(AUTHOR_IRI, RDF.type, OWL.Class),
        makeQuad(WROTE_PROP, RDF.type, OWL.ObjectProperty),
        makeQuad(WROTE_PROP, RDFS.domain, AUTHOR_IRI),
        makeQuad(WROTE_PROP, RDFS.range, BOOK_IRI),
        makeQuad(WRITTEN_BY_PROP, RDF.type, OWL.ObjectProperty),
        makeQuad(WRITTEN_BY_PROP, RDFS.domain, BOOK_IRI),
        makeQuad(WRITTEN_BY_PROP, RDFS.range, AUTHOR_IRI),
        makeQuad(WROTE_PROP, OWL.inverseOf, WRITTEN_BY_PROP)
      ];
      const ctx = makeCtx(quads);
      const fragment = Properties.dispatch(quads, ctx);

      const ch = fragment.characteristics.find((entry) => {
        return entry.propertyIri === WROTE_PROP && entry.characteristic.includes('inverseOf');
      });

      assert.ok(ch !== undefined, 'inverseOf characteristics entry should exist');
      assert.ok(
        ch.characteristic.includes(WRITTEN_BY_PROP),
        `characteristic should include target IRI; got: ${ch.characteristic}`
      );
    });
  });

  void describe('OwlProjection round-trip via OwlImporter', () => {
    const BASE = 'urn:bookstore';

    void it('round-trips object property with domain+range to a class IRI', () => {
      const CUSTOMER_IRI = `${BASE}:Customer`;
      const ORDER_IRI = `${BASE}:Order`;

      const orderSchema = {
        '$id': ORDER_IRI,
        'properties': { 'customer': { '$ref': CUSTOMER_IRI } },
        'type': 'object'
      } as const;

      const customerSchema = {
        '$id': CUSTOMER_IRI,
        'type': 'object'
      } as const;

      // Project both schemas into a combined set of quads.
      const orderQuads = OwlProjection.graph(new SchemaGraph(orderSchema));
      const customerQuads = OwlProjection.graph(new SchemaGraph(customerSchema));
      const allQuads = [
        ...orderQuads,
        ...customerQuads
      ];

      const importer = new OwlImporter({ 'baseIRI': BASE });
      const result = importer.import(allQuads);

      const orderResult = result.schemas.find((schema) => {
        return schema.$id === ORDER_IRI;
      });

      assert.ok(orderResult !== undefined, 'Order schema should be in result');
      const orderProps = (orderResult.properties ?? {}) as Record<string, unknown>;
      const customerProp = orderProps.customer as Record<string, unknown> | undefined;

      assert.ok(customerProp !== undefined, 'customer property should be in Order schema');
      assert.equal(customerProp.$ref, CUSTOMER_IRI, 'customer.$ref should point to Customer');
    });

    void it('round-trips datatype property with xsd:string range', () => {
      const BOOK_IRI = `${BASE}:Book`;

      const bookSchema = {
        '$id': BOOK_IRI,
        'properties': { 'title': { 'type': 'string' } },
        'type': 'object'
      } as const;

      const quads = OwlProjection.graph(new SchemaGraph(bookSchema));
      const importer = new OwlImporter({ 'baseIRI': BASE });
      const result = importer.import(quads);

      const bookResult = result.schemas.find((schema) => {
        return schema.$id === BOOK_IRI;
      });

      assert.ok(bookResult !== undefined, 'Book schema should be in result');
      const bookProps = (bookResult.properties ?? {}) as Record<string, unknown>;
      const titleProp = bookProps.title as Record<string, unknown> | undefined;

      assert.ok(titleProp !== undefined, 'title property should be in Book schema');
      assert.equal(titleProp.type, 'string', 'title should be type: string');
    });

    void it('round-trips boolean property (xsd:boolean)', () => {
      const BOOK_IRI = `${BASE}:BookBool`;

      const bookSchema = {
        '$id': BOOK_IRI,
        'properties': { 'inStock': { 'type': 'boolean' } },
        'type': 'object'
      } as const;

      const quads = OwlProjection.graph(new SchemaGraph(bookSchema));
      const importer = new OwlImporter({ 'baseIRI': BASE });
      const result = importer.import(quads);

      const bookResult = result.schemas.find((schema) => {
        return schema.$id === BOOK_IRI;
      });

      assert.ok(bookResult !== undefined, 'Book schema should be in result');
      const boolBookProps = (bookResult.properties ?? {}) as Record<string, unknown>;
      const inStockProp = boolBookProps.inStock as Record<string, unknown> | undefined;

      assert.ok(inStockProp !== undefined, 'inStock property should be in Book schema');
      assert.equal(inStockProp.type, 'boolean', 'inStock should be type: boolean');
    });

    void it('round-trips multiple properties on the same class', () => {
      const CUSTOMER_IRI = `${BASE}:Customer2`;
      const EMAIL_IRI = `${BASE}:Email`;

      const customerSchema = {
        '$id': CUSTOMER_IRI,
        'properties': {
          'age': { 'type': 'integer' },
          'email': { '$ref': EMAIL_IRI },
          'name': { 'type': 'string' }
        },
        'type': 'object'
      } as const;

      const emailSchema = {
        '$id': EMAIL_IRI,
        'type': 'string'
      } as const;

      const customerQuads = OwlProjection.graph(new SchemaGraph(customerSchema));
      const emailQuads = OwlProjection.graph(new SchemaGraph(emailSchema));
      const allQuads = [
        ...customerQuads,
        ...emailQuads
      ];

      const importer = new OwlImporter({ 'baseIRI': BASE });
      const result = importer.import(allQuads);

      const customerResult = result.schemas.find((schema) => {
        return schema.$id === CUSTOMER_IRI;
      });

      assert.ok(customerResult !== undefined, 'Customer schema should be in result');
      const customerProps = (customerResult.properties ?? {}) as Record<string, unknown>;
      const nameProp = customerProps.name as Record<string, unknown>;
      const ageProp = customerProps.age as Record<string, unknown>;
      const emailProp = customerProps.email as Record<string, unknown>;

      assert.equal(nameProp.type, 'string', 'name: string');
      assert.equal(ageProp.type, 'integer', 'age: integer');
      assert.equal(emailProp.$ref, EMAIL_IRI, 'email: $ref Email');
    });
  });
});
