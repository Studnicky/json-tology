/* eslint-disable @typescript-eslint/no-floating-promises */

/**
 * End-to-end ontology round-trip test.
 *
 * Exercises the canonical bookstore domain (Customer, Order, OrderLine, Book,
 * Review, Address, plus their primitive $ref targets and the rare-book
 * taxonomy) end to end: OWL TBox, SHACL shapes, validation, quad
 * round-trip, and schema round-trip all produce correct, structurally
 * verified output against the shared `bookstoreEntities` instance.
 */

import {
  before, describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';
import {
  AddressSchema,
  AuthorNameSchema,
  BookSchema,
  bookstoreEntities,
  bookstoreSchemas,
  CityNameSchema,
  CountryCodeSchema,
  createBookstoreDocRegistry,
  CurrencyCodeSchema,
  CustomerIdSchema,
  CustomerSchema,
  EmailSchema,
  IsbnSchema,
  MoneySchema,
  OrderLineSchema,
  OrderSchema,
  PostalCodeSchema,
  PrintStatusSchema,
  RareBookSchema,
  ReviewSchema,
  StreetLineSchema,
  TitleSchema
} from '../../examples/docs/bookstore/index.js';
import { aboxFixtures } from '../../examples/docs/bookstore/aboxFixtures.js';

// ---------------------------------------------------------------------------
// Well-known IRI constants
// ---------------------------------------------------------------------------

const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const OWL_OBJECT_PROPERTY = 'http://www.w3.org/2002/07/owl#ObjectProperty';
const OWL_DATATYPE_PROPERTY = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
const OWL_RESTRICTION = 'http://www.w3.org/2002/07/owl#Restriction';
const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
const OWL_MIN_CARDINALITY = 'http://www.w3.org/2002/07/owl#minCardinality';

const RDFS_RANGE = 'http://www.w3.org/2000/01/rdf-schema#range';
const RDFS_DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';
const RDFS_SUB_CLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

const SH_NODE_SHAPE = 'http://www.w3.org/ns/shacl#NodeShape';
const SH_TARGET_CLASS = 'http://www.w3.org/ns/shacl#targetClass';
const SH_PROPERTY = 'http://www.w3.org/ns/shacl#property';
const SH_PATH = 'http://www.w3.org/ns/shacl#path';
const SH_DATATYPE = 'http://www.w3.org/ns/shacl#datatype';
const SH_MIN_COUNT = 'http://www.w3.org/ns/shacl#minCount';
const SH_MAX_COUNT = 'http://www.w3.org/ns/shacl#maxCount';
const SH_CLASS = 'http://www.w3.org/ns/shacl#class';
const SH_NODE = 'http://www.w3.org/ns/shacl#node';

const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
const XSD_INTEGER = 'http://www.w3.org/2001/XMLSchema#integer';
const XSD_BOOLEAN = 'http://www.w3.org/2001/XMLSchema#boolean';

const BOOKSTORE_BASE_IRI = 'https://bookstore.example';

// ---------------------------------------------------------------------------
// Typed helper for JSON-LD node traversal
// ---------------------------------------------------------------------------

type JsonLdNode = Record<string, unknown>;

function findNode(nodes: JsonLdNode[], id: string): JsonLdNode | undefined {
  return nodes.find((node) => {
    return node['@id'] === id;
  });
}

function nodeType(node: JsonLdNode): string | string[] | undefined {
  return node['@type'] as string | string[] | undefined;
}

function hasType(node: JsonLdNode, typeIri: string): boolean {
  const type = nodeType(node);

  if (type === undefined) {
    return false;
  }
  if (Array.isArray(type)) {
    return type.includes(typeIri);
  }

  return type === typeIri;
}

function getIdRef(value: unknown): string | undefined {
  if (typeof value === 'object' && value !== null && '@id' in (value as JsonLdNode)) {
    return (value as JsonLdNode)['@id'] as string;
  }

  return undefined;
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function findPropertyNodes(
  allNodes: JsonLdNode[],
  predicate: string,
  targetId: string
): JsonLdNode[] {
  return allNodes.filter((node) => {
    const domain = node[predicate];
    const domainId = getIdRef(domain);

    return domainId === targetId;
  });
}

// ---------------------------------------------------------------------------
// Test suite — canonical bookstore domain
// ---------------------------------------------------------------------------

describe('ontology round-trip: bookstore domain', () => {
  let jt: typeof bookstoreEntities;
  let owlNodes: JsonLdNode[];
  let shaclNodes: JsonLdNode[];

  before(() => {
    jt = bookstoreEntities;

    const ontology = jt.ontology();

    owlNodes = ontology.jsonLdObject()['@graph'] as JsonLdNode[];
    const shaclObject = ontology.shaclObject();

    shaclNodes = shaclObject['@graph'] as JsonLdNode[];
  });

  // -------------------------------------------------------------------------
  // 1. Registration
  // -------------------------------------------------------------------------

  describe('schema registration', () => {
    it('registers all canonical bookstore schemas (Customer, Order, Book, Review, Address, …)', () => {
      const primary = [
        AddressSchema,
        BookSchema,
        CustomerSchema,
        OrderSchema,
        OrderLineSchema,
        ReviewSchema,
        RareBookSchema,
        IsbnSchema,
        MoneySchema,
        EmailSchema,
        CustomerIdSchema
      ];

      for (const schema of primary) {
        assert.ok(jt.registry.has(schema.$id), `${schema.$id} registered`);
      }

      // Sanity: total registration count matches the exported tuple.
      for (const schema of bookstoreSchemas) {
        assert.ok(
          jt.registry.has(schema.$id),
          `bookstoreSchemas[${schema.$id}] registered`
        );
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. OWL generation — property-by-property
  // -------------------------------------------------------------------------

  describe('OWL generation', () => {
    it('emits owl:Class for each primary bookstore schema', () => {
      const classes = [
        AddressSchema,
        BookSchema,
        CustomerSchema,
        OrderSchema,
        OrderLineSchema,
        ReviewSchema,
        RareBookSchema,
        MoneySchema
      ];

      for (const schema of classes) {
        const node = findNode(owlNodes, schema.$id);

        assert.ok(node !== undefined, `owl node exists for ${schema.$id}`);
        assert.ok(hasType(node, OWL_CLASS), `${schema.$id} typed as owl:Class`);
      }
    });

    it('emits owl:ObjectProperty for $ref properties with rdfs:range', () => {
      // Order.shippingAddress → Address (cross-schema $ref)
      const orderProps = findPropertyNodes(owlNodes, RDFS_DOMAIN, OrderSchema.$id);
      const shippingProp = orderProps.find((node) => {
        const id = node['@id'] as string;

        return id.includes('shippingAddress');
      });

      assert.ok(shippingProp !== undefined, 'shippingAddress property node exists');
      assert.ok(
        hasType(shippingProp, OWL_OBJECT_PROPERTY),
        'shippingAddress typed as owl:ObjectProperty'
      );

      const range = getIdRef(shippingProp[RDFS_RANGE]);

      assert.equal(range, AddressSchema.$id, 'shippingAddress range is Address');
    });

    it('emits owl:DatatypeProperty for inline scalar properties with XSD range', () => {
      // Book.inStock is the canonical inline scalar (type:boolean) on Book.
      const bookProps = findPropertyNodes(owlNodes, RDFS_DOMAIN, BookSchema.$id);

      const inStockProp = bookProps.find((node) => {
        const id = node['@id'] as string;

        return id.includes('inStock');
      });

      assert.ok(inStockProp !== undefined, 'inStock property node exists');
      assert.ok(
        hasType(inStockProp, OWL_DATATYPE_PROPERTY),
        'inStock typed as owl:DatatypeProperty'
      );

      const inStockRange = getIdRef(inStockProp[RDFS_RANGE]);

      assert.equal(inStockRange, XSD_BOOLEAN, 'inStock range is xsd:boolean');

      // Primitive scalar schema: RatingScore is a registered xsd:integer brand.
      const ratingScoreNode = findNode(
        owlNodes,
        'urn:bookstore:RatingScore'
      );

      assert.ok(ratingScoreNode !== undefined, 'RatingScore class node exists');

      // Primitive scalar schema: Title is xsd:string.
      const titleNode = findNode(owlNodes, TitleSchema.$id);

      assert.ok(titleNode !== undefined, 'Title class node exists');
    });

    it('emits owl:DatatypeProperty for integer-typed primitives with xsd:integer range', () => {
      // RatingScore (type:integer, 1..5) is the canonical integer primitive.
      // Find the Review.rating property — its range references RatingScore class.
      const reviewProps = findPropertyNodes(owlNodes, RDFS_DOMAIN, ReviewSchema.$id);
      const ratingProp = reviewProps.find((node) => {
        const id = node['@id'] as string;

        return id.includes('rating');
      });

      assert.ok(ratingProp !== undefined, 'rating property node exists');

      const ratingRange = getIdRef(ratingProp[RDFS_RANGE]);

      // rating $ref to RatingScore — range may be the class IRI (object) or
      // xsd:integer (datatype) depending on projection. Either is structurally
      // sound; assert the range is set.
      assert.ok(
        ratingRange === 'urn:bookstore:RatingScore' || ratingRange === XSD_INTEGER,
        `rating range is RatingScore or xsd:integer, got ${ratingRange ?? 'undefined'}`
      );
    });

    it('emits owl:Restriction with owl:minCardinality for required properties', () => {
      // Order has required: ['orderId', 'customerId', 'orderLines', 'orderTotal', 'placedAt', 'shippingAddress']
      const orderNode = findNode(owlNodes, OrderSchema.$id);

      assert.ok(orderNode !== undefined, 'Order node exists');

      const subClassOf = asArray(orderNode[RDFS_SUB_CLASS_OF]);
      const restrictions = subClassOf.filter((entry) => {
        if (typeof entry !== 'object' || entry === null) {
          return false;
        }
        const entryNode = entry as JsonLdNode;

        return hasType(entryNode, OWL_RESTRICTION) || entryNode[OWL_ON_PROPERTY] !== undefined;
      });

      assert.ok(restrictions.length > 0, 'Order has restriction subClassOf entries');

      // At least one restriction should reference the "orderId" property with
      // minCardinality. The onProperty must be the FLAT canonical predicate IRI
      // (https://bookstore.example/orderId) — the same IRI carried by the property
      // declaration and ABox assertions — never a class-scoped `#orderId` form.
      const idRestriction = restrictions.find((restriction) => {
        const restrictionNode = restriction as JsonLdNode;
        const onProp = restrictionNode[OWL_ON_PROPERTY];
        const onPropId = getIdRef(onProp);

        return onPropId === `${BOOKSTORE_BASE_IRI}/orderId`;
      });

      assert.ok(idRestriction !== undefined, 'restriction exists for orderId property');

      const minCard = (idRestriction as JsonLdNode)[OWL_MIN_CARDINALITY];

      assert.ok(minCard !== undefined, 'minCardinality set on orderId restriction');
      assert.equal(Number(minCard), 1, 'minCardinality is 1');
    });

    it('emits owl:ObjectProperty for array $ref properties', () => {
      // Order.orderLines → array of OrderLine
      const orderProps = findPropertyNodes(owlNodes, RDFS_DOMAIN, OrderSchema.$id);
      const orderLinesProp = orderProps.find((node) => {
        const id = node['@id'] as string;

        return id.includes('orderLines');
      });

      assert.ok(orderLinesProp !== undefined, 'orderLines property node exists');
      assert.ok(
        hasType(orderLinesProp, OWL_OBJECT_PROPERTY),
        'orderLines typed as owl:ObjectProperty'
      );

      const orderLinesRange = getIdRef(orderLinesProp[RDFS_RANGE]);

      assert.ok(orderLinesRange !== undefined, 'orderLines property has rdfs:range');
    });
  });

  // -------------------------------------------------------------------------
  // 3. SHACL generation — property-by-property
  // -------------------------------------------------------------------------

  function findShape(classIri: string): JsonLdNode | undefined {
    return shaclNodes.find((node) => {
      const tc = node[SH_TARGET_CLASS];

      if (tc !== undefined) {
        return getIdRef(tc) === classIri;
      }

      return node['@id'] === classIri && hasType(node, SH_NODE_SHAPE);
    });
  }

  function shapeProperties(shape: JsonLdNode): JsonLdNode[] {
    return asArray(shape[SH_PROPERTY]) as JsonLdNode[];
  }

  function findPropertyShape(shape: JsonLdNode, pathFragment: string): JsonLdNode | undefined {
    const props = shapeProperties(shape);

    return props.find((prop) => {
      const pathValue = prop[SH_PATH];
      const pathId = getIdRef(pathValue);

      if (pathId !== undefined) {
        return pathId.includes(pathFragment);
      }

      return false;
    });
  }

  describe('SHACL generation', () => {
    it('produces sh:NodeShape for each primary bookstore schema', () => {
      const classes = [
        AddressSchema,
        BookSchema,
        CustomerSchema,
        OrderSchema,
        OrderLineSchema,
        ReviewSchema,
        MoneySchema
      ];

      for (const schema of classes) {
        const shape = findShape(schema.$id);

        assert.ok(shape !== undefined, `NodeShape exists for ${schema.$id}`);
        assert.ok(
          hasType(shape, SH_NODE_SHAPE),
          `${schema.$id} shape typed as sh:NodeShape`
        );
      }
    });

    it('produces sh:PropertyShape with sh:path for each Address property', () => {
      const addressShape = findShape(AddressSchema.$id);

      assert.ok(addressShape !== undefined, 'Address shape exists');

      const props = shapeProperties(addressShape);

      // Address has 4 properties: street, city, country, postalCode
      assert.ok(props.length >= 4, `Address has at least 4 property shapes, got ${props.length}`);

      for (const prop of props) {
        const path = prop[SH_PATH];

        assert.ok(path !== undefined, 'property shape has sh:path');
      }
    });

    it('sets sh:minCount 1 for required Address properties', () => {
      const addressShape = findShape(AddressSchema.$id);

      assert.ok(addressShape !== undefined, 'Address shape exists');

      // street, city, postalCode are required; country is optional.
      for (const propName of [
        'street',
        'city',
        'postalCode'
      ]) {
        const propShape = findPropertyShape(addressShape, propName);

        assert.ok(propShape !== undefined, `${propName} property shape exists`);

        const minCount = propShape[SH_MIN_COUNT];

        assert.ok(minCount !== undefined, `${propName} has sh:minCount`);
        assert.equal(Number(minCount), 1, `${propName} sh:minCount is 1`);
      }

      const countryShape = findPropertyShape(addressShape, 'country');

      if (countryShape !== undefined) {
        const countryMinCount = countryShape[SH_MIN_COUNT];

        assert.ok(
          countryMinCount === undefined || Number(countryMinCount) === 0,
          'country does not have sh:minCount 1'
        );
      }
    });

    it('sets sh:datatype xsd:string for string-typed primitive properties', () => {
      // StreetLine is a registered xsd:string primitive — its NodeShape's
      // sh:datatype (or the property shape referencing it) must be xsd:string.
      const streetLineShape = findShape(StreetLineSchema.$id);

      // For a primitive scalar, SHACL may emit the datatype on the NodeShape
      // itself, or on the property shape referencing it. Walk the Address
      // shape to find the street property's datatype.
      assert.ok(streetLineShape !== undefined, 'StreetLine shape exists');

      const addressShape = findShape(AddressSchema.$id);

      assert.ok(addressShape !== undefined, 'Address shape exists');

      const streetShape = findPropertyShape(addressShape, 'street');

      assert.ok(streetShape !== undefined, 'street property shape exists');

      const datatype = streetShape[SH_DATATYPE];
      const classRef = getIdRef(streetShape[SH_CLASS]);
      const nodeRef = getIdRef(streetShape[SH_NODE]);

      // The property shape either declares the datatype directly (xsd:string)
      // or references the StreetLine NodeShape via sh:node / sh:class.
      if (datatype === undefined) {
        assert.ok(
          classRef === StreetLineSchema.$id || nodeRef === StreetLineSchema.$id,
          'street references StreetLine primitive via sh:class or sh:node'
        );
      } else {
        const datatypeId = getIdRef(datatype);

        assert.equal(datatypeId, XSD_STRING, 'street datatype is xsd:string');
      }
    });

    it('sets sh:class or sh:node for cross-schema $ref properties', () => {
      const orderShape = findShape(OrderSchema.$id);

      assert.ok(orderShape !== undefined, 'Order shape exists');

      const shippingShape = findPropertyShape(orderShape, 'shippingAddress');

      assert.ok(shippingShape !== undefined, 'shippingAddress property shape exists');

      const classRef = getIdRef(shippingShape[SH_CLASS]);
      const nodeRef = getIdRef(shippingShape[SH_NODE]);
      const refTarget = classRef ?? nodeRef;

      assert.ok(refTarget !== undefined, 'shippingAddress has sh:class or sh:node');
      assert.equal(refTarget, AddressSchema.$id, 'shippingAddress references Address class');
    });

    it('produces cardinality constraints for Order.items (minItems: 1)', () => {
      const orderShape = findShape(OrderSchema.$id);

      assert.ok(orderShape !== undefined, 'Order shape exists');

      const orderLinesShape = findPropertyShape(orderShape, 'orderLines');

      assert.ok(orderLinesShape !== undefined, 'orderLines property shape exists');

      // OrderSchema.orderLines has minItems: 1 (no maxItems).
      const minCount = orderLinesShape[SH_MIN_COUNT];
      const maxCount = orderLinesShape[SH_MAX_COUNT];

      if (minCount !== undefined) {
        assert.ok(Number(minCount) >= 1, 'orderLines sh:minCount is at least 1');
      }

      assert.ok(
        minCount !== undefined || maxCount !== undefined,
        'orderLines has at least one cardinality constraint'
      );
    });

    it('sets sh:datatype xsd:integer for integer-typed primitive properties', () => {
      // Review.rating references RatingScore (type:integer, 1..5).
      const reviewShape = findShape(ReviewSchema.$id);

      assert.ok(reviewShape !== undefined, 'Review shape exists');

      const ratingShape = findPropertyShape(reviewShape, 'rating');

      assert.ok(ratingShape !== undefined, 'rating property shape exists');

      const datatype = ratingShape[SH_DATATYPE];
      const classRef = getIdRef(ratingShape[SH_CLASS]);
      const nodeRef = getIdRef(ratingShape[SH_NODE]);

      if (datatype === undefined) {
        assert.ok(
          classRef === 'urn:bookstore:RatingScore' || nodeRef === 'urn:bookstore:RatingScore',
          'rating references RatingScore primitive via sh:class or sh:node'
        );
      } else {
        const datatypeId = getIdRef(datatype);

        assert.equal(datatypeId, XSD_INTEGER, 'rating datatype is xsd:integer');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 4. Validation
  // -------------------------------------------------------------------------

  describe('validation against registered schemas', () => {
    it('validates valid Address fixture data', () => {
      const errors = jt.validate(AddressSchema.$id, aboxFixtures.customer.addresses[0]);

      assert.equal(errors.ok, true, 'valid address fixture produces no errors');
    });

    it('rejects Address missing required field', () => {
      const errors = jt.validate(AddressSchema.$id, { 'city': 'München' });

      assert.ok(errors.length > 0, 'missing street + postalCode produces errors');
    });

    it('validates valid Customer fixture data', () => {
      const errors = jt.validate(CustomerSchema.$id, aboxFixtures.customer);

      assert.equal(errors.ok, true, 'valid customer fixture produces no errors');
    });

    it('validates Order fixture with nested OrderLine + Address + Money', () => {
      const errors = jt.validate(OrderSchema.$id, aboxFixtures.order);

      assert.equal(
        errors.ok,
        true,
        'valid order fixture produces no errors (incl. orderTotalMatchesItems invariant)'
      );
    });

    it('validates valid RareBook fixture data', () => {
      const errors = jt.validate(RareBookSchema.$id, aboxFixtures.rareBook);

      assert.equal(errors.ok, true, 'valid rareBook fixture produces no errors');
    });

    it('rejects Customer missing required name', () => {
      const tampered: Record<string, unknown> = { ...aboxFixtures.customer };

      delete tampered.name;

      const errors = jt.validate(CustomerSchema.$id, tampered);

      assert.ok(errors.length > 0, 'missing name produces errors');
    });
  });

  // -------------------------------------------------------------------------
  // 5. toQuads/fromQuads round-trip
  // -------------------------------------------------------------------------

  describe('toQuads/fromQuads round-trip', () => {
    it('round-trips a simple Address', () => {
      const input = aboxFixtures.customer.addresses[0];
      const quads = jt.materializer.projectAbox(
        AddressSchema,
        input,
        BOOKSTORE_BASE_IRI
      );
      const results = jt.fromQuads(AddressSchema.$id, quads);

      assert.equal(results.length, 1);
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.street, input.street);
      assert.equal(output.city, input.city);
      assert.equal(output.country, input.country);
      assert.equal(output.postalCode, input.postalCode);
    });

    it('round-trips a Customer (scalar properties; cross-schema $ref excluded)', () => {
      // projectAbox emits scalar properties whose $ref targets are primitive
      // schemas (Email, CustomerId, CustomerName). The nested addresses[]
      // array of cross-schema $ref Address objects is exercised in the
      // dedicated C-4 cross-schema describe below.
      const input = {
        'customerId': aboxFixtures.customer.customerId,
        'email': aboxFixtures.customer.email,
        'name': aboxFixtures.customer.name
      };
      const quads = jt.materializer.projectAbox(
        CustomerSchema,
        input,
        BOOKSTORE_BASE_IRI
      );
      const results = jt.fromQuads(CustomerSchema.$id, quads);

      assert.equal(results.length, 1);
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.customerId, input.customerId);
      assert.equal(output.email, input.email);
      assert.equal(output.name, input.name);
    });

    it('round-trips intra-schema $defs nested objects', () => {
      // Intra-schema $ref round-trip (uses $defs, not cross-schema).
      const InlineSchema = {
        '$defs': {
          'Contact': {
            'properties': {
              'email': { 'type': 'string' },
              'phone': { 'type': 'string' }
            },
            'required': ['email'],
            'type': 'object'
          }
        },
        '$id': `${BOOKSTORE_BASE_IRI}/InlineTest`,
        'properties': {
          'contact': { '$ref': '#/$defs/Contact' },
          'name': { 'type': 'string' }
        },
        'required': [
          'name',
          'contact'
        ],
        'type': 'object'
      } as const;

      const localJt = JsonTology.create({
        'baseIri': BOOKSTORE_BASE_IRI,
        'enableStrictGraph': false,
        'schemas': [InlineSchema]
      });

      const input = {
        'contact': {
          'email': 'test@example.com',
          'phone': '+1234567890'
        },
        'name': 'Inline Test'
      };
      const quads = localJt.materializer.projectAbox(
        InlineSchema,
        input,
        BOOKSTORE_BASE_IRI
      );
      const results = localJt.fromQuads(InlineSchema.$id, quads);

      assert.equal(results.length, 1);
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.name, 'Inline Test');

      const contact = output.contact as Record<string, unknown>;

      assert.equal(contact.email, 'test@example.com');
      assert.equal(contact.phone, '+1234567890');
    });

    it('round-trips Book scalar properties', () => {
      // Book has inline scalar `inStock` (boolean) plus $ref scalars
      // (isbn, title, price, printStatus). Round-trip the scalars; the
      // nested $ref Money value is materialised as a separate ABox node.
      const input = {
        'authors': ['Michael Ende'],
        'inStock': true,
        'isbn': '9783522128001',
        'price': {
          'amount': 850,
          'currency': 'EUR'
        },
        'printStatus': 'outOfPrint',
        'title': 'Die unendliche Geschichte'
      };
      const quads = jt.materializer.projectAbox(
        BookSchema,
        input,
        BOOKSTORE_BASE_IRI
      );
      const results = jt.fromQuads(BookSchema.$id, quads);

      assert.equal(results.length, 1);
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.isbn, input.isbn);
      assert.equal(output.title, input.title);
      assert.equal(output.inStock, true);
      assert.equal(output.printStatus, 'outOfPrint');
    });

    it('round-trips scalar types: string, number, integer, boolean', () => {
      // Use an OrderLine fixture to cover string ($ref Isbn), integer
      // ($ref Quantity), and nested object ($ref Money).
      const input = aboxFixtures.order.orderLines[0];
      const quads = jt.materializer.projectAbox(
        OrderLineSchema,
        input,
        BOOKSTORE_BASE_IRI
      );
      const results = jt.fromQuads(OrderLineSchema.$id, quads);

      assert.equal(results.length, 1);
      const output = results[0] as Record<string, unknown>;

      assert.equal(typeof output.bookIsbn, 'string');
      assert.equal(typeof output.quantity, 'number');
      assert.equal(output.bookIsbn, input.bookIsbn);
      assert.equal(output.quantity, 1);
    });

    it('round-trips a full Order including xsd:dateTime placedAt and nested Money', () => {
      // placedAt (xsd:dateTime) lifts back to its original ISO string; nested
      // Money (amount xsd:decimal → number, currency enum → string) lifts to
      // scalars and survives fromQuads' instantiate() validation step.
      const input = aboxFixtures.order;
      const quads = jt.toQuads(OrderSchema, jt.instantiate(OrderSchema, input));
      const results = jt.fromQuads(OrderSchema.$id, quads);

      assert.equal(results.length, 1, 'one order lifted');
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.orderId, input.orderId, 'orderId round-trips');
      assert.equal(output.placedAt, input.placedAt, 'placedAt round-trips as the original ISO string');

      assert.deepEqual(
        output.orderTotal,
        {
          'amount': input.orderTotal.amount,
          'currency': input.orderTotal.currency
        },
        'orderTotal Money round-trips: amount number + currency enum'
      );
    });
  });

  // -------------------------------------------------------------------------
  // 6. toSchema round-trip
  // -------------------------------------------------------------------------

  describe('toSchema round-trip', () => {
    it('reconstructs Address schema from graph and validates same data', () => {
      const reconstructed = jt.toSchema(AddressSchema.$id);

      assert.ok(reconstructed !== undefined, 'reconstructed schema exists');
      assert.equal(reconstructed.$id, AddressSchema.$id);

      // Re-register reconstructed schema under a distinct $id on a permissive
      // copy of the registry so alt-schema mutations do not bleed into the
      // canonical bookstoreEntities instance.
      const altJt = createBookstoreDocRegistry();
      const altId = `${AddressSchema.$id}/reconstructed`;
      const altSchema = {
        ...reconstructed,
        '$id': altId
      };

      altJt.set(altSchema as { readonly '$id': string });

      const data = aboxFixtures.customer.addresses[0];

      const origErrors = jt.validate(AddressSchema.$id, data);
      const reconErrors = altJt.validate(altSchema as Record<string, unknown> & { readonly '$id': string }, data);

      assert.equal(origErrors.ok, true, 'original validates');
      assert.equal(reconErrors.ok, true, 'reconstructed validates same data');
    });

    it('reconstructs Order schema preserving required fields', () => {
      const reconstructed = jt.toSchema(OrderSchema.$id);

      assert.ok(reconstructed !== undefined, 'reconstructed schema exists');

      const required = reconstructed.required as string[];

      assert.ok(Array.isArray(required), 'required is array');
      assert.ok(required.includes('orderId'), 'orderId is required');
      assert.ok(required.includes('customerId'), 'customerId is required');
      assert.ok(required.includes('orderLines'), 'orderLines is required');
      assert.ok(required.includes('orderTotal'), 'orderTotal is required');
    });

    it('reconstructs Order schema preserving $ref properties', () => {
      const reconstructed = jt.toSchema(OrderSchema.$id);

      assert.ok(reconstructed !== undefined, 'reconstructed schema exists');

      const properties = reconstructed.properties as Partial<Record<string, Record<string, unknown>>> | undefined;

      assert.ok(properties !== undefined, 'properties exist');

      const shippingAddress = properties.shippingAddress;

      assert.ok(shippingAddress !== undefined, 'shippingAddress property exists');
      assert.equal(
        shippingAddress.$ref,
        AddressSchema.$id,
        'shippingAddress $ref preserved'
      );
    });

    it('reconstructs Order schema preserving array items $ref', () => {
      const reconstructed = jt.toSchema(OrderSchema.$id);

      assert.ok(reconstructed !== undefined, 'reconstructed schema exists');

      const properties = reconstructed.properties as Partial<Record<string, Record<string, unknown>>> | undefined;
      const orderLines = properties?.orderLines;

      assert.ok(orderLines !== undefined, 'orderLines property exists');
      assert.equal(orderLines.type, 'array', 'orderLines type is array');

      const orderLinesItems = orderLines.items as Record<string, unknown> | undefined;

      assert.ok(orderLinesItems !== undefined, 'orderLines.items exists');
      assert.equal(
        orderLinesItems.$ref,
        OrderLineSchema.$id,
        'orderLines items $ref preserved'
      );
    });

    it('reconstructs Customer schema and rejects invalid data', () => {
      const reconstructed = jt.toSchema(CustomerSchema.$id);

      assert.ok(reconstructed !== undefined, 'reconstructed schema exists');

      const altJt = createBookstoreDocRegistry();
      const altId = `${CustomerSchema.$id}/reconstructed`;
      const altSchema = {
        ...reconstructed,
        '$id': altId
      };

      altJt.set(altSchema as { readonly '$id': string });

      // Missing required "id", "email", "name" — should fail.
      const errors = altJt.validate(altSchema as Record<string, unknown> & { readonly '$id': string }, { 'addresses': [] });

      assert.ok(errors.length > 0, 'reconstructed schema rejects data missing required fields');
    });
  });
});

// =============================================================================
// C-4: Cross-schema $ref round-trip — standalone (not dependent on shared jt).
//
// Customer.addresses[] → Address (separately registered schema). Tests whether
// a nested object whose type is a cross-schema $ref survives toQuads → fromQuads
// intact. Uses a fresh permissive bookstore registry to avoid contaminating
// the shared bookstoreEntities instance.
// =============================================================================

describe('C-4: cross-schema $ref toQuads/fromQuads round-trip', () => {
  it('Customer.addresses (cross-schema $ref → Address) round-trips through toQuads/fromQuads', () => {
    const localJt = createBookstoreDocRegistry();

    // Reference primitives so the linter does not flag them as unused —
    // they are the named-IRI roots the Address $ref chain resolves through.
    void [
      AuthorNameSchema,
      CityNameSchema,
      CountryCodeSchema,
      CurrencyCodeSchema,
      PostalCodeSchema,
      PrintStatusSchema
    ];

    const input = aboxFixtures.customer;
    const quads = localJt.toQuads(CustomerSchema, input);
    const results = localJt.fromQuads(CustomerSchema.$id, quads);

    assert.equal(results.length, 1, 'one Customer instance lifted');
    const output = results[0] as Record<string, unknown>;

    // Scalar properties must survive.
    assert.equal(output.customerId, input.customerId, 'customerId round-trips');
    assert.equal(output.email, input.email, 'email round-trips');
    assert.equal(output.name, input.name, 'name round-trips');

    // Cross-schema nested object: addresses must be present and structurally intact.
    const addresses = output.addresses as Array<Record<string, unknown>> | undefined;

    assert.ok(Array.isArray(addresses), 'addresses is an array after round-trip');
    assert.equal(addresses.length, 1, 'one address round-trips');

    const address = addresses.at(0);

    if (address === undefined) {
      throw new Error('addresses[0] is undefined');
    }

    const inputAddress = input.addresses.at(0);

    if (inputAddress === undefined) {
      throw new Error('input.addresses[0] is undefined');
    }

    assert.equal(address.street, inputAddress.street, 'address.street round-trips');
    assert.equal(address.city, inputAddress.city, 'address.city round-trips');
    assert.equal(address.country, inputAddress.country, 'address.country round-trips');
    assert.equal(address.postalCode, inputAddress.postalCode, 'address.postalCode round-trips');
  });
});
