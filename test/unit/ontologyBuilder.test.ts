/**
 * Ontology Builder Tests
 */

import {
  describe, it
} from 'node:test';
import * as assert from 'node:assert';
import { OntologyBuilder } from '../../src/modules/ontology/OntologyBuilder.js';
import { GraphOntologySerializer } from '../../src/modules/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from '../../src/modules/ontology/GraphShaclSerializer.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

describe('OntologyBuilder', () => {
  it('constructs with prefixes, context, and empty graph', () => {
    const prefixes = {
      'ex': 'https://example.io/ns#',
      'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
    };

    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'graphSources': [],
      'prefixes': prefixes
    });

    assert.ok(builder);
    assert.deepStrictEqual(builder.context(), prefixes);
    assert.strictEqual(builder.raw().length, 0);
  });

  it('builds graph from static and function sources', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'graphSources': [
        [{
          '@id': 'ex:Thing',
          '@type': 'owl:Class',
          'rdfs:label': 'Thing'
        }],
        () => {
          return [{
            '@id': 'ex:SubThing',
            '@type': 'owl:Class',
            'rdfs:subClassOf': 'ex:Thing'
          }];
        }
      ],
      'prefixes': { 'ex': 'https://example.io/ns#' }
    });

    const graph = builder.raw();

    assert.strictEqual(graph.length, 2);
    assert.strictEqual(graph[0]['@id'], 'ex:Thing');
    assert.strictEqual(graph[1]['@id'], 'ex:SubThing');
  });

  it('generates JSON-LD as object and string', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'graphSources': [[{
        '@id': 'ex:Thing',
        '@type': 'owl:Class'
      }]],
      'prefixes': { 'ex': 'https://example.io/ns#' }
    });

    const jsonLd = builder.jsonLdObject();

    assert.ok(jsonLd['@context']);
    assert.ok(jsonLd['@graph']);
    assert.strictEqual(jsonLd['@graph'].length, 1);
    assert.ok(jsonLd['@id'].includes('ontology'));

    const jsonLdString = builder.jsonLd();

    assert.ok(typeof jsonLdString === 'string');
    const parsed = JSON.parse(jsonLdString);

    assert.ok(parsed['@context']);
    assert.ok(parsed['@graph']);
  });

  it('exposes JSON-LD-only output helpers', () => {
    const builder = new OntologyBuilder({
      'baseIRI': 'https://example.io',
      'graphSources': [],
      'prefixes': { 'ex': 'https://example.io/ns#' }
    });

    assert.strictEqual('n3' in builder, false);
    assert.strictEqual('shacl' in builder, false);
    assert.strictEqual(typeof builder.jsonLd, 'function');
    assert.strictEqual(typeof builder.jsonLdObject, 'function');
    assert.strictEqual(typeof builder.shaclObject, 'function');
  });
});

