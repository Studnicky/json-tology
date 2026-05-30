import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import {
  Compose, JsonTology
} from '../../src/index.js';
import { isRestrictionRef } from '../../src/types/Restriction.js';

const PERSON_IRI = 'urn:example:Person';
const PARENT_IRI = 'urn:example:Person#parent';
const NAME_IRI = 'urn:example:Person#name';

// Restrictions author onProperty in the class-scoped form above, but the TBox
// projection resolves onProperty to the FLAT canonical predicate IRI (baseIRI +
// propertyName) so restrictions stay connected to the flat property declarations
// and ABox assertions. baseIRI is `urn:example`, so `parent`/`name` flatten to:
const PARENT_FLAT_IRI = 'urn:example/parent';
const NAME_FLAT_IRI = 'urn:example/name';

const OWL_RESTRICTION = 'http://www.w3.org/2002/07/owl#Restriction';
const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
const OWL_ALL_VALUES_FROM = 'http://www.w3.org/2002/07/owl#allValuesFrom';
const OWL_SOME_VALUES_FROM = 'http://www.w3.org/2002/07/owl#someValuesFrom';
const OWL_HAS_VALUE = 'http://www.w3.org/2002/07/owl#hasValue';
const OWL_CARDINALITY = 'http://www.w3.org/2002/07/owl#cardinality';
const OWL_MIN_CARDINALITY = 'http://www.w3.org/2002/07/owl#minCardinality';
const OWL_MAX_CARDINALITY = 'http://www.w3.org/2002/07/owl#maxCardinality';
const RDFS_SUB_CLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

type JsonLdNodeType = Record<string, unknown>;

function tboxNodes(schema: Record<string, unknown> & { '$id': string }): readonly JsonLdNodeType[] {
  const jt = JsonTology.create({
    'baseIRI': 'urn:example',
    'enableStrictGraph': false,
    'schemas': [schema] as const
  });

  return jt.toTbox().jsonLdObject()['@graph'] as readonly JsonLdNodeType[];
}

function isRestrictionNode(node: JsonLdNodeType): boolean {
  const typeValue = node['@type'];

  if (Array.isArray(typeValue)) {
    return (typeValue as string[]).includes(OWL_RESTRICTION);
  }

  return typeValue === OWL_RESTRICTION;
}

function collectRestrictionNodes(value: unknown, accumulator: JsonLdNodeType[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRestrictionNodes(item, accumulator);
    }

    return;
  }
  if (typeof value !== 'object' || value === null) {
    return;
  }
  const node = value as JsonLdNodeType;

  if (isRestrictionNode(node)) {
    accumulator.push(node);
  }

  for (const childValue of Object.values(node)) {
    collectRestrictionNodes(childValue, accumulator);
  }
}

function findRestrictionsOnProperty(
  nodes: readonly JsonLdNodeType[],
  onProperty: string
): readonly JsonLdNodeType[] {
  const all: JsonLdNodeType[] = [];

  for (const node of nodes) {
    collectRestrictionNodes(node, all);
  }

  return all.filter((node) => {
    const ref = node[OWL_ON_PROPERTY];

    if (typeof ref === 'object' && ref !== null) {
      return (ref as Record<string, unknown>)['@id'] === onProperty;
    }

    return false;
  });
}

function literalValue(node: JsonLdNodeType, predicate: string): unknown {
  const valueOrNode = node[predicate];

  if (typeof valueOrNode === 'object' && valueOrNode !== null) {
    const record = valueOrNode as Record<string, unknown>;

    return record['@value'] ?? record['@id'];
  }

  return valueOrNode;
}

