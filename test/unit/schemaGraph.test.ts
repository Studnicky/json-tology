import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

describe('SchemaGraph', () => {
  it('lowers pointer-addressable schema nodes', () => {
    const schema = {
      '$defs': {
        'address': {
          'properties': {
            'street/name': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      'properties': {
        'address': { '$ref': '#/$defs/address' }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);

    assert.equal(graph.rootNode.pointer, '');
    assert.deepEqual(
      graph.resolvePointer('/$defs/address').schema,
      schema.$defs.address
    );
    assert.deepEqual(
      graph.resolvePointer('/$defs/address/properties/street~1name').schema,
      schema.$defs.address.properties['street/name']
    );
  });

  it('indexes anchors and dynamic anchors as graph nodes', () => {
    const schema = {
      '$defs': {
        'anchored': {
          '$anchor': 'named',
          '$dynamicAnchor': 'dynamicNamed',
          'type': 'string'
        }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);

    assert.equal(graph.resolveFragment('named').pointer, '/$defs/anchored');
    assert.equal(graph.resolveFragment('dynamicNamed').pointer, '/$defs/anchored');
  });

  it('exposes graph relationships for object, array, and composition keywords', () => {
    const schema = {
      'allOf': [
        {
          'properties': {
            'name': { 'type': 'string' }
          },
          'type': 'object'
        }
      ],
      'contains': { 'type': 'number' },
      'if': {
        'properties': {
          'kind': { 'const': 'person' }
        },
        'type': 'object'
      },
      'prefixItems': [
        { 'type': 'string' }
      ],
      'properties': {
        'age': { 'type': 'number' }
      },
      'then': {
        'properties': {
          'name': { 'type': 'string' }
        },
        'type': 'object'
      },
      'type': 'object',
      'unevaluatedProperties': false
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;

    assert.equal(graph.entries(root, 'properties')[0]?.[0], 'age');
    assert.equal(graph.entries(root, 'properties')[0]?.[1].pointer, '/properties/age');
    assert.equal(graph.indexedChildren(root, 'prefixItems')[0]?.pointer, '/prefixItems/0');
    assert.equal(graph.indexedChildren(root, 'allOf')[0]?.pointer, '/allOf/0');
    assert.equal(graph.child(root, 'contains')?.pointer, '/contains');
    assert.equal(graph.child(root, 'if')?.pointer, '/if');
    assert.equal(graph.child(root, 'then')?.pointer, '/then');
    assert.equal(graph.child(root, 'unevaluatedProperties')?.pointer, '/unevaluatedProperties');
  });

  it('exposes keyword values through graph nodes', () => {
    const schema = {
      'default': { 'name': 'guest' },
      'maxProperties': 3,
      'required': ['name'],
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;

    assert.equal(graph.keywordValue(root, 'type'), 'object');
    assert.equal(graph.keywordValue(root, 'maxProperties'), 3);
    assert.deepEqual(graph.keywordValue(root, 'required'), ['name']);
    assert.deepEqual(graph.keywordValue(root, 'default'), { 'name': 'guest' });
  });

  it('reuses cached relationship lookups for graph nodes', () => {
    const schema = {
      'allOf': [
        {
          'properties': {
            'name': { 'type': 'string' }
          },
          'type': 'object'
        }
      ],
      'properties': {
        'age': { 'type': 'number' }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;

    assert.equal(graph.child(root, 'properties'), graph.child(root, 'properties'));
    assert.equal(graph.entries(root, 'properties'), graph.entries(root, 'properties'));
    assert.equal(graph.indexedChildren(root, 'allOf'), graph.indexedChildren(root, 'allOf'));
  });

  it('exposes cached semantic metadata for execution and ontology consumers', () => {
    const schema = {
      '$id': 'https://example.io/root',
      '$defs': {
        'Address': {
          '$dynamicAnchor': 'addressNode',
          'properties': {
            'street': { 'type': 'string' }
          },
          'required': ['street'],
          'type': 'object'
        }
      },
      'properties': {
        'address': {
          '$ref': '#/$defs/Address'
        },
        'name': { 'type': 'string' }
      },
      'dependentRequired': {
        'name': ['address']
      },
      'dependentSchemas': {
        'address': {
          'properties': {
            'kind': { 'const': 'home' }
          },
          'type': 'object'
        }
      },
      'required': ['name'],
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;
    const rootSemantics = graph.semantics(root);
    const addressSemantics = graph.semantics(graph.resolvePointer('/$defs/Address'));

    assert.equal(graph.semantics(root), rootSemantics);
    assert.deepEqual(rootSemantics.required, ['name']);
    assert.deepEqual(rootSemantics.schemaTypes, ['object']);
    assert.equal(rootSemantics.properties[0]?.[0], 'address');
    assert.equal(rootSemantics.properties[1]?.[0], 'name');
    assert.equal(rootSemantics.properties[0]?.[1].pointer, '/properties/address');
    assert.equal(rootSemantics.properties[0]?.[1].schema.$ref, '#/$defs/Address');
    assert.deepEqual(rootSemantics.dependentRequired, { 'name': ['address'] });
    assert.equal(rootSemantics.dependentSchemaEntries[0]?.[0], 'address');
    assert.equal(rootSemantics.dependentSchemaEntries[0]?.[1].pointer, '/dependentSchemas/address');
    assert.equal(addressSemantics.dynamicAnchor, 'addressNode');
    assert.deepEqual(addressSemantics.required, ['street']);
    assert.equal(rootSemantics.properties[0]?.[1] && graph.semantics(rootSemantics.properties[0][1]).refTargetNode?.id, 'https://example.io/root#/$defs/Address');
  });

  it('populates constraint metadata fields from schema keywords', () => {
    const schema = {
      'title': 'A Person',
      'description': 'Represents a person',
      'type': 'object',
      'properties': {
        'name': {
          'type': 'string',
          'minLength': 1,
          'maxLength': 100,
          'pattern': '^[A-Z]',
          'default': 'Anonymous',
          'format': 'custom-name',
          'readOnly': true
        },
        'age': {
          'type': 'number',
          'minimum': 0,
          'maximum': 150,
          'exclusiveMinimum': -1,
          'exclusiveMaximum': 200,
          'multipleOf': 1
        },
        'tags': {
          'type': 'array',
          'minItems': 1,
          'maxItems': 10,
          'uniqueItems': true
        },
        'status': {
          'type': 'string',
          'enum': ['active', 'inactive'],
          'const': 'active',
          'deprecated': true,
          'writeOnly': true
        },
        'bio': {
          'type': 'string',
          'contentEncoding': 'base64',
          'contentMediaType': 'text/plain'
        }
      },
      'minProperties': 1,
      'maxProperties': 10,
      'additionalProperties': { 'type': 'string' },
      'not': { 'type': 'array' }
    } as const;
    const graph = new SchemaGraph(schema);
    const rootSem = graph.semantics(graph.rootNode);

    assert.equal(rootSem.title, 'A Person');
    assert.equal(rootSem.description, 'Represents a person');
    assert.equal(rootSem.minProperties, 1);
    assert.equal(rootSem.maxProperties, 10);
    assert.equal(rootSem.notNode?.pointer, '/not');
    assert.equal(typeof rootSem.additionalPropertiesNode, 'object');
    assert.equal((rootSem.additionalPropertiesNode as { pointer: string }).pointer, '/additionalProperties');

    const nameSem = graph.semantics(rootSem.properties[0][1]);
    assert.equal(nameSem.minLength, 1);
    assert.equal(nameSem.maxLength, 100);
    assert.equal(nameSem.pattern, '^[A-Z]');
    assert.equal(nameSem.defaultValue, 'Anonymous');
    assert.equal(nameSem.hasDefault, true);
    assert.equal(nameSem.format, 'custom-name');
    assert.equal(nameSem.readOnly, true);
    assert.equal(nameSem.writeOnly, false);

    const ageSem = graph.semantics(rootSem.properties[1][1]);
    assert.equal(ageSem.minimum, 0);
    assert.equal(ageSem.maximum, 150);
    assert.equal(ageSem.exclusiveMinimum, -1);
    assert.equal(ageSem.exclusiveMaximum, 200);
    assert.equal(ageSem.multipleOf, 1);

    const tagsSem = graph.semantics(rootSem.properties[2][1]);
    assert.equal(tagsSem.minItems, 1);
    assert.equal(tagsSem.maxItems, 10);
    assert.equal(tagsSem.uniqueItems, true);

    const statusSem = graph.semantics(rootSem.properties[3][1]);
    assert.deepEqual(statusSem.enumValues, ['active', 'inactive']);
    assert.equal(statusSem.constValue, 'active');
    assert.equal(statusSem.hasConst, true);
    assert.equal(statusSem.deprecated, true);
    assert.equal(statusSem.writeOnly, true);

    const bioSem = graph.semantics(rootSem.properties[4][1]);
    assert.equal(bioSem.contentEncoding, 'base64');
    assert.equal(bioSem.contentMediaType, 'text/plain');
  });

  it('uses default values for constraint fields on boolean schemas', () => {
    const graph = new SchemaGraph(true);
    const sem = graph.semantics(graph.rootNode);

    assert.equal(sem.title, undefined);
    assert.equal(sem.description, undefined);
    assert.equal(sem.format, undefined);
    assert.equal(sem.defaultValue, undefined);
    assert.equal(sem.hasDefault, false);
    assert.equal(sem.constValue, undefined);
    assert.equal(sem.hasConst, false);
    assert.equal(sem.enumValues, undefined);
    assert.equal(sem.minimum, undefined);
    assert.equal(sem.maximum, undefined);
    assert.equal(sem.uniqueItems, false);
    assert.equal(sem.additionalPropertiesNode, undefined);
    assert.equal(sem.notNode, undefined);
    assert.equal(sem.readOnly, false);
    assert.equal(sem.writeOnly, false);
    assert.equal(sem.deprecated, false);
  });

  it('handles additionalProperties as boolean false', () => {
    const schema = {
      'type': 'object',
      'additionalProperties': false
    } as const;
    const graph = new SchemaGraph(schema);
    const sem = graph.semantics(graph.rootNode);

    assert.equal(sem.additionalPropertiesNode, false);
  });

  it('resolves local refs through canonical graph semantics', () => {
    const schema = {
      '$id': 'https://example.io/root',
      '$defs': {
        'Address': {
          '$anchor': 'address',
          'type': 'object'
        }
      },
      'properties': {
        'byAnchor': { '$ref': '#address' },
        'byPointer': { '$ref': '#/$defs/Address' },
        'self': { '$ref': '#' }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const rootSemantics = graph.semantics(graph.rootNode);
    const byAnchor = graph.semantics(rootSemantics.properties[0][1]);
    const byPointer = graph.semantics(rootSemantics.properties[1][1]);
    const self = graph.semantics(rootSemantics.properties[2][1]);

    assert.equal(byAnchor.refTargetNode?.id, 'https://example.io/root#/$defs/Address');
    assert.equal(byPointer.refTargetNode?.id, 'https://example.io/root#/$defs/Address');
    assert.equal(self.refTargetNode?.id, 'https://example.io/root');
  });

  it('produces subClassOf relations from allOf', () => {
    const schema = {
      'allOf': [
        { 'type': 'object' as const },
        { 'type': 'object' as const }
      ],
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const subClassOfs = rels.filter(r => r.predicate === 'rdfs:subClassOf');

    assert.equal(subClassOfs.length, 2);
    assert.equal((subClassOfs[0].target as { pointer: string }).pointer, '/allOf/0');
    assert.equal((subClassOfs[1].target as { pointer: string }).pointer, '/allOf/1');
  });

  it('produces equivalentClass relations from anyOf', () => {
    const schema = {
      'anyOf': [
        { 'type': 'string' as const },
        { 'type': 'number' as const }
      ]
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const eqs = rels.filter(r => r.predicate === 'owl:equivalentClass');

    assert.equal(eqs.length, 2);
    assert.equal((eqs[0].target as { pointer: string }).pointer, '/anyOf/0');
    assert.equal((eqs[1].target as { pointer: string }).pointer, '/anyOf/1');
  });

  it('produces complementOf relation from not', () => {
    const schema = {
      'not': { 'type': 'array' as const }
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const comps = rels.filter(r => r.predicate === 'owl:complementOf');

    assert.equal(comps.length, 1);
    assert.equal((comps[0].target as { pointer: string }).pointer, '/not');
  });

  it('produces restriction relations from required properties', () => {
    const schema = {
      'type': 'object' as const,
      'properties': {
        'name': { 'type': 'string' as const },
        'age': { 'type': 'number' as const }
      },
      'required': ['name', 'age']
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const restrictions = rels.filter(r => r.predicate === 'owl:Restriction');

    assert.equal(restrictions.length, 2);
    assert.equal((restrictions[0].metadata as Record<string, unknown>).minCardinality, 1);
    assert.equal((restrictions[0].target as { pointer: string }).pointer, '/properties/name');
    assert.equal((restrictions[1].target as { pointer: string }).pointer, '/properties/age');
  });

  it('produces domain and range relations from rdfs annotations', () => {
    const schema = {
      'type': 'string',
      'rdfs:domain': 'https://example.com/Person',
      'rdfs:range': 'http://www.w3.org/2001/XMLSchema#string'
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);

    const domains = rels.filter(r => r.predicate === 'rdfs:domain');
    const ranges = rels.filter(r => r.predicate === 'rdfs:range');

    assert.equal(domains.length, 1);
    assert.equal(domains[0].target, 'https://example.com/Person');
    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].target, 'http://www.w3.org/2001/XMLSchema#string');
  });

  it('produces memberOf relations from enum values', () => {
    const schema = {
      'type': 'string' as const,
      'enum': ['active', 'inactive']
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const members = rels.filter(r => r.predicate === 'owl:oneOf');

    assert.equal(members.length, 2);
    assert.equal(members[0].target, 'active');
    assert.equal(members[1].target, 'inactive');
  });

  it('returns all relations across all nodes via allRelations', () => {
    const schema = {
      'type': 'object' as const,
      'properties': {
        'status': {
          'type': 'string' as const,
          'enum': ['on', 'off']
        }
      },
      'required': ['status']
    };
    const graph = new SchemaGraph(schema);
    const all = graph.allRelations();

    assert.ok(all.length >= 3);
    assert.ok(all.some(r => r.predicate === 'owl:Restriction'));
    assert.ok(all.some(r => r.predicate === 'owl:oneOf'));
  });

  it('produces rdfs:label from title', () => {
    const schema = { 'type': 'object' as const, 'title': 'Person' };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const labels = rels.filter(r => r.predicate === 'rdfs:label');

    assert.equal(labels.length, 1);
    assert.equal(labels[0].target, 'Person');
  });

  it('produces rdfs:comment from description', () => {
    const schema = { 'type': 'object' as const, 'description': 'A person' };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const comments = rels.filter(r => r.predicate === 'rdfs:comment');

    assert.equal(comments.length, 1);
    assert.equal(comments[0].target, 'A person');
  });

  it('produces owl:deprecated from deprecated', () => {
    const schema = { 'type': 'string' as const, 'deprecated': true };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);

    assert.ok(rels.some(r => r.predicate === 'owl:deprecated'));
  });

  it('produces owl:disjointWith from disjointWith', () => {
    const schema = {
      'type': 'object' as const,
      'disjointWith': 'https://example.com/Cat'
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const disjoints = rels.filter(r => r.predicate === 'owl:disjointWith');

    assert.equal(disjoints.length, 1);
    assert.equal(disjoints[0].target, 'https://example.com/Cat');
  });

  it('produces owl:equivalentClass from equivalentTo', () => {
    const schema = {
      'type': 'object' as const,
      'equivalentTo': 'https://example.com/Human'
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const equivs = rels.filter(r => r.predicate === 'owl:equivalentClass');

    assert.equal(equivs.length, 1);
    assert.equal(equivs[0].target, 'https://example.com/Human');
  });

  it('produces owl:inverseOf from inverseOf on properties', () => {
    const schema = {
      'type': 'object' as const,
      'properties': {
        'owns': {
          'type': 'string' as const,
          'inverseOf': 'https://example.com/Thing#ownedBy'
        }
      }
    };
    const graph = new SchemaGraph(schema);
    const propNode = graph.resolvePointer('/properties/owns');
    const rels = graph.relations(propNode);
    const inverses = rels.filter(r => r.predicate === 'owl:inverseOf');

    assert.equal(inverses.length, 1);
    assert.equal(inverses[0].target, 'https://example.com/Thing#ownedBy');
  });

  it('produces owl:TransitiveProperty from transitive', () => {
    const schema = {
      'type': 'object' as const,
      'properties': {
        'ancestor': {
          'type': 'string' as const,
          'transitive': true
        }
      }
    };
    const graph = new SchemaGraph(schema);
    const propNode = graph.resolvePointer('/properties/ancestor');
    const rels = graph.relations(propNode);

    assert.ok(rels.some(r => r.predicate === 'owl:TransitiveProperty'));
  });

  it('produces owl:SymmetricProperty from symmetric', () => {
    const schema = {
      'type': 'object' as const,
      'properties': {
        'sibling': {
          'type': 'string' as const,
          'symmetric': true
        }
      }
    };
    const graph = new SchemaGraph(schema);
    const propNode = graph.resolvePointer('/properties/sibling');
    const rels = graph.relations(propNode);

    assert.ok(rels.some(r => r.predicate === 'owl:SymmetricProperty'));
  });
});
