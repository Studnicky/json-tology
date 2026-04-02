/**
 * Serialization Edge Cases — OWL and SHACL projection coverage
 * for scalar-only, mixed ref/scalar, array-of-ref, readOnly/writeOnly,
 * enum, allOf composition, inheritance, no-$id, string constraints,
 * pattern, array cardinality, nested $ref, required vs optional,
 * empty schema, and full-IRI predicate keys.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { GraphOntologySerializer } from '../../src/modules/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from '../../src/modules/ontology/GraphShaclSerializer.js';

type JsonLdNode = Record<string, unknown>;

function owlNodes(registry: SchemaRegistry): JsonLdNode[] {
  const serializer = new GraphOntologySerializer();

  return serializer.serialize(registry.listGraphs()) as JsonLdNode[];
}

function shaclNodes(registry: SchemaRegistry): JsonLdNode[] {
  const serializer = new GraphShaclSerializer();

  return serializer.serialize(registry.listGraphs()) as JsonLdNode[];
}

// -------------------------------------------------------------------------
// OWL: scalar property scenarios
// -------------------------------------------------------------------------

interface OwlScalarScenario {
  'expectedRange': string;
  'expectedType': string;
  'name': string;
  'propId': string;
}

const owlScalarScenarios: OwlScalarScenario[] = [
  {
    'expectedRange': 'http://www.w3.org/2001/XMLSchema#string',
    'expectedType': 'http://www.w3.org/2002/07/owl#DatatypeProperty',
    'name': 'emits DatatypeProperty with xsd:string range for name',
    'propId': 'https://example.com/ScalarOnly#name'
  },
  {
    'expectedRange': 'http://www.w3.org/2001/XMLSchema#integer',
    'expectedType': 'http://www.w3.org/2002/07/owl#DatatypeProperty',
    'name': 'emits DatatypeProperty with xsd:integer range for age',
    'propId': 'https://example.com/ScalarOnly#age'
  },
  {
    'expectedRange': 'http://www.w3.org/2001/XMLSchema#decimal',
    'expectedType': 'http://www.w3.org/2002/07/owl#DatatypeProperty',
    'name': 'emits DatatypeProperty with xsd:decimal range for score',
    'propId': 'https://example.com/ScalarOnly#score'
  },
  {
    'expectedRange': 'http://www.w3.org/2001/XMLSchema#boolean',
    'expectedType': 'http://www.w3.org/2002/07/owl#DatatypeProperty',
    'name': 'emits DatatypeProperty with xsd:boolean range for active',
    'propId': 'https://example.com/ScalarOnly#active'
  }
];

void describe('OWL serialization: scalar property ranges', () => {
  const reg = new SchemaRegistry();

  reg.register({
    '$id': 'https://example.com/ScalarOnly',
    'properties': {
      'active': { 'type': 'boolean' },
      'age': { 'type': 'integer' },
      'name': { 'type': 'string' },
      'score': { 'type': 'number' }
    },
    'type': 'object'
  });

  const nodes = owlNodes(reg);

  for (const scenario of owlScalarScenarios) {
    void it(scenario.name, () => {
      const prop = nodes.find((node) => {
        return node['@id'] === scenario.propId;
      });

      assert.ok(prop !== undefined, scenario.name);
      assert.strictEqual(prop['@type'], scenario.expectedType, `${scenario.name} — type`);
      assert.deepStrictEqual(
        prop['http://www.w3.org/2000/01/rdf-schema#range'],
        { '@id': scenario.expectedRange },
        `${scenario.name} — range`
      );
    });
  }
});

// -------------------------------------------------------------------------
// OWL: mixed ref/scalar — property type check
// -------------------------------------------------------------------------

interface OwlMixedPropScenario {
  'expectedType': string;
  'name': string;
  'propId': string;
}

const owlMixedPropScenarios: OwlMixedPropScenario[] = [
  {
    'expectedType': 'http://www.w3.org/2002/07/owl#DatatypeProperty',
    'name': 'emits DatatypeProperty for scalar label in mixed schema',
    'propId': 'https://example.com/MixedProps#label'
  },
  {
    'expectedType': 'http://www.w3.org/2002/07/owl#ObjectProperty',
    'name': 'emits ObjectProperty for $ref in mixed schema',
    'propId': 'https://example.com/MixedProps#ref'
  }
];

void describe('OWL serialization: mixed ref/scalar property types', () => {
  const reg = new SchemaRegistry();

  reg.register({
    '$id': 'https://example.com/Target',
    'properties': { 'value': { 'type': 'string' } },
    'type': 'object'
  });
  reg.register({
    '$id': 'https://example.com/MixedProps',
    'properties': {
      'label': { 'type': 'string' },
      'ref': { '$ref': 'https://example.com/Target' }
    },
    'type': 'object'
  });

  const nodes = owlNodes(reg);

  for (const {
    expectedType, name, propId
  } of owlMixedPropScenarios) {
    void it(name, () => {
      const prop = nodes.find((node) => {
        return node['@id'] === propId;
      });

      assert.ok(prop !== undefined, `${name} — exists`);
      assert.strictEqual(prop['@type'], expectedType, `${name} — type`);
    });
  }
});

// -------------------------------------------------------------------------
// OWL: array of $ref with allValuesFrom restriction
// -------------------------------------------------------------------------

void describe('OWL serialization: array of $ref with allValuesFrom', () => {
  const reg = new SchemaRegistry();

  reg.register({
    '$id': 'https://example.com/Item',
    'properties': { 'name': { 'type': 'string' } },
    'type': 'object'
  });
  reg.register({
    '$id': 'https://example.com/Container',
    'properties': {
      'items': {
        'items': { '$ref': 'https://example.com/Item' },
        'type': 'array'
      }
    },
    'type': 'object'
  });

  const nodes = owlNodes(reg);

  interface ArrayRefScenario {
    'check': 'allValuesFrom' | 'classExists' | 'propRange' | 'propType';
    'name': string;
  }

  const scenarios: ArrayRefScenario[] = [
    {
      'check': 'propType',
      'name': 'items property is ObjectProperty'
    },
    {
      'check': 'propRange',
      'name': 'items property range is rdf:List'
    },
    {
      'check': 'classExists',
      'name': 'Container class exists'
    },
    {
      'check': 'allValuesFrom',
      'name': 'allValuesFrom restriction targets Item'
    }
  ];

  for (const {
    check, name
  } of scenarios) {
    void it(name, () => {
      if (check === 'propType') {
        const itemsProp = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Container#items';
        });

        assert.ok(itemsProp !== undefined, 'array of $ref — items exists');
        assert.strictEqual(itemsProp['@type'], 'http://www.w3.org/2002/07/owl#ObjectProperty', 'array of $ref — items type');
      }

      if (check === 'propRange') {
        const itemsProp = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Container#items';
        });

        assert.ok(itemsProp !== undefined, 'array of $ref — items exists');
        assert.deepStrictEqual(
          itemsProp['http://www.w3.org/2000/01/rdf-schema#range'],
          { '@id': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#List' },
          'array of $ref — range'
        );
      }

      if (check === 'classExists') {
        const classNode = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Container'
            && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
        });

        assert.ok(classNode !== undefined, 'array of $ref — Container class exists');
      }

      if (check === 'allValuesFrom') {
        const classNode = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Container'
            && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
        });

        assert.ok(classNode !== undefined, 'array of $ref — Container class exists');

        const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

        assert.ok(Array.isArray(subs), 'array of $ref — rdfs:subClassOf exists');

        const avfRestriction = subs.find((sub) => {
          return sub['http://www.w3.org/2002/07/owl#allValuesFrom'] !== undefined;
        });

        assert.ok(avfRestriction !== undefined, 'array of $ref — allValuesFrom exists');
        assert.deepStrictEqual(
          avfRestriction['http://www.w3.org/2002/07/owl#allValuesFrom'],
          { '@id': 'https://example.com/Item' },
          'array of $ref — allValuesFrom target'
        );
      }
    });
  }
});

// -------------------------------------------------------------------------
// OWL: readOnly/writeOnly annotations
// -------------------------------------------------------------------------

interface OwlAccessScenario {
  'expectedReadOnly': boolean | undefined;
  'expectedWriteOnly': boolean | undefined;
  'name': string;
  'propId': string;
}

const owlAccessScenarios: OwlAccessScenario[] = [
  {
    'expectedReadOnly': true,
    'expectedWriteOnly': undefined,
    'name': 'emits dash:readOnly true for readOnly property',
    'propId': 'https://example.com/AccessControl#createdAt'
  },
  {
    'expectedReadOnly': undefined,
    'expectedWriteOnly': true,
    'name': 'emits dash:writeOnly true for writeOnly property',
    'propId': 'https://example.com/AccessControl#password'
  }
];

void describe('OWL serialization: readOnly/writeOnly annotations', () => {
  const reg = new SchemaRegistry();

  reg.register({
    '$id': 'https://example.com/AccessControl',
    'properties': {
      'createdAt': {
        'readOnly': true,
        'type': 'string'
      },
      'password': {
        'type': 'string',
        'writeOnly': true
      }
    },
    'type': 'object'
  });

  const nodes = owlNodes(reg);

  for (const {
    expectedReadOnly, expectedWriteOnly, name, propId
  } of owlAccessScenarios) {
    void it(name, () => {
      const prop = nodes.find((node) => {
        return node['@id'] === propId;
      });

      assert.ok(prop !== undefined, `${name} — exists`);
      assert.strictEqual(prop['http://datashapes.org/dash#readOnly'], expectedReadOnly, `${name} — readOnly`);
      assert.strictEqual(prop['http://datashapes.org/dash#writeOnly'], expectedWriteOnly, `${name} — writeOnly`);
    });
  }
});

// -------------------------------------------------------------------------
// OWL: enum oneOf
// -------------------------------------------------------------------------

void describe('OWL serialization: enum oneOf', () => {
  const reg = new SchemaRegistry();

  reg.register({
    '$id': 'https://example.com/StatusEnum',
    'enum': [
      'active',
      'inactive',
      'pending'
    ],
    'type': 'string'
  });

  const nodes = owlNodes(reg);

  interface EnumScenario {
    'check': 'hasOneOf' | 'isList' | 'listLength';
    'name': string;
  }

  const scenarios: EnumScenario[] = [
    {
      'check': 'hasOneOf',
      'name': 'class with owl:oneOf exists'
    },
    {
      'check': 'isList',
      'name': 'owl:oneOf is @list'
    },
    {
      'check': 'listLength',
      'name': 'owl:oneOf contains three values'
    }
  ];

  for (const {
    check, name
  } of scenarios) {
    void it(name, () => {
      const enumNode = nodes.find((node) => {
        return node['@id'] === 'https://example.com/StatusEnum'
          && node['http://www.w3.org/2002/07/owl#oneOf'] !== undefined;
      });

      assert.ok(enumNode !== undefined, 'enum — class with owl:oneOf exists');

      if (check === 'isList' || check === 'listLength') {
        const oneOf = enumNode['http://www.w3.org/2002/07/owl#oneOf'] as JsonLdNode;

        assert.ok(oneOf['@list'] !== undefined, 'enum — owl:oneOf is @list');

        if (check === 'listLength') {
          const listItems = oneOf['@list'] as unknown[];

          assert.strictEqual(listItems.length, 3, 'enum — three values');
        }
      }
    });
  }
});

// -------------------------------------------------------------------------
// OWL: allOf composition and inheritance
// -------------------------------------------------------------------------

interface OwlSubClassScenario {
  'classId': string;
  'expectedSuperClasses': string[];
  'name': string;
  'schemas': Array<Record<string, unknown>>;
}

const owlSubClassScenarios: OwlSubClassScenario[] = [
  {
    'classId': 'https://example.com/Composed',
    'expectedSuperClasses': [
      'https://example.com/Base',
      'https://example.com/Extra'
    ],
    'name': 'emits rdfs:subClassOf for allOf composition with multiple $ref entries',
    'schemas': [
      {
        '$id': 'https://example.com/Base',
        'properties': { 'id': { 'type': 'string' } },
        'type': 'object'
      },
      {
        '$id': 'https://example.com/Extra',
        'properties': { 'extra': { 'type': 'number' } },
        'type': 'object'
      },
      {
        '$id': 'https://example.com/Composed',
        'allOf': [
          { '$ref': 'https://example.com/Base' },
          { '$ref': 'https://example.com/Extra' }
        ],
        'type': 'object'
      }
    ]
  },
  {
    'classId': 'https://example.com/Dog',
    'expectedSuperClasses': ['https://example.com/Animal'],
    'name': 'emits rdfs:subClassOf for schema inheriting via allOf $ref',
    'schemas': [
      {
        '$id': 'https://example.com/Animal',
        'properties': { 'species': { 'type': 'string' } },
        'required': ['species'],
        'type': 'object'
      },
      {
        '$id': 'https://example.com/Dog',
        'allOf': [{ '$ref': 'https://example.com/Animal' }],
        'properties': { 'breed': { 'type': 'string' } },
        'type': 'object'
      }
    ]
  }
];

void describe('OWL serialization: allOf composition and inheritance', () => {
  for (const {
    classId, expectedSuperClasses, name, schemas
  } of owlSubClassScenarios) {
    void it(name, () => {
      const reg = new SchemaRegistry();

      for (const schema of schemas) {
        reg.register(schema);
      }

      const nodes = owlNodes(reg);

      const classNode = nodes.find((node) => {
        return node['@id'] === classId
          && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
      });

      assert.ok(classNode !== undefined, `${name} — class exists`);

      const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

      assert.ok(subs !== undefined, `${name} — rdfs:subClassOf exists`);

      const subArray = Array.isArray(subs) ? subs : [subs];

      for (const superClass of expectedSuperClasses) {
        assert.ok(
          subArray.some((sub) => {
            return sub['@id'] === superClass;
          }),
          `${name} — subClassOf ${superClass}`
        );
      }
    });
  }
});

// -------------------------------------------------------------------------
// OWL: no-$id schema
// -------------------------------------------------------------------------

void describe('OWL serialization: no-$id schema', () => {
  void it('throws SchemaError for schema with no $id', () => {
    const reg = new SchemaRegistry();

    assert.throws(() => {
      reg.register({
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      });
    }, (error: unknown) => {
      return error instanceof Error && error.message.includes('$id');
    }, 'no $id — throws SchemaError');
  });
});

// -------------------------------------------------------------------------
// SHACL: string constraints
// -------------------------------------------------------------------------

interface ShaclStringConstraintScenario {
  'expectedMaxLength': number;
  'expectedMinLength': number;
  'name': string;
  'propPathFragment': string;
  'schemaId': string;
}

const shaclStringConstraintScenarios: ShaclStringConstraintScenario[] = [{
  'expectedMaxLength': 10,
  'expectedMinLength': 2,
  'name': 'emits sh:minLength and sh:maxLength for string constraints',
  'propPathFragment': 'code',
  'schemaId': 'https://example.com/StringConstrained'
}];

void describe('SHACL serialization: string constraints', () => {
  const reg = new SchemaRegistry();

  reg.register({
    '$id': 'https://example.com/StringConstrained',
    'properties': {
      'code': {
        'maxLength': 10,
        'minLength': 2,
        'type': 'string'
      }
    },
    'type': 'object'
  });

  const shapes = shaclNodes(reg);

  for (const {
    expectedMaxLength, expectedMinLength, name, propPathFragment, schemaId
  } of shaclStringConstraintScenarios) {
    void it(name, () => {
      const nodeShape = shapes.find((shape) => {
        return shape['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
      });

      assert.ok(nodeShape !== undefined, `${schemaId} — NodeShape exists`);

      const propShapes = nodeShape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];

      assert.ok(Array.isArray(propShapes), `${schemaId} — sh:property exists`);

      const prop = propShapes.find((propShape) => {
        const path = propShape['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;

        return typeof path?.['@id'] === 'string' && (path['@id']).includes(propPathFragment);
      });

      assert.ok(prop !== undefined, `${name} — ${propPathFragment} prop exists`);
      assert.strictEqual(prop['http://www.w3.org/ns/shacl#minLength'], expectedMinLength, `${name} — minLength`);
      assert.strictEqual(prop['http://www.w3.org/ns/shacl#maxLength'], expectedMaxLength, `${name} — maxLength`);
    });
  }
});

// -------------------------------------------------------------------------
// SHACL: pattern constraint
// -------------------------------------------------------------------------

interface ShaclPatternScenario {
  'expectedPattern': string;
  'name': string;
  'propPathFragment': string;
  'schema': Record<string, unknown>;
}

const shaclPatternScenarios: ShaclPatternScenario[] = [{
  'expectedPattern': '^\\d{5}$',
  'name': 'emits sh:pattern for pattern constraint',
  'propPathFragment': 'zipCode',
  'schema': {
    '$id': 'https://example.com/PatternConstrained',
    'properties': {
      'zipCode': {
        'pattern': '^\\d{5}$',
        'type': 'string'
      }
    },
    'type': 'object'
  }
}];

void describe('SHACL serialization: pattern constraints', () => {
  for (const {
    expectedPattern, name, propPathFragment, schema
  } of shaclPatternScenarios) {
    void it(name, () => {
      const reg = new SchemaRegistry();

      reg.register(schema);

      const shapes = shaclNodes(reg);

      const nodeShape = shapes.find((shape) => {
        return shape['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
      });

      assert.ok(nodeShape !== undefined, 'pattern — NodeShape exists');

      const propShapes = nodeShape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];

      assert.ok(Array.isArray(propShapes), 'pattern — sh:property exists');

      const prop = propShapes.find((propShape) => {
        const path = propShape['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;

        return typeof path?.['@id'] === 'string' && (path['@id']).includes(propPathFragment);
      });

      assert.ok(prop !== undefined, `pattern — ${propPathFragment} prop exists`);
      assert.strictEqual(prop['http://www.w3.org/ns/shacl#pattern'], expectedPattern, 'pattern — value');
    });
  }
});

// -------------------------------------------------------------------------
// SHACL: array cardinality
// -------------------------------------------------------------------------

void describe('SHACL serialization: array cardinality', () => {
  const reg = new SchemaRegistry();

  reg.register({
    '$id': 'https://example.com/ArrayConstrained',
    'items': { 'type': 'string' },
    'maxItems': 10,
    'minItems': 1,
    'type': 'array'
  });

  const shapes = shaclNodes(reg);

  interface CardinalityScenario {
    'check': 'max' | 'min';
    'name': string;
  }

  const scenarios: CardinalityScenario[] = [
    {
      'check': 'min',
      'name': 'emits minItems constraint for array'
    },
    {
      'check': 'max',
      'name': 'emits maxItems constraint for array'
    }
  ];

  for (const {
    check, name
  } of scenarios) {
    void it(name, () => {
      const nodeShape = shapes.find((shape) => {
        return shape['@id'] === 'https://example.com/ArrayConstrained';
      });

      assert.ok(nodeShape !== undefined, 'array cardinality — NodeShape exists');

      if (check === 'min') {
        const hasMinCount = nodeShape['http://www.w3.org/ns/shacl#minCount'] !== undefined;
        const hasJtMin = nodeShape['https://json-tology.dev/vocab#minItems'] !== undefined;

        assert.ok(hasMinCount || hasJtMin, 'array cardinality — minItems emitted');
      }

      if (check === 'max') {
        const hasMaxCount = nodeShape['http://www.w3.org/ns/shacl#maxCount'] !== undefined;
        const hasJtMax = nodeShape['https://json-tology.dev/vocab#maxItems'] !== undefined;

        assert.ok(hasMaxCount || hasJtMax, 'array cardinality — maxItems emitted');
      }
    });
  }
});

// -------------------------------------------------------------------------
// SHACL: nested $ref property
// -------------------------------------------------------------------------

void describe('SHACL serialization: nested $ref property', () => {
  const reg = new SchemaRegistry();

  reg.register({
    '$id': 'https://example.com/Address',
    'properties': {
      'city': { 'type': 'string' },
      'street': { 'type': 'string' }
    },
    'type': 'object'
  });
  reg.register({
    '$id': 'https://example.com/Person',
    'properties': {
      'address': { '$ref': 'https://example.com/Address' },
      'name': { 'type': 'string' }
    },
    'type': 'object'
  });

  const shapes = shaclNodes(reg);

  interface NestedRefScenario {
    'check': 'classTarget' | 'nodeOrClassPresent' | 'nodeTarget' | 'propExists' | 'shapeExists';
    'name': string;
  }

  const scenarios: NestedRefScenario[] = [
    {
      'check': 'shapeExists',
      'name': 'Person shape exists'
    },
    {
      'check': 'propExists',
      'name': 'address property shape exists'
    },
    {
      'check': 'nodeOrClassPresent',
      'name': 'sh:node or sh:class present for address'
    }
  ];

  for (const {
    check, name
  } of scenarios) {
    void it(name, () => {
      const personShape = shapes.find((shape) => {
        return shape['@id'] === 'https://example.com/Person';
      });

      assert.ok(personShape !== undefined, 'nested $ref — Person shape exists');

      if (check === 'shapeExists') {
        return;
      }

      const propShapes = personShape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];

      assert.ok(Array.isArray(propShapes), 'nested $ref — sh:property exists');

      const addressProp = propShapes.find((prop) => {
        const path = prop['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;

        return typeof path?.['@id'] === 'string' && (path['@id']).includes('address');
      });

      assert.ok(addressProp !== undefined, 'nested $ref — address prop exists');

      if (check === 'propExists') {
        return;
      }

      const hasNode = addressProp['http://www.w3.org/ns/shacl#node'] !== undefined;
      const hasClass = addressProp['http://www.w3.org/ns/shacl#class'] !== undefined;

      assert.ok(hasNode || hasClass, 'nested $ref — sh:node or sh:class present');

      if (hasNode) {
        assert.deepStrictEqual(
          addressProp['http://www.w3.org/ns/shacl#node'],
          { '@id': 'https://example.com/Address' },
          'nested $ref — sh:node target'
        );
      }

      if (hasClass) {
        assert.deepStrictEqual(
          addressProp['http://www.w3.org/ns/shacl#class'],
          { '@id': 'https://example.com/Address' },
          'nested $ref — sh:class target'
        );
      }
    });
  }
});

// -------------------------------------------------------------------------
// SHACL: required vs optional minCount
// -------------------------------------------------------------------------

interface ShaclRequiredScenario {
  'expectedMinCount': 0 | 1 | undefined;
  'name': string;
  'propPathFragment': string;
  'schemas': Array<Record<string, unknown>>;
  'shapeId': string;
}

const shaclRequiredScenarios: ShaclRequiredScenario[] = [
  {
    'expectedMinCount': 1,
    'name': 'emits sh:minCount 1 for required username',
    'propPathFragment': 'username',
    'schemas': [{
      '$id': 'https://example.com/RequiredOptional',
      'properties': {
        'nickname': { 'type': 'string' },
        'username': { 'type': 'string' }
      },
      'required': ['username'],
      'type': 'object'
    }],
    'shapeId': 'https://example.com/RequiredOptional'
  },
  {
    'expectedMinCount': undefined,
    'name': 'emits absent or 0 sh:minCount for optional nickname',
    'propPathFragment': 'nickname',
    'schemas': [{
      '$id': 'https://example.com/RequiredOptional',
      'properties': {
        'nickname': { 'type': 'string' },
        'username': { 'type': 'string' }
      },
      'required': ['username'],
      'type': 'object'
    }],
    'shapeId': 'https://example.com/RequiredOptional'
  },
  {
    'expectedMinCount': 1,
    'name': 'emits sh:minCount 1 for required name in multi-required schema',
    'propPathFragment': 'name',
    'schemas': [{
      '$id': 'https://example.com/MultiRequired',
      'properties': {
        'email': { 'type': 'string' },
        'name': { 'type': 'string' },
        'optional': { 'type': 'string' }
      },
      'required': [
        'email',
        'name'
      ],
      'type': 'object'
    }],
    'shapeId': 'https://example.com/MultiRequired'
  },
  {
    'expectedMinCount': 1,
    'name': 'emits sh:minCount 1 for required email in multi-required schema',
    'propPathFragment': 'email',
    'schemas': [{
      '$id': 'https://example.com/MultiRequired',
      'properties': {
        'email': { 'type': 'string' },
        'name': { 'type': 'string' },
        'optional': { 'type': 'string' }
      },
      'required': [
        'email',
        'name'
      ],
      'type': 'object'
    }],
    'shapeId': 'https://example.com/MultiRequired'
  },
  {
    'expectedMinCount': undefined,
    'name': 'emits absent or 0 sh:minCount for optional prop in multi-required schema',
    'propPathFragment': 'optional',
    'schemas': [{
      '$id': 'https://example.com/MultiRequired',
      'properties': {
        'email': { 'type': 'string' },
        'name': { 'type': 'string' },
        'optional': { 'type': 'string' }
      },
      'required': [
        'email',
        'name'
      ],
      'type': 'object'
    }],
    'shapeId': 'https://example.com/MultiRequired'
  }
];

void describe('SHACL serialization: required vs optional minCount', () => {
  for (const {
    expectedMinCount, name, propPathFragment, schemas, shapeId
  } of shaclRequiredScenarios) {
    void it(name, () => {
      const reg = new SchemaRegistry();

      for (const schema of schemas) {
        reg.register(schema);
      }

      const shapes = shaclNodes(reg);

      const nodeShape = shapes.find((shape) => {
        return shape['@id'] === shapeId;
      });

      assert.ok(nodeShape !== undefined, `${name} — NodeShape exists`);

      const propShapes = nodeShape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];

      assert.ok(Array.isArray(propShapes), `${name} — sh:property exists`);

      const prop = propShapes.find((propShape) => {
        const path = propShape['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;

        return typeof path?.['@id'] === 'string' && (path['@id']).includes(propPathFragment);
      });

      assert.ok(prop !== undefined, `${name} — ${propPathFragment} prop exists`);

      if (expectedMinCount === undefined) {
        const minCount = prop['http://www.w3.org/ns/shacl#minCount'];

        assert.ok(
          minCount === undefined || minCount === 0,
          `${name} — minCount absent or 0`
        );
      } else {
        assert.strictEqual(prop['http://www.w3.org/ns/shacl#minCount'], expectedMinCount, `${name} — minCount ${expectedMinCount}`);
      }
    });
  }
});

// -------------------------------------------------------------------------
// Cross-cutting edge cases
// -------------------------------------------------------------------------

void describe('cross-cutting serialization edge cases', () => {
  void it('edge: schema with only $defs and no properties produces class but no property nodes', () => {
    const reg = new SchemaRegistry();

    reg.register({
      '$defs': {
        'Inner': {
          'properties': { 'x': { 'type': 'string' } },
          'type': 'object'
        }
      },
      '$id': 'https://example.com/DefsOnly',
      'type': 'object'
    });

    const owlOutput = owlNodes(reg);

    const classNode = owlOutput.find((node) => {
      return node['@id'] === 'https://example.com/DefsOnly'
        && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
    });

    assert.ok(classNode !== undefined, 'edge: $defs only — OWL class exists');

    const propNodes = owlOutput.filter((node) => {
      const domain = node['http://www.w3.org/2000/01/rdf-schema#domain'] as JsonLdNode | undefined;

      return domain?.['@id'] === 'https://example.com/DefsOnly';
    });

    assert.strictEqual(propNodes.length, 0, 'edge: $defs only — no direct property nodes');
  });

  void it('edge: readOnly and writeOnly on same property emits both annotations', () => {
    const reg = new SchemaRegistry();

    reg.register({
      '$id': 'https://example.com/BothAccess',
      'properties': {
        'token': {
          'readOnly': true,
          'type': 'string',
          'writeOnly': true
        }
      },
      'type': 'object'
    });

    const nodes = owlNodes(reg);

    const tokenProp = nodes.find((node) => {
      return node['@id'] === 'https://example.com/BothAccess#token';
    });

    assert.ok(tokenProp !== undefined, 'edge: both access — token prop exists');
    assert.strictEqual(tokenProp['http://datashapes.org/dash#readOnly'], true, 'edge: both access — readOnly');
    assert.strictEqual(tokenProp['http://datashapes.org/dash#writeOnly'], true, 'edge: both access — writeOnly');
  });

  void it('edge: schema with all constraint types combined serializes without error', () => {
    const reg = new SchemaRegistry();

    reg.register({
      '$id': 'https://example.com/AllConstraints',
      'additionalProperties': false,
      'enum': [
        'a',
        'b'
      ],
      'properties': {
        'count': {
          'exclusiveMaximum': 100,
          'exclusiveMinimum': 0,
          'multipleOf': 5,
          'type': 'integer'
        },
        'name': {
          'maxLength': 50,
          'minLength': 1,
          'pattern': '^[A-Z]',
          'type': 'string'
        }
      },
      'required': ['name'],
      'type': 'object'
    });

    const owlOutput = owlNodes(reg);
    const shaclOutput = shaclNodes(reg);

    assert.ok(owlOutput.length > 0, 'edge: all constraints — OWL output non-empty');
    assert.ok(shaclOutput.length > 0, 'edge: all constraints — SHACL output non-empty');

    const owlClass = owlOutput.find((node) => {
      return node['@id'] === 'https://example.com/AllConstraints'
        && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
    });

    assert.ok(owlClass !== undefined, 'edge: all constraints — OWL class exists');

    const shaclShape = shaclOutput.find((shape) => {
      return shape['@id'] === 'https://example.com/AllConstraints';
    });

    assert.ok(shaclShape !== undefined, 'edge: all constraints — SHACL shape exists');
  });

  void it('produces valid class/shape with no property shapes for empty schema', () => {
    const reg = new SchemaRegistry();

    reg.register({
      '$id': 'https://example.com/Empty',
      'type': 'object'
    });

    const owlOutput = owlNodes(reg);

    const owlClass = owlOutput.find((node) => {
      return node['@id'] === 'https://example.com/Empty'
        && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
    });

    assert.ok(owlClass !== undefined, 'empty schema — OWL class exists');

    const propNodes = owlOutput.filter((node) => {
      const type = node['@type'];

      return type === 'http://www.w3.org/2002/07/owl#DatatypeProperty'
        || type === 'http://www.w3.org/2002/07/owl#ObjectProperty';
    });

    const propsForEmpty = propNodes.filter((node) => {
      const domain = node['http://www.w3.org/2000/01/rdf-schema#domain'] as JsonLdNode | undefined;

      return domain?.['@id'] === 'https://example.com/Empty';
    });

    assert.strictEqual(propsForEmpty.length, 0, 'empty schema — no OWL property nodes');

    const shaclOutput = shaclNodes(reg);

    const shaclShape = shaclOutput.find((shape) => {
      return shape['@id'] === 'https://example.com/Empty';
    });

    assert.ok(shaclShape !== undefined, 'empty schema — SHACL shape exists');
    assert.strictEqual(shaclShape['@type'], 'http://www.w3.org/ns/shacl#NodeShape', 'empty schema — SHACL type');

    const shProperties = shaclShape['http://www.w3.org/ns/shacl#property'];

    assert.ok(
      shProperties === undefined || (Array.isArray(shProperties) && shProperties.length === 0),
      'empty schema — no SHACL property shapes'
    );
  });

  void it('uses full IRIs in all predicate keys, no CURIE shortcuts', () => {
    const reg = new SchemaRegistry();

    reg.register({
      '$id': 'https://example.com/FullIri',
      'properties': {
        'name': { 'type': 'string' },
        'ref': { '$ref': 'https://example.com/FullIri' }
      },
      'required': ['name'],
      'type': 'object'
    });

    const owlOutput = owlNodes(reg);
    const shaclOutput = shaclNodes(reg);

    const curiePattern = /^[a-z]+:[A-Za-z]/u;
    const allowedPrefixes = new Set([
      '@context',
      '@graph',
      '@id',
      '@list',
      '@type',
      '@value'
    ]);

    function assertNoShortCuries(nodes: JsonLdNode[], vocabulary: string): void {
      for (const node of nodes) {
        for (const key of Object.keys(node)) {
          if (allowedPrefixes.has(key)) {
            continue;
          }

          assert.ok(
            !curiePattern.test(key) || key.startsWith('http://') || key.startsWith('https://') || key.startsWith('urn:'),
            `${vocabulary} output must use full IRIs, found CURIE key: ${key}`
          );
        }
      }
    }

    assertNoShortCuries(owlOutput, 'OWL');
    assertNoShortCuries(shaclOutput, 'SHACL');
  });
});