void describe('Compose OWL restrictions', () => {
  void describe('factory methods', () => {
    void it('someValuesFrom returns a phantom-tagged restriction', () => {
      const restriction = Compose.someValuesFrom(PARENT_IRI, PERSON_IRI);

      assert.equal(isRestrictionRef(restriction), true);
      assert.equal(restriction['~jt:restriction'].kind, 'someValuesFrom');
      assert.equal(restriction['~jt:restriction'].onProperty, PARENT_IRI);
      assert.equal(restriction['~jt:restriction'].value, PERSON_IRI);
    });

    void it('allValuesFrom returns a phantom-tagged restriction', () => {
      const restriction = Compose.allValuesFrom(PARENT_IRI, PERSON_IRI);

      assert.equal(restriction['~jt:restriction'].kind, 'allValuesFrom');
    });

    void it('hasValue accepts string, number, boolean', () => {
      assert.equal(Compose.hasValue(NAME_IRI, 'Alice')['~jt:restriction'].value, 'Alice');
      assert.equal(Compose.hasValue(NAME_IRI, 42)['~jt:restriction'].value, 42);
      assert.equal(Compose.hasValue(NAME_IRI, true)['~jt:restriction'].value, true);
    });

    void it('cardinality / minCardinality / maxCardinality carry numeric values', () => {
      assert.equal(Compose.cardinality(PARENT_IRI, 2)['~jt:restriction'].kind, 'cardinality');
      assert.equal(Compose.cardinality(PARENT_IRI, 2)['~jt:restriction'].value, 2);
      assert.equal(Compose.minCardinality(PARENT_IRI, 1)['~jt:restriction'].kind, 'minCardinality');
      assert.equal(Compose.maxCardinality(PARENT_IRI, 5)['~jt:restriction'].kind, 'maxCardinality');
    });
  });

  void describe('Compose.subClassOf', () => {
    void it('attaches restriction to body schema as jt:restrictions', () => {
      const composed = Compose.subClassOf(
        Compose.cardinality(PARENT_IRI, 2),
        {
          '$id': 'urn:example:PersonWithTwoParents',
          'type': 'object'
        } as const
      );

      assert.equal((composed as Record<string, unknown>).$id, 'urn:example:PersonWithTwoParents');
      const restrictions = (composed as Record<string, unknown>)['jt:restrictions'];

      assert.equal(Array.isArray(restrictions), true);
      const list = restrictions as Array<Record<string, unknown>>;

      assert.equal(list.length, 1);
      assert.equal(list[0].kind, 'cardinality');
      assert.equal(list[0].onProperty, PARENT_IRI);
      assert.equal(list[0].value, 2);
    });

    void it('does not mutate the body schema', () => {
      const body = {
        '$id': 'urn:example:Body1',
        'type': 'object'
      } as const;
      const before = JSON.stringify(body);

      Compose.subClassOf(Compose.cardinality(PARENT_IRI, 2), body);
      assert.equal(JSON.stringify(body), before);
    });

    void it('appends to existing jt:restrictions when chained', () => {
      const first = Compose.subClassOf(
        Compose.minCardinality(PARENT_IRI, 1),
        {
          '$id': 'urn:example:Chain',
          'type': 'object'
        } as const
      );
      const second = Compose.subClassOf(
        Compose.maxCardinality(PARENT_IRI, 5),
        first as Record<string, unknown> & { readonly '$id': string }
      );
      const restrictions = (second as Record<string, unknown>)['jt:restrictions'];

      assert.equal((restrictions as unknown[]).length, 2);
    });
  });

  void describe('TBox emission', () => {
    void it('emits owl:Restriction with onProperty + cardinality literal', () => {
      const schema = Compose.subClassOf(
        Compose.cardinality(PARENT_IRI, 2),
        {
          '$id': 'urn:example:PersonExactly2Parents',
          'type': 'object'
        } as const
      );

      const nodes = tboxNodes(schema);
      const restrictions = findRestrictionsOnProperty(nodes, PARENT_FLAT_IRI);

      assert.equal(restrictions.length, 1, 'one owl:Restriction node emitted');
      assert.equal(literalValue(restrictions[0], OWL_CARDINALITY), 2);

      const classNode = nodes.find((node) => {
        return node['@id'] === 'urn:example:PersonExactly2Parents';
      });

      assert.notEqual(classNode, undefined);
      assert.notEqual(classNode?.[RDFS_SUB_CLASS_OF], undefined);
    });

    void it('emits owl:minCardinality and owl:maxCardinality', () => {
      const schema = Compose.subClassOf(
        Compose.minCardinality(PARENT_IRI, 1),
        Compose.subClassOf(
          Compose.maxCardinality(PARENT_IRI, 5),
          {
            '$id': 'urn:example:PersonRanged',
            'type': 'object'
          } as const
        )
      );
      const nodes = tboxNodes(schema);
      const restrictions = findRestrictionsOnProperty(nodes, PARENT_FLAT_IRI);

      assert.equal(restrictions.length, 2);

      const minNode = restrictions.find((restriction) => {
        return OWL_MIN_CARDINALITY in restriction;
      });
      const maxNode = restrictions.find((restriction) => {
        return OWL_MAX_CARDINALITY in restriction;
      });

      assert.notEqual(minNode, undefined);
      assert.equal(literalValue(minNode as JsonLdNodeType, OWL_MIN_CARDINALITY), 1);
      assert.notEqual(maxNode, undefined);
      assert.equal(literalValue(maxNode as JsonLdNodeType, OWL_MAX_CARDINALITY), 5);
    });

    void it('emits owl:someValuesFrom and owl:allValuesFrom with class IRIs', () => {
      const schema = Compose.subClassOf(
        Compose.someValuesFrom(PARENT_IRI, PERSON_IRI),
        Compose.subClassOf(
          Compose.allValuesFrom(PARENT_IRI, PERSON_IRI),
          {
            '$id': 'urn:example:PersonValues',
            'type': 'object'
          } as const
        )
      );
      const nodes = tboxNodes(schema);
      const restrictions = findRestrictionsOnProperty(nodes, PARENT_FLAT_IRI);

      const someNode = restrictions.find((restriction) => {
        return OWL_SOME_VALUES_FROM in restriction;
      });
      const allNode = restrictions.find((restriction) => {
        return OWL_ALL_VALUES_FROM in restriction;
      });

      assert.notEqual(someNode, undefined);
      assert.equal(literalValue(someNode as JsonLdNodeType, OWL_SOME_VALUES_FROM), PERSON_IRI);
      assert.notEqual(allNode, undefined);
      assert.equal(literalValue(allNode as JsonLdNodeType, OWL_ALL_VALUES_FROM), PERSON_IRI);
    });

    void it('emits owl:hasValue with literal datatype', () => {
      const schema = Compose.subClassOf(
        Compose.hasValue(NAME_IRI, 'Alice'),
        {
          '$id': 'urn:example:PersonAlice',
          'type': 'object'
        } as const
      );
      const nodes = tboxNodes(schema);
      const restrictions = findRestrictionsOnProperty(nodes, NAME_FLAT_IRI);

      assert.equal(restrictions.length, 1);
      assert.equal(literalValue(restrictions[0], OWL_HAS_VALUE), 'Alice');
    });
  });
});
