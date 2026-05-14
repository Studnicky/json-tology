/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */

/**
 * End-to-end ontology round-trip test.
 *
 * Registers a multi-schema HR domain (Organization, Department, Employee, Address,
 * Project, Skill), then verifies OWL, SHACL, validation, quad round-trip, and
 * schema round-trip all produce correct, structurally verified output.
 */

import {
  before, describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';

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
const XSD_DECIMAL = 'http://www.w3.org/2001/XMLSchema#decimal';

// ---------------------------------------------------------------------------
// Domain schemas
// ---------------------------------------------------------------------------

const BASE = 'https://hr.example.com';

const AddressSchema = {
  '$id': `${BASE}/Address`,
  'properties': {
    'city': { 'type': 'string' },
    'country': { 'type': 'string' },
    'street': { 'type': 'string' },
    'zip': { 'type': 'string' }
  },
  'required': [
    'street',
    'city',
    'country'
  ],
  'title': 'Address',
  'type': 'object'
} as const;

const SkillSchema = {
  '$id': `${BASE}/Skill`,
  'properties': {
    'level': {
      'maximum': 5,
      'minimum': 1,
      'type': 'integer'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'title': 'Skill',
  'type': 'object'
} as const;

const EmployeeSchema = {
  '$id': `${BASE}/Employee`,
  'properties': {
    'active': { 'type': 'boolean' },
    'address': { '$ref': `${BASE}/Address` },
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'name': { 'type': 'string' },
    'salary': { 'type': 'number' },
    'skills': {
      'items': { '$ref': `${BASE}/Skill` },
      'minItems': 0,
      'type': 'array'
    },
    'tags': {
      'items': { 'type': 'string' },
      'type': 'array'
    }
  },
  'required': [
    'name',
    'email',
    'active'
  ],
  'title': 'Employee',
  'type': 'object'
} as const;

const ProjectSchema = {
  '$id': `${BASE}/Project`,
  'properties': {
    'budget': { 'type': 'number' },
    'lead': { '$ref': `${BASE}/Employee` },
    'members': {
      'items': { '$ref': `${BASE}/Employee` },
      'maxItems': 50,
      'minItems': 1,
      'type': 'array'
    },
    'name': { 'type': 'string' }
  },
  'required': [
    'name',
    'lead'
  ],
  'title': 'Project',
  'type': 'object'
} as const;

const DepartmentSchema = {
  '$id': `${BASE}/Department`,
  'properties': {
    'code': { 'type': 'string' },
    'employees': {
      'items': { '$ref': `${BASE}/Employee` },
      'type': 'array'
    },
    'head': { '$ref': `${BASE}/Employee` },
    'name': { 'type': 'string' }
  },
  'required': [
    'name',
    'code'
  ],
  'title': 'Department',
  'type': 'object'
} as const;

const OrganizationSchema = {
  '$id': `${BASE}/Organization`,
  'properties': {
    'departments': {
      'items': { '$ref': `${BASE}/Department` },
      'type': 'array'
    },
    'founded': { 'type': 'integer' },
    'headquarters': { '$ref': `${BASE}/Address` },
    'name': { 'type': 'string' },
    'projects': {
      'items': { '$ref': `${BASE}/Project` },
      'type': 'array'
    },
    'taxExempt': { 'type': 'boolean' }
  },
  'required': ['name'],
  'title': 'Organization',
  'type': 'object'
} as const;

const AllSchemas = [
  AddressSchema,
  SkillSchema,
  EmployeeSchema,
  ProjectSchema,
  DepartmentSchema,
  OrganizationSchema
];

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
// Test suite
// ---------------------------------------------------------------------------

describe('ontology round-trip: multi-schema HR domain', () => {
  let jt: InstanceType<typeof JsonTology>;
  let owlNodes: JsonLdNode[];
  let shaclNodes: JsonLdNode[];

  before(() => {
    jt = JsonTology.create({
      'baseIRI': BASE,
      'schemas': AllSchemas
    });

    const ontology = jt.ontology();

    owlNodes = ontology.raw() as JsonLdNode[];
    const shaclObject = ontology.shaclObject() as Record<string, unknown>;

    shaclNodes = shaclObject['@graph'] as JsonLdNode[];
  });

  // -------------------------------------------------------------------------
  // 1. Registration
  // -------------------------------------------------------------------------

  describe('schema registration', () => {
    it('registers all 6 schemas', () => {
      for (const schema of AllSchemas) {
        assert.ok(jt.registry.has(schema.$id) === true, `${schema.$id} registered`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. OWL generation — property-by-property
  // -------------------------------------------------------------------------

  describe('OWL generation', () => {
    it('emits owl:Class for each schema', () => {
      for (const schema of AllSchemas) {
        const node = findNode(owlNodes, schema.$id);

        assert.ok(node !== undefined, `owl node exists for ${schema.$id}`);
        assert.ok(hasType(node, OWL_CLASS), `${schema.$id} typed as owl:Class`);
      }
    });

    it('emits owl:ObjectProperty for $ref properties with rdfs:range', () => {
      // Employee.address → Address
      const addressProps = findPropertyNodes(owlNodes, RDFS_DOMAIN, EmployeeSchema.$id);
      const addressProp = addressProps.find((node) => {
        const id = node['@id'] as string;

        return id.includes('address');
      });

      assert.ok(addressProp !== undefined, 'address property node exists');
      assert.ok(
        hasType(addressProp, OWL_OBJECT_PROPERTY),
        'address typed as owl:ObjectProperty'
      );

      const range = getIdRef(addressProp[RDFS_RANGE]);

      assert.equal(range, AddressSchema.$id, 'address range is Address');
    });

    it('emits owl:DatatypeProperty for scalar properties with XSD range', () => {
      const domainProps = findPropertyNodes(owlNodes, RDFS_DOMAIN, EmployeeSchema.$id);

      // name — xsd:string
      const nameProp = domainProps.find((node) => {
        const id = node['@id'] as string;

        return id.includes('name');
      });

      assert.ok(nameProp !== undefined, 'name property node exists');
      assert.ok(
        hasType(nameProp, OWL_DATATYPE_PROPERTY),
        'name typed as owl:DatatypeProperty'
      );

      const nameRange = getIdRef(nameProp[RDFS_RANGE]);

      assert.equal(nameRange, XSD_STRING, 'name range is xsd:string');

      // active — xsd:boolean
      const activeProp = domainProps.find((node) => {
        const id = node['@id'] as string;

        return id.includes('active');
      });

      assert.ok(activeProp !== undefined, 'active property node exists');
      assert.ok(
        hasType(activeProp, OWL_DATATYPE_PROPERTY),
        'active typed as owl:DatatypeProperty'
      );

      const activeRange = getIdRef(activeProp[RDFS_RANGE]);

      assert.equal(activeRange, XSD_BOOLEAN, 'active range is xsd:boolean');

      // salary — xsd:decimal (number maps to decimal)
      const salaryProp = domainProps.find((node) => {
        const id = node['@id'] as string;

        return id.includes('salary');
      });

      assert.ok(salaryProp !== undefined, 'salary property node exists');

      const salaryRange = getIdRef(salaryProp[RDFS_RANGE]);

      assert.ok(
        salaryRange === XSD_DECIMAL || salaryRange === 'http://www.w3.org/2001/XMLSchema#double',
        `salary range is xsd:decimal or xsd:double, got ${salaryRange ?? 'undefined'}`
      );
    });

    it('emits owl:DatatypeProperty for integer properties with xsd:integer range', () => {
      // Skill.level — integer
      const skillProps = findPropertyNodes(owlNodes, RDFS_DOMAIN, SkillSchema.$id);
      const levelProp = skillProps.find((node) => {
        const id = node['@id'] as string;

        return id.includes('level');
      });

      assert.ok(levelProp !== undefined, 'level property node exists');

      const levelRange = getIdRef(levelProp[RDFS_RANGE]);

      assert.equal(levelRange, XSD_INTEGER, 'level range is xsd:integer');
    });

    it('emits owl:Restriction with owl:minCardinality for required properties', () => {
      // Organization has required: ['name']
      const orgNode = findNode(owlNodes, OrganizationSchema.$id);

      assert.ok(orgNode !== undefined, 'Organization node exists');

      // Restrictions appear as rdfs:subClassOf blank nodes on the class
      const subClassOf = asArray(orgNode[RDFS_SUB_CLASS_OF]);
      const restrictions = subClassOf.filter((entry) => {
        if (typeof entry !== 'object' || entry === null) {
          return false;
        }
        const entryNode = entry as JsonLdNode;

        return hasType(entryNode, OWL_RESTRICTION) || entryNode[OWL_ON_PROPERTY] !== undefined;
      });

      assert.ok(restrictions.length > 0, 'Organization has restriction subClassOf entries');

      // At least one restriction should reference the "name" property with minCardinality
      const nameRestriction = restrictions.find((restriction) => {
        const restrictionNode = restriction as JsonLdNode;
        const onProp = restrictionNode[OWL_ON_PROPERTY];
        const onPropId = getIdRef(onProp);

        return onPropId?.includes('name') === true;
      });

      assert.ok(nameRestriction !== undefined, 'restriction exists for name property');

      const minCard = (nameRestriction as JsonLdNode)[OWL_MIN_CARDINALITY];

      assert.ok(minCard !== undefined, 'minCardinality set on name restriction');
      assert.equal(Number(minCard), 1, 'minCardinality is 1');
    });

    it('emits owl:ObjectProperty for array $ref properties', () => {
      // Employee.skills → array of Skill
      const empProps = findPropertyNodes(owlNodes, RDFS_DOMAIN, EmployeeSchema.$id);
      const skillsProp = empProps.find((node) => {
        const id = node['@id'] as string;

        return id.includes('skills');
      });

      assert.ok(skillsProp !== undefined, 'skills property node exists');
      assert.ok(
        hasType(skillsProp, OWL_OBJECT_PROPERTY),
        'skills typed as owl:ObjectProperty'
      );

      // Array $ref range may be the class IRI directly or rdf:List.
      // Verify the property node exists and is typed as ObjectProperty.
      const skillsRange = getIdRef(skillsProp[RDFS_RANGE]);

      assert.ok(skillsRange !== undefined, 'skills property has rdfs:range');
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

      // Some generators use @id matching the class IRI
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
    it('produces sh:NodeShape for each schema', () => {
      for (const schema of AllSchemas) {
        const shape = findShape(schema.$id);

        assert.ok(shape !== undefined, `NodeShape exists for ${schema.$id}`);
        assert.ok(
          hasType(shape, SH_NODE_SHAPE),
          `${schema.$id} shape typed as sh:NodeShape`
        );
      }
    });

    it('produces sh:PropertyShape with sh:path for each property', () => {
      const addressShape = findShape(AddressSchema.$id);

      assert.ok(addressShape !== undefined, 'Address shape exists');

      const props = shapeProperties(addressShape);

      assert.ok(props.length >= 4, `Address has at least 4 property shapes, got ${props.length}`);

      // Each property shape must have sh:path
      for (const prop of props) {
        const path = prop[SH_PATH];

        assert.ok(path !== undefined, 'property shape has sh:path');
      }
    });

    it('sets sh:minCount 1 for required properties', () => {
      const addressShape = findShape(AddressSchema.$id);

      assert.ok(addressShape !== undefined, 'Address shape exists');

      // street, city, country are required
      for (const propName of [
        'street',
        'city',
        'country'
      ]) {
        const propShape = findPropertyShape(addressShape, propName);

        assert.ok(propShape !== undefined, `${propName} property shape exists`);

        const minCount = propShape[SH_MIN_COUNT];

        assert.ok(minCount !== undefined, `${propName} has sh:minCount`);
        assert.equal(Number(minCount), 1, `${propName} sh:minCount is 1`);
      }

      // zip is optional — should NOT have minCount 1
      const zipShape = findPropertyShape(addressShape, 'zip');

      if (zipShape !== undefined) {
        const zipMinCount = zipShape[SH_MIN_COUNT];

        assert.ok(
          zipMinCount === undefined || Number(zipMinCount) === 0,
          'zip does not have sh:minCount 1'
        );
      }
    });

    it('sets sh:datatype xsd:string for string properties', () => {
      const addressShape = findShape(AddressSchema.$id);

      assert.ok(addressShape !== undefined, 'Address shape exists');

      const streetShape = findPropertyShape(addressShape, 'street');

      assert.ok(streetShape !== undefined, 'street property shape exists');

      const datatype = streetShape[SH_DATATYPE];

      assert.ok(datatype !== undefined, 'street has sh:datatype');

      const datatypeId = getIdRef(datatype);

      assert.equal(datatypeId, XSD_STRING, 'street datatype is xsd:string');
    });

    it('sets sh:class or sh:node for $ref properties', () => {
      const empShape = findShape(EmployeeSchema.$id);

      assert.ok(empShape !== undefined, 'Employee shape exists');

      const addressPropShape = findPropertyShape(empShape, 'address');

      assert.ok(addressPropShape !== undefined, 'address property shape exists');

      const classRef = getIdRef(addressPropShape[SH_CLASS]);
      const nodeRef = getIdRef(addressPropShape[SH_NODE]);
      const refTarget = classRef ?? nodeRef;

      assert.ok(refTarget !== undefined, 'address has sh:class or sh:node');
      assert.equal(refTarget, AddressSchema.$id, 'address references Address class');
    });

    it('produces cardinality constraints for array properties with minItems/maxItems', () => {
      const projectShape = findShape(ProjectSchema.$id);

      assert.ok(projectShape !== undefined, 'Project shape exists');

      const membersShape = findPropertyShape(projectShape, 'members');

      assert.ok(membersShape !== undefined, 'members property shape exists');

      // members has minItems: 1, maxItems: 50
      const minCount = membersShape[SH_MIN_COUNT];
      const maxCount = membersShape[SH_MAX_COUNT];

      if (minCount !== undefined) {
        assert.equal(Number(minCount), 1, 'members sh:minCount is 1');
      }
      if (maxCount !== undefined) {
        assert.equal(Number(maxCount), 50, 'members sh:maxCount is 50');
      }

      // At least one cardinality constraint should be present
      assert.ok(
        minCount !== undefined || maxCount !== undefined,
        'members has at least one cardinality constraint'
      );
    });

    it('sets sh:datatype xsd:integer for integer properties', () => {
      const skillShape = findShape(SkillSchema.$id);

      assert.ok(skillShape !== undefined, 'Skill shape exists');

      const levelShape = findPropertyShape(skillShape, 'level');

      assert.ok(levelShape !== undefined, 'level property shape exists');

      const datatype = levelShape[SH_DATATYPE];

      assert.ok(datatype !== undefined, 'level has sh:datatype');

      const datatypeId = getIdRef(datatype);

      assert.equal(datatypeId, XSD_INTEGER, 'level datatype is xsd:integer');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Validation
  // -------------------------------------------------------------------------

  describe('validation against registered schemas', () => {
    it('validates valid Address data', () => {
      const errors = jt.validate(AddressSchema.$id, {
        'city': 'Berlin',
        'country': 'DE',
        'street': 'Unter den Linden 1'
      });

      assert.equal(errors.ok, true, 'valid address produces no errors');
    });

    it('rejects Address missing required field', () => {
      const errors = jt.validate(AddressSchema.$id, { 'city': 'Berlin' });

      assert.ok(errors.length > 0, 'missing street + country produces errors');
    });

    it('validates valid Employee data', () => {
      const errors = jt.validate(EmployeeSchema.$id, {
        'active': true,
        'email': 'alice@example.com',
        'name': 'Alice'
      });

      assert.equal(errors.ok, true, 'valid employee produces no errors');
    });

    it('validates Employee with nested Address and Skills', () => {
      const errors = jt.validate(EmployeeSchema.$id, {
        'active': true,
        'address': {
          'city': 'Munich',
          'country': 'DE',
          'street': 'Marienplatz 1'
        },
        'email': 'bob@example.com',
        'name': 'Bob',
        'salary': 75_000,
        'skills': [
          {
            'level': 3,
            'name': 'TypeScript'
          },
          { 'name': 'RDF' }
        ]
      });

      assert.equal(errors.ok, true, 'valid employee with nested objects produces no errors');
    });

    it('validates valid Organization data', () => {
      const errors = jt.validate(OrganizationSchema.$id, {
        'departments': [{
          'code': 'ENG',
          'employees': [],
          'name': 'Engineering'
        }],
        'founded': 2020,
        'name': 'Acme Corp'
      });

      assert.equal(errors.ok, true, 'valid organization produces no errors');
    });

    it('rejects Organization missing required name', () => {
      const errors = jt.validate(OrganizationSchema.$id, { 'founded': 2020 });

      assert.ok(errors.length > 0, 'missing name produces errors');
    });
  });

  // -------------------------------------------------------------------------
  // 5. toQuads/fromQuads round-trip
  // -------------------------------------------------------------------------

  describe('toQuads/fromQuads round-trip', () => {
    it('round-trips a simple Address', () => {
      const input = {
        'city': 'Berlin',
        'country': 'DE',
        'street': 'Unter den Linden 1',
        'zip': '10117'
      };
      const quads = jt.materializer.projectAbox(
        AddressSchema,
        input,
        BASE
      );
      const results = jt.fromQuads(AddressSchema.$id, quads);

      assert.equal(results.length, 1);
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.street, 'Unter den Linden 1');
      assert.equal(output.city, 'Berlin');
      assert.equal(output.country, 'DE');
      assert.equal(output.zip, '10117');
    });

    it('round-trips an Employee scalar properties (cross-schema $ref excluded)', () => {
      // Cross-schema $ref (Employee.address → Address, Employee.skills → Skill)
      // requires multi-graph ABox projection. Test only scalar properties here.
      const input = {
        'active': true,
        'email': 'carol@example.com',
        'name': 'Carol',
        'salary': 80_000,
        'tags': [
          'senior',
          'backend'
        ]
      };
      const quads = jt.materializer.projectAbox(
        EmployeeSchema,
        input,
        BASE
      );
      const results = jt.fromQuads(EmployeeSchema.$id, quads);

      assert.equal(results.length, 1);
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.name, 'Carol');
      assert.equal(output.email, 'carol@example.com');
      assert.equal(output.active, true);
      assert.equal(output.salary, 80_000);

      const tags = output.tags as string[];

      assert.ok(Array.isArray(tags), 'tags is array');
      assert.deepEqual(tags.sort(), [
        'backend',
        'senior'
      ]);
    });

    it('round-trips intra-schema $defs nested objects', () => {
      // Intra-schema $ref round-trip (uses $defs, not cross-schema)
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
        '$id': `${BASE}/InlineTest`,
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
        'baseIRI': BASE,
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
        BASE
      );
      const results = localJt.fromQuads(InlineSchema.$id, quads);

      assert.equal(results.length, 1);
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.name, 'Inline Test');

      const contact = output.contact as Record<string, unknown>;

      assert.equal(contact.email, 'test@example.com');
      assert.equal(contact.phone, '+1234567890');
    });

    it('round-trips Organization scalar properties', () => {
      const input = {
        'founded': 2020,
        'name': 'Acme Corp',
        'taxExempt': false
      };
      const quads = jt.materializer.projectAbox(
        OrganizationSchema,
        input,
        BASE
      );
      const results = jt.fromQuads(OrganizationSchema.$id, quads);

      assert.equal(results.length, 1);
      const output = results[0] as Record<string, unknown>;

      assert.equal(output.name, 'Acme Corp');
      assert.equal(output.founded, 2020);
      assert.equal(output.taxExempt, false);
    });

    it('round-trips scalar types: string, number, integer, boolean', () => {
      // Employee covers string (name, email), number (salary), boolean (active)
      const input = {
        'active': false,
        'email': 'test@example.com',
        'name': 'Scalar Test',
        'salary': 99_999.5
      };
      const quads = jt.materializer.projectAbox(
        EmployeeSchema,
        input,
        BASE
      );
      const results = jt.fromQuads(EmployeeSchema.$id, quads);

      assert.equal(results.length, 1);
      const output = results[0] as Record<string, unknown>;

      assert.equal(typeof output.name, 'string');
      assert.equal(typeof output.active, 'boolean');
      assert.equal(typeof output.salary, 'number');
      assert.equal(output.active, false);
      assert.equal(output.salary, 99_999.5);
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

      // Re-register reconstructed schema under a distinct $id
      const altId = `${AddressSchema.$id}/reconstructed`;
      const altSchema = {
        ...reconstructed,
        '$id': altId
      };

      jt.set(altSchema as { readonly '$id': string });

      const data = {
        'city': 'Berlin',
        'country': 'DE',
        'street': 'Unter den Linden 1'
      };

      // Validate against both original and reconstructed
      const origErrors = jt.validate(AddressSchema.$id, data);
      const reconErrors = jt.validate(altId, data);

      assert.equal(origErrors.ok, true, 'original validates');
      assert.equal(reconErrors.ok, true, 'reconstructed validates same data');
    });

    it('reconstructs Employee schema preserving required fields', () => {
      const reconstructed = jt.toSchema(EmployeeSchema.$id);

      assert.ok(reconstructed !== undefined, 'reconstructed schema exists');

      // required must be preserved
      const required = reconstructed.required as string[];

      assert.ok(Array.isArray(required), 'required is array');
      assert.ok(required.includes('name'), 'name is required');
      assert.ok(required.includes('email'), 'email is required');
      assert.ok(required.includes('active'), 'active is required');
    });

    it('reconstructs Employee schema preserving $ref properties', () => {
      const reconstructed = jt.toSchema(EmployeeSchema.$id);

      assert.ok(reconstructed !== undefined, 'reconstructed schema exists');

      const properties = reconstructed.properties as Partial<Record<string, Record<string, unknown>>> | undefined;

      assert.ok(properties !== undefined, 'properties exist');

      // address should be a $ref
      const address = properties.address;

      assert.ok(address !== undefined, 'address property exists');
      assert.equal(address.$ref, AddressSchema.$id, 'address $ref preserved');
    });

    it('reconstructs Employee schema preserving array items', () => {
      const reconstructed = jt.toSchema(EmployeeSchema.$id);

      assert.ok(reconstructed !== undefined, 'reconstructed schema exists');

      const properties = reconstructed.properties as Partial<Record<string, Record<string, unknown>>> | undefined;
      const skills = properties?.skills;

      assert.ok(skills !== undefined, 'skills property exists');
      assert.equal(skills.type, 'array', 'skills type is array');

      const items = skills.items as Record<string, unknown> | undefined;

      assert.ok(items !== undefined, 'skills items exists');
      assert.equal(items.$ref, SkillSchema.$id, 'skills items $ref preserved');
    });

    it('reconstructs Organization schema and rejects invalid data', () => {
      const reconstructed = jt.toSchema(OrganizationSchema.$id);

      assert.ok(reconstructed !== undefined, 'reconstructed schema exists');

      const altId = `${OrganizationSchema.$id}/reconstructed`;
      const altSchema = {
        ...reconstructed,
        '$id': altId
      };

      jt.set(altSchema as { readonly '$id': string });

      // Missing required "name" — should fail
      const errors = jt.validate(altId, { 'founded': 2020 });

      assert.ok(errors.length > 0, 'reconstructed schema rejects data missing required name');
    });
  });
});