describe('GraphOntologySerializer', () => {
  function serializeSchema(schema: Record<string, unknown>): unknown[] {
    const graph = new SchemaGraph(schema);
    const serializer = new GraphOntologySerializer();

    return serializer.serialize([graph]);
  }

  it('serializes if/then/else as owl:unionOf(intersectionOf(A,B), intersectionOf(complementOf(A),C))', () => {
    const nodes = serializeSchema({
      '$id': 'https://example.com/Conditional',
      'else': { 'properties': { 'other': { 'type': 'number' } } },
      'if': { 'properties': { 'kind': { 'const': 'a' } } },
      'then': { 'properties': { 'value': { 'type': 'string' } } },
      'type': 'object'
    });

    const classNode = nodes.find((n: any) => {
      return n['@id'] === 'https://example.com/Conditional';
    }) as any;

    assert.ok(classNode, 'class node must exist');
    assert.strictEqual(classNode['jt:conditional'], undefined, 'jt:conditional must not be present');
    const subs = classNode['rdfs:subClassOf'] as any[];

    assert.ok(Array.isArray(subs), 'rdfs:subClassOf must exist');

    const unionSub = subs.find((s: any) => {
      return s['owl:unionOf'] !== undefined;
    });

    assert.ok(unionSub, 'owl:unionOf must exist');
    const branches = unionSub['owl:unionOf']['@list'] as any[];

    assert.strictEqual(branches.length, 2, 'must have then and else branches');

    assert.ok(branches[0]['owl:intersectionOf'], 'first branch must be intersection');
    assert.ok(branches[1]['owl:intersectionOf'], 'second branch must be intersection');
    const elseParts = branches[1]['owl:intersectionOf']['@list'] as any[];

    assert.ok(elseParts[0]['owl:complementOf'], 'else branch must negate the condition');
  });

  it('serializes contains as owl:someValuesFrom and prefixItems as rdf:_N restrictions', () => {
    const containsNodes = serializeSchema({
      '$id': 'https://example.com/Arr',
      'contains': { 'type': 'string' },
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' },
        { 'type': 'boolean' }
      ],
      'type': 'array'
    });

    const classNode = containsNodes.find((n: any) => {
      return n['@id'] === 'https://example.com/Arr';
    }) as any;

    assert.ok(classNode, 'class node must exist');

    const subs = classNode['rdfs:subClassOf'] as any[];

    assert.ok(Array.isArray(subs), 'rdfs:subClassOf must exist');

    // contains → owl:someValuesFrom
    assert.strictEqual(classNode['jt:contains'], undefined);
    const someRestriction = subs.find((r: any) => {
      return r['@type'] === 'owl:Restriction' && r['owl:someValuesFrom'] !== undefined;
    });

    assert.ok(someRestriction, 'owl:someValuesFrom restriction must exist');
    assert.deepStrictEqual(someRestriction['owl:someValuesFrom'], { '@id': 'xsd:string' });
    assert.deepStrictEqual(someRestriction['owl:onProperty'], { '@id': 'rdfs:member' });

    // prefixItems → rdf:_N restrictions
    assert.strictEqual(classNode['jt:tupleItem'], undefined);
    const r1 = subs.find((r: any) => {
      return r['owl:onProperty']?.['@id'] === 'rdf:_1';
    });
    const r2 = subs.find((r: any) => {
      return r['owl:onProperty']?.['@id'] === 'rdf:_2';
    });
    const r3 = subs.find((r: any) => {
      return r['owl:onProperty']?.['@id'] === 'rdf:_3';
    });

    assert.ok(r1, 'rdf:_1 restriction must exist');
    assert.deepStrictEqual(r1['owl:allValuesFrom'], { '@id': 'xsd:string' });
    assert.ok(r2, 'rdf:_2 restriction must exist');
    assert.deepStrictEqual(r2['owl:allValuesFrom'], { '@id': 'xsd:decimal' });
    assert.ok(r3, 'rdf:_3 restriction must exist');
    assert.deepStrictEqual(r3['owl:allValuesFrom'], { '@id': 'xsd:boolean' });
  });

  it('serializes dependentRequired and dependentSchemas as owl:unionOf implications', () => {
    const nodes = serializeSchema({
      '$id': 'https://example.com/Deps',
      'dependentRequired': {
        'email': [
          'name',
          'phone'
        ]
      },
      'dependentSchemas': {
        'billing': {
          'properties': { 'address': { 'type': 'string' } },
          'required': ['address']
        }
      },
      'properties': {
        'billing': { 'type': 'string' },
        'email': { 'type': 'string' },
        'name': { 'type': 'string' },
        'phone': { 'type': 'string' }
      },
      'type': 'object'
    });

    const classNode = nodes.find((n: any) => {
      return n['@id'] === 'https://example.com/Deps';
    }) as any;

    assert.ok(classNode, 'class node must exist');
    assert.strictEqual(classNode['jt:dependentRequired'], undefined);
    assert.strictEqual(classNode['jt:dependentSchema'], undefined);

    const subs = classNode['rdfs:subClassOf'] as any[];

    assert.ok(Array.isArray(subs), 'rdfs:subClassOf must exist');

    const implications = subs.filter((s: any) => {
      return s['owl:unionOf'] !== undefined;
    });

    assert.strictEqual(implications.length, 2, 'must have two implications');

    // dependentRequired: ¬hasEmail ∨ (hasName ∧ hasPhone)
    const depReq = implications.find((imp: any) => {
      const branches = imp['owl:unionOf']['@list'] as any[];
      const negated = branches[0]?.['owl:complementOf'];

      return negated?.['owl:onProperty']?.['@id']?.includes('email');
    });

    assert.ok(depReq, 'dependentRequired implication must exist');
    const reqBranches = depReq['owl:unionOf']['@list'] as any[];

    assert.ok(reqBranches[0]['owl:complementOf'], 'first branch must negate trigger');
    assert.strictEqual(reqBranches[0]['owl:complementOf']['@type'], 'owl:Restriction');
    assert.ok(reqBranches[1]['owl:intersectionOf'], 'second branch must intersect required props');

    // dependentSchemas: ¬hasBilling ∨ SchemaRef
    const depSchema = implications.find((imp: any) => {
      const branches = imp['owl:unionOf']['@list'] as any[];
      const negated = branches[0]?.['owl:complementOf'];

      return negated?.['owl:onProperty']?.['@id']?.includes('billing');
    });

    assert.ok(depSchema, 'dependentSchemas implication must exist');
    const schemaBranches = depSchema['owl:unionOf']['@list'] as any[];

    assert.ok(schemaBranches[0]['owl:complementOf'], 'first branch must negate trigger');
    assert.ok(schemaBranches[1]['@id'], 'second branch must be a class reference');
  });

  it('serializes patternProperties as standard OWL properties with sh:pattern', () => {
    const nodes = serializeSchema({
      '$id': 'https://example.com/PatternObj',
      'patternProperties': {
        '^I_': { 'type': 'integer' },
        '^S_': { 'type': 'string' }
      },
      'type': 'object'
    });

    const classNode = nodes.find((n: any) => {
      return n['@id'] === 'https://example.com/PatternObj';
    }) as any;

    assert.ok(classNode, 'class node must exist');
    assert.strictEqual(classNode['jt:patternProperty'], undefined);

    const stringProp = nodes.find((n: any) => {
      return n['@id']?.includes('^S_') && n['sh:pattern'] !== undefined;
    }) as any;

    assert.ok(stringProp, 'string pattern property must exist');
    assert.strictEqual(stringProp['@type'], 'owl:DatatypeProperty');
    assert.strictEqual(stringProp['sh:pattern'], '^S_');
    assert.deepStrictEqual(stringProp['rdfs:range'], { '@id': 'xsd:string' });
    assert.deepStrictEqual(stringProp['rdfs:domain'], { '@id': 'https://example.com/PatternObj' });

    const intProp = nodes.find((n: any) => {
      return n['@id']?.includes('^I_') && n['sh:pattern'] !== undefined;
    }) as any;

    assert.ok(intProp, 'integer pattern property must exist');
    assert.strictEqual(intProp['@type'], 'owl:DatatypeProperty');
    assert.strictEqual(intProp['sh:pattern'], '^I_');
    assert.deepStrictEqual(intProp['rdfs:range'], { '@id': 'xsd:integer' });
  });

  it('serializes array items as owl:allValuesFrom and omits jt:nullable', () => {
    const nodes = serializeSchema({
      '$id': 'https://example.com/StringList',
      'properties': {
        'name': {
          'type': [
            'string',
            'null'
          ]
        },
        'tags': {
          'items': { 'type': 'string' },
          'type': 'array'
        }
      },
      'type': 'object'
    });

    const classNode = nodes.find((n: any) => {
      return n['@id'] === 'https://example.com/StringList';
    }) as any;

    assert.ok(classNode, 'class node must exist');

    // owl:allValuesFrom restriction for array items
    const subs = classNode['rdfs:subClassOf'] as any[];

    assert.ok(Array.isArray(subs), 'rdfs:subClassOf must exist');
    const avf = subs.find((r: any) => {
      return r['owl:allValuesFrom'] !== undefined;
    });

    assert.ok(avf, 'owl:allValuesFrom restriction must exist');
    assert.ok(avf['owl:allValuesFrom']['@id'], 'allValuesFrom must have @id');
    assert.ok(avf['owl:onProperty']['@id'].includes('tags'));

    // No jt: extensions on any node
    for (const n of nodes as any[]) {
      assert.strictEqual(n['jt:itemType'], undefined, 'jt:itemType must not be present');
      assert.strictEqual(n['jt:nullable'], undefined, 'jt:nullable must not be present');
    }
  });

  it('emits title as rdfs:label and description as rdfs:comment on class nodes', () => {
    const nodes = serializeSchema({
      '$id': 'https://example.com/Annotated',
      'description': 'A described class',
      'properties': { 'name': { 'type': 'string' } },
      'title': 'My Annotated Class',
      'type': 'object'
    });

    const classNode = nodes.find((n: any) => {
      return n['@id'] === 'https://example.com/Annotated';
    }) as any;

    assert.ok(classNode, 'class node must exist');
    assert.strictEqual(classNode['rdfs:label'], 'My Annotated Class');
    assert.strictEqual(classNode['rdfs:comment'], 'A described class');
  });
});

