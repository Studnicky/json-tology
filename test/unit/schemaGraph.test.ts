import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

function setSchemaKey(target: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  Reflect.set(target, key, value);

  return target;
}

const thenKeyword: string = String.fromCodePoint(116, 104, 101, 110);

function setThenKeyword(target: Record<string, unknown>, value: unknown): Record<string, unknown> {
  setSchemaKey(target, thenKeyword, value);

  return target;
}

void describe('SchemaGraph', () => {
  void it('lowers pointer-addressable schema nodes', () => {
    const schema = {
      '$defs': {
        'address': {
          'properties': { 'street/name': { 'type': 'string' } },
          'type': 'object'
        }
      },
      'properties': { 'address': { '$ref': '#/$defs/address' } },
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

  void it('indexes anchors and dynamic anchors as graph nodes', () => {
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

  void it('exposes graph relationships for object, array, and composition keywords', () => {
    const base: Record<string, unknown> = {
      'allOf': [{
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }],
      'contains': { 'type': 'number' },
      'if': {
        'properties': { 'kind': { 'const': 'person' } },
        'type': 'object'
      },
      'prefixItems': [{ 'type': 'string' }],
      'properties': { 'age': { 'type': 'number' } },
      'type': 'object',
      'unevaluatedProperties': false
    };

    setThenKeyword(base, {
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });
    const graph = new SchemaGraph(base);
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

  void it('exposes keyword values through graph semantics', () => {
    const schema = {
      'default': { 'name': 'guest' },
      'maxProperties': 3,
      'required': ['name'],
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;
    const sem = graph.semantics(root);

    assert.deepEqual(sem.schemaTypes, ['object']);
    assert.equal(sem.maxProperties, 3);
    assert.deepEqual(sem.required, ['name']);
    assert.deepEqual(sem.defaultValue, { 'name': 'guest' });
  });

  void it('reuses cached relationship lookups for graph nodes', () => {
    const schema = {
      'allOf': [{
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }],
      'properties': { 'age': { 'type': 'number' } },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;

    assert.equal(graph.child(root, 'properties'), graph.child(root, 'properties'));
    assert.equal(graph.entries(root, 'properties'), graph.entries(root, 'properties'));
    assert.equal(graph.indexedChildren(root, 'allOf'), graph.indexedChildren(root, 'allOf'));
  });

  void it('exposes cached semantic metadata for execution and ontology consumers', () => {
    const schema = {
      '$defs': {
        'Address': {
          '$dynamicAnchor': 'addressNode',
          'properties': { 'street': { 'type': 'string' } },
          'required': ['street'],
          'type': 'object'
        }
      },
      '$id': 'https://example.io/root',
      'dependentRequired': { 'name': ['address'] },
      'dependentSchemas': {
        'address': {
          'properties': { 'kind': { 'const': 'home' } },
          'type': 'object'
        }
      },
      'properties': {
        'address': { '$ref': '#/$defs/Address' },
        'name': { 'type': 'string' }
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
    assert.ok(rootSemantics.properties.has('address'));
    assert.ok(rootSemantics.properties.has('name'));
    const addressPropNode = rootSemantics.properties.get('address');

    assert.ok(addressPropNode !== undefined);
    assert.equal(addressPropNode.pointer, '/properties/address');
    assert.equal(addressPropNode.schema.$ref, '#/$defs/Address');
    assert.deepEqual(rootSemantics.dependentRequired, { 'name': ['address'] });
    assert.equal(rootSemantics.dependentSchemaEntries[0]?.[0], 'address');
    assert.equal(rootSemantics.dependentSchemaEntries[0]?.[1].pointer, '/dependentSchemas/address');
    assert.equal(addressSemantics.dynamicAnchor, 'addressNode');
    assert.deepEqual(addressSemantics.required, ['street']);
    assert.equal(graph.semantics(addressPropNode).refTargetNode?.id, 'https://example.io/root#/$defs/Address');
  });

  void it('populates constraint metadata fields from schema keywords', () => {
    const schema = {
      'additionalProperties': { 'type': 'string' },
      'description': 'Represents a person',
      'maxProperties': 10,
      'minProperties': 1,
      'not': { 'type': 'array' },
      'properties': {
        'age': {
          'exclusiveMaximum': 200,
          'exclusiveMinimum': -1,
          'maximum': 150,
          'minimum': 0,
          'multipleOf': 1,
          'type': 'number'
        },
        'bio': {
          'contentEncoding': 'base64',
          'contentMediaType': 'text/plain',
          'type': 'string'
        },
        'name': {
          'default': 'Anonymous',
          'format': 'custom-name',
          'maxLength': 100,
          'minLength': 1,
          'pattern': '^[A-Z]',
          'readOnly': true,
          'type': 'string'
        },
        'status': {
          'const': 'active',
          'deprecated': true,
          'enum': [
            'active',
            'inactive'
          ],
          'type': 'string',
          'writeOnly': true
        },
        'tags': {
          'maxItems': 10,
          'minItems': 1,
          'type': 'array',
          'uniqueItems': true
        }
      },
      'title': 'A Person',
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const rootSem = graph.semantics(graph.rootNode);

    assert.equal(rootSem.title, 'A Person');
    assert.equal(rootSem.description, 'Represents a person');
    assert.equal(rootSem.minProperties, 1);
    assert.equal(rootSem.maxProperties, 10);
    assert.equal(rootSem.notNode?.pointer, '/not');
    assert.equal(typeof rootSem.additionalPropertiesNode, 'object');
    assert.equal((rootSem.additionalPropertiesNode as { 'pointer': string }).pointer, '/additionalProperties');

    const nameNode = rootSem.properties.get('name');

    assert.ok(nameNode !== undefined);
    const nameSem = graph.semantics(nameNode);

    assert.equal(nameSem.minLength, 1);
    assert.equal(nameSem.maxLength, 100);
    assert.equal(nameSem.pattern, '^[A-Z]');
    assert.equal(nameSem.defaultValue, 'Anonymous');
    assert.equal(nameSem.hasDefault, true);
    assert.equal(nameSem.format, 'custom-name');
    assert.equal(nameSem.readOnly, true);
    assert.equal(nameSem.writeOnly, false);

    const ageNode = rootSem.properties.get('age');

    assert.ok(ageNode !== undefined);
    const ageSem = graph.semantics(ageNode);

    assert.equal(ageSem.minimum, 0);
    assert.equal(ageSem.maximum, 150);
    assert.equal(ageSem.exclusiveMinimum, -1);
    assert.equal(ageSem.exclusiveMaximum, 200);
    assert.equal(ageSem.multipleOf, 1);

    const tagsNode = rootSem.properties.get('tags');

    assert.ok(tagsNode !== undefined);
    const tagsSem = graph.semantics(tagsNode);

    assert.equal(tagsSem.minItems, 1);
    assert.equal(tagsSem.maxItems, 10);
    assert.equal(tagsSem.uniqueItems, true);

    const statusNode = rootSem.properties.get('status');

    assert.ok(statusNode !== undefined);
    const statusSem = graph.semantics(statusNode);

    assert.deepEqual(statusSem.enumValues, [
      'active',
      'inactive'
    ]);
    assert.equal(statusSem.constValue, 'active');
    assert.equal(statusSem.hasConst, true);
    assert.equal(statusSem.deprecated, true);
    assert.equal(statusSem.writeOnly, true);

    const bioNode = rootSem.properties.get('bio');

    assert.ok(bioNode !== undefined);
    const bioSem = graph.semantics(bioNode);

    assert.equal(bioSem.contentEncoding, 'base64');
    assert.equal(bioSem.contentMediaType, 'text/plain');
  });

  void it('uses default values for constraint fields on boolean schemas', () => {
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

  void it('handles additionalProperties as boolean false', () => {
    const schema = {
      'additionalProperties': false,
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const sem = graph.semantics(graph.rootNode);

    assert.equal(sem.additionalPropertiesNode, false);
  });

  void it('resolves local refs through canonical graph semantics', () => {
    const schema = {
      '$defs': {
        'Address': {
          '$anchor': 'address',
          'type': 'object'
        }
      },
      '$id': 'https://example.io/root',
      'properties': {
        'byAnchor': { '$ref': '#address' },
        'byPointer': { '$ref': '#/$defs/Address' },
        'self': { '$ref': '#' }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const rootSemantics = graph.semantics(graph.rootNode);
    const byAnchorNode = rootSemantics.properties.get('byAnchor');

    assert.ok(byAnchorNode !== undefined);
    const byPointerNode = rootSemantics.properties.get('byPointer');

    assert.ok(byPointerNode !== undefined);
    const selfNode = rootSemantics.properties.get('self');

    assert.ok(selfNode !== undefined);
    const byAnchor = graph.semantics(byAnchorNode);
    const byPointer = graph.semantics(byPointerNode);
    const self = graph.semantics(selfNode);

    assert.equal(byAnchor.refTargetNode?.id, 'https://example.io/root#/$defs/Address');
    assert.equal(byPointer.refTargetNode?.id, 'https://example.io/root#/$defs/Address');
    assert.equal(self.refTargetNode?.id, 'https://example.io/root');
  });

  void it('produces subClassOf relations from allOf', () => {
    const schema = {
      'allOf': [
        { 'type': 'object' as const },
        { 'type': 'object' as const }
      ],
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const subClassOfs = rels.filter((rel) => {
      return rel.predicate === 'rdfs:subClassOf';
    });

    assert.equal(subClassOfs.length, 2);
    assert.equal((subClassOfs[0].target as { 'pointer': string }).pointer, '/allOf/0');
    assert.equal((subClassOfs[1].target as { 'pointer': string }).pointer, '/allOf/1');
  });

  void it('produces equivalentClass relations from anyOf', () => {
    const schema = {
      'anyOf': [
        { 'type': 'string' as const },
        { 'type': 'number' as const }
      ]
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const eqs = rels.filter((rel) => {
      return rel.predicate === 'owl:equivalentClass';
    });

    assert.equal(eqs.length, 2);
    assert.equal((eqs[0].target as { 'pointer': string }).pointer, '/anyOf/0');
    assert.equal((eqs[1].target as { 'pointer': string }).pointer, '/anyOf/1');
  });

  void it('produces complementOf relation from not', () => {
    const schema = { 'not': { 'type': 'array' as const } };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const comps = rels.filter((rel) => {
      return rel.predicate === 'owl:complementOf';
    });

    assert.equal(comps.length, 1);
    assert.equal((comps[0].target as { 'pointer': string }).pointer, '/not');
  });

  void it('produces restriction relations from required properties', () => {
    const schema = {
      'properties': {
        'age': { 'type': 'number' as const },
        'name': { 'type': 'string' as const }
      },
      'required': [
        'name',
        'age'
      ],
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const restrictions = rels.filter((rel) => {
      return rel.predicate === 'owl:Restriction';
    });

    assert.equal(restrictions.length, 2);
    assert.equal((restrictions[0].metadata as Record<string, unknown>).minCardinality, 1);
    assert.equal((restrictions[0].target as { 'pointer': string }).pointer, '/properties/name');
    assert.equal((restrictions[1].target as { 'pointer': string }).pointer, '/properties/age');
  });

  void it('produces domain and range relations from rdfs annotations', () => {
    const schema = {
      'rdfs:domain': 'https://example.com/Person',
      'rdfs:range': 'http://www.w3.org/2001/XMLSchema#string',
      'type': 'string'
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);

    const domains = rels.filter((rel) => {
      return rel.predicate === 'rdfs:domain';
    });
    const ranges = rels.filter((rel) => {
      return rel.predicate === 'rdfs:range';
    });

    assert.equal(domains.length, 1);
    assert.equal(domains[0].target, 'https://example.com/Person');
    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].target, 'http://www.w3.org/2001/XMLSchema#string');
  });

  void it('produces memberOf relations from enum values', () => {
    const schema = {
      'enum': [
        'active',
        'inactive'
      ],
      'type': 'string' as const
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const members = rels.filter((rel) => {
      return rel.predicate === 'owl:oneOf';
    });

    assert.equal(members.length, 2);
    assert.equal(members[0].target, 'active');
    assert.equal(members[1].target, 'inactive');
  });

  void it('returns all relations across all nodes via allRelations', () => {
    const schema = {
      'properties': {
        'status': {
          'enum': [
            'on',
            'off'
          ],
          'type': 'string' as const
        }
      },
      'required': ['status'],
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const all = graph.allRelations();

    assert.ok(all.length >= 3);
    assert.ok(all.some((rel) => {
      return rel.predicate === 'owl:Restriction';
    }));
    assert.ok(all.some((rel) => {
      return rel.predicate === 'owl:oneOf';
    }));
  });

  void it('produces rdfs:label from title', () => {
    const schema = {
      'title': 'Person',
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const labels = rels.filter((rel) => {
      return rel.predicate === 'rdfs:label';
    });

    assert.equal(labels.length, 1);
    assert.equal(labels[0].target, 'Person');
  });

  void it('produces rdfs:comment from description', () => {
    const schema = {
      'description': 'A person',
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const comments = rels.filter((rel) => {
      return rel.predicate === 'rdfs:comment';
    });

    assert.equal(comments.length, 1);
    assert.equal(comments[0].target, 'A person');
  });

  void it('produces owl:deprecated from deprecated', () => {
    const schema = {
      'deprecated': true,
      'type': 'string' as const
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);

    assert.ok(rels.some((rel) => {
      return rel.predicate === 'owl:deprecated';
    }));
  });

  void it('produces owl:disjointWith from disjointWith', () => {
    const schema = {
      'disjointWith': 'https://example.com/Cat',
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const disjoints = rels.filter((rel) => {
      return rel.predicate === 'owl:disjointWith';
    });

    assert.equal(disjoints.length, 1);
    assert.equal(disjoints[0].target, 'https://example.com/Cat');
  });

  void it('produces owl:equivalentClass from equivalentTo', () => {
    const schema = {
      'equivalentTo': 'https://example.com/Human',
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const rels = graph.relations(graph.rootNode);
    const equivs = rels.filter((rel) => {
      return rel.predicate === 'owl:equivalentClass';
    });

    assert.equal(equivs.length, 1);
    assert.equal(equivs[0].target, 'https://example.com/Human');
  });

  void it('produces owl:inverseOf from inverseOf on properties', () => {
    const schema = {
      'properties': {
        'owns': {
          'inverseOf': 'https://example.com/Thing#ownedBy',
          'type': 'string' as const
        }
      },
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const propNode = graph.resolvePointer('/properties/owns');
    const rels = graph.relations(propNode);
    const inverses = rels.filter((rel) => {
      return rel.predicate === 'owl:inverseOf';
    });

    assert.equal(inverses.length, 1);
    assert.equal(inverses[0].target, 'https://example.com/Thing#ownedBy');
  });

  void it('produces owl:TransitiveProperty from transitive', () => {
    const schema = {
      'properties': {
        'ancestor': {
          'transitive': true,
          'type': 'string' as const
        }
      },
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const propNode = graph.resolvePointer('/properties/ancestor');
    const rels = graph.relations(propNode);

    assert.ok(rels.some((rel) => {
      return rel.predicate === 'owl:TransitiveProperty';
    }));
  });

  void it('produces owl:SymmetricProperty from symmetric', () => {
    const schema = {
      'properties': {
        'sibling': {
          'symmetric': true,
          'type': 'string' as const
        }
      },
      'type': 'object' as const
    };
    const graph = new SchemaGraph(schema);
    const propNode = graph.resolvePointer('/properties/sibling');
    const rels = graph.relations(propNode);

    assert.ok(rels.some((rel) => {
      return rel.predicate === 'owl:SymmetricProperty';
    }));
  });
});