describe('GraphShaclSerializer', () => {
  function serializeShaclSchema(schema: Record<string, unknown>): unknown[] {
    const graph = new SchemaGraph(schema);
    const serializer = new GraphShaclSerializer();

    return serializer.serialize([graph]);
  }

  it('emits sh:name on NodeShapes and PropertyShapes, omits validation-only keywords', () => {
    const shapes = serializeShaclSchema({
      '$dynamicAnchor': 'dyn',
      '$id': 'https://example.com/TitledShape',
      'discriminator': { 'propertyName': 'kind' },
      'properties': {
        'kind': { 'type': 'string' },
        'score': {
          'title': 'Score Field',
          'type': 'number'
        }
      },
      'title': 'Titled Shape',
      'type': 'object'
    });

    const shape = shapes.find((s: any) => {
      return s['@type'] === 'sh:NodeShape';
    }) as any;

    assert.ok(shape, 'NodeShape must exist');

    // sh:name on NodeShape from title
    assert.strictEqual(shape['sh:name'], 'Titled Shape');

    // sh:name on PropertyShape from property title
    const scoreProp = shape['sh:property'].find((p: any) => {
      return p['sh:path']?.['@id']?.includes('score');
    });

    assert.ok(scoreProp, 'score property shape must exist');
    assert.strictEqual(scoreProp['sh:name'], 'Score Field');

    // Validation-only keywords omitted
    assert.strictEqual(shape.$dynamicAnchor, undefined);
    assert.strictEqual(shape.discriminator, undefined);
  });

  it('emits sh:hasValue for const and sh:or implication for dependentRequired', () => {
    const shapes = serializeShaclSchema({
      '$id': 'https://example.com/ConstAndDeps',
      'dependentRequired': { 'email': ['name'] },
      'properties': {
        'email': { 'type': 'string' },
        'name': { 'type': 'string' },
        'status': {
          'const': 'active',
          'type': 'string'
        }
      },
      'type': 'object'
    });

    const shape = shapes.find((s: any) => {
      return s['@type'] === 'sh:NodeShape';
    }) as any;

    assert.ok(shape, 'NodeShape must exist');

    // sh:hasValue on const property
    const statusProp = shape['sh:property'].find((p: any) => {
      return p['sh:path']?.['@id']?.includes('status');
    });

    assert.ok(statusProp, 'status property shape must exist');
    assert.strictEqual(statusProp['sh:hasValue'], 'active');

    // dependentRequired as sh:or implication
    assert.strictEqual(shape['jt:dependentRequired'], undefined);
    assert.ok(shape['sh:and'], 'sh:and must exist');
    const andList = shape['sh:and']['@list'] as any[];
    const implication = andList.find((e: any) => {
      return e['sh:or'] !== undefined;
    });

    assert.ok(implication, 'sh:or implication must exist');
    const orList = implication['sh:or']['@list'] as any[];

    assert.strictEqual(orList.length, 2);
    assert.ok(orList[0]['sh:not'], 'first branch must negate trigger');
    assert.ok(orList[1]['sh:property'], 'second branch must require property');
  });

  it('serializes contains as sh:qualifiedValueShape with min/max counts', () => {
    const shapes = serializeShaclSchema({
      '$id': 'https://example.com/ContainsArr',
      'contains': { 'type': 'string' },
      'maxContains': 5,
      'minContains': 2,
      'type': 'array'
    });

    const shape = shapes.find((s: any) => {
      return s['@type'] === 'sh:NodeShape';
    }) as any;

    assert.ok(shape, 'NodeShape must exist');
    assert.strictEqual(shape['jt:contains'], undefined);

    const props = shape['sh:property'] as any[];

    assert.ok(Array.isArray(props), 'sh:property must exist');
    const qvs = props.find((p: any) => {
      return p['sh:qualifiedValueShape'] !== undefined;
    });

    assert.ok(qvs, 'sh:qualifiedValueShape entry must exist');
    assert.deepStrictEqual(qvs['sh:qualifiedValueShape'], { 'sh:datatype': { '@id': 'xsd:string' } });
    assert.strictEqual(qvs['sh:qualifiedMinCount'], 2);
    assert.strictEqual(qvs['sh:qualifiedMaxCount'], 5);
  });

  it('emits readOnly/writeOnly and contentMediaType in OWL serializer', () => {
    const serializer = new GraphOntologySerializer();
    const graph = new SchemaGraph({
      '$id': 'https://example.com/Access',
      'properties': {
        'id': {
          'readOnly': true,
          'type': 'string'
        },
        'payload': {
          'contentMediaType': 'application/json',
          'type': 'string'
        },
        'secret': {
          'type': 'string',
          'writeOnly': true
        }
      },
      'type': 'object'
    });

    const nodes = serializer.serialize([graph]);

    const idProp = nodes.find((n: any) => {
      return n['@id'] === 'https://example.com/Access#id';
    }) as any;

    assert.ok(idProp, 'id property must exist');
    assert.strictEqual(idProp['jsonschema:readOnly'], true);
    assert.strictEqual(idProp['jsonschema:writeOnly'], undefined);

    const secretProp = nodes.find((n: any) => {
      return n['@id'] === 'https://example.com/Access#secret';
    }) as any;

    assert.ok(secretProp, 'secret property must exist');
    assert.strictEqual(secretProp['jsonschema:writeOnly'], true);
    assert.strictEqual(secretProp['jsonschema:readOnly'], undefined);

    const payloadProp = nodes.find((n: any) => {
      return n['@id'] === 'https://example.com/Access#payload';
    }) as any;

    assert.ok(payloadProp, 'payload property must exist');
    assert.strictEqual(payloadProp['dct:format'], 'application/json');
  });
});
