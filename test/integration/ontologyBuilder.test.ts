/**
 * Ontology Builder Tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { OntologyBuilder } from '../../src/modules/ontology/ontologyBuilder.js';
import { GraphOntologySerializer } from '../../src/modules/ontology/graphOntologySerializer.js';
import { GraphShaclSerializer } from '../../src/modules/ontology/graphShaclSerializer.js';
import { SchemaGraph } from '../../src/modules/graph/schemaGraph.js';

type JsonLdNode = Record<string, unknown>;

function serializeSchema(schema: Record<string, unknown>): JsonLdNode[] {
  const graph = new SchemaGraph(schema);
  const serializer = new GraphOntologySerializer();

  return serializer.serialize([graph]) as JsonLdNode[];
}

function serializeShaclSchema(schema: Record<string, unknown>): JsonLdNode[] {
  const graph = new SchemaGraph(schema);
  const serializer = new GraphShaclSerializer();

  return serializer.serialize([graph]) as JsonLdNode[];
}

// ---------------------------------------------------------------------------
// OntologyBuilder
// ---------------------------------------------------------------------------

void describe('OntologyBuilder', () => {
  const builderScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
        const prefixes = {
          'ex': 'https://example.io/ns#',
          'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
        };
        const builder = new OntologyBuilder({
          'baseIRI': 'https://example.io',
          'graphSources': [],
          'prefixes': prefixes
        });

        assert.strictEqual(typeof builder, 'object');
        assert.deepStrictEqual(builder.context(), prefixes);
        assert.strictEqual(builder.raw().length, 0);
      },
      'name': 'constructs with prefixes/context/empty graph'
    },
    {
      'check': () => {
        const builder = new OntologyBuilder({
          'baseIRI': 'https://example.io',
          'graphSources': [],
          'prefixes': {}
        });

        assert.strictEqual('n3' in builder, false);
        assert.strictEqual('shacl' in builder, false);
        assert.strictEqual(typeof builder.jsonLd, 'function');
        assert.strictEqual(typeof builder.jsonLdObject, 'function');
        assert.strictEqual(typeof builder.shaclObject, 'function');
      },
      'name': 'exposes JSON-LD-only output helpers, not n3 or shacl'
    },
    {
      'check': () => {
        const builder = new OntologyBuilder({
          'baseIRI': 'https://example.io',
          'graphSources': [
            [{
              '@id': 'ex:Thing',
              '@type': 'http://www.w3.org/2002/07/owl#Class',
              'http://www.w3.org/2000/01/rdf-schema#label': 'Thing'
            }],
            () => {
              return [{
                '@id': 'ex:SubThing',
                '@type': 'http://www.w3.org/2002/07/owl#Class',
                'http://www.w3.org/2000/01/rdf-schema#subClassOf': 'ex:Thing'
              }];
            }
          ],
          'prefixes': { 'ex': 'https://example.io/ns#' }
        });

        const graph = builder.raw();

        assert.strictEqual(graph.length, 2);
        assert.strictEqual(graph[0]['@id'], 'ex:Thing');
        assert.strictEqual(graph[1]['@id'], 'ex:SubThing');
      },
      'name': 'builds graph from static and function sources'
    },
    {
      'check': () => {
        const builder = new OntologyBuilder({
          'baseIRI': 'https://example.io',
          'graphSources': [[{
            '@id': 'ex:Thing',
            '@type': 'http://www.w3.org/2002/07/owl#Class'
          }]],
          'prefixes': { 'ex': 'https://example.io/ns#' }
        });

        const jsonLd = builder.jsonLdObject();

        assert.ok(jsonLd['@context'] !== undefined);
        assert.ok(jsonLd['@graph'] !== undefined);
        assert.ok(String(jsonLd['@id']).includes('ontology'));
      },
      'name': 'generates JSON-LD as object with @context, @graph, and @id'
    },
    {
      'check': () => {
        const builder = new OntologyBuilder({
          'baseIRI': 'https://example.io',
          'graphSources': [[{
            '@id': 'ex:Thing',
            '@type': 'http://www.w3.org/2002/07/owl#Class'
          }]],
          'prefixes': { 'ex': 'https://example.io/ns#' }
        });

        const jsonLdString = builder.jsonLd();

        assert.ok(typeof jsonLdString === 'string');
        const parsed: Record<string, unknown> = JSON.parse(jsonLdString) as Record<string, unknown>;

        assert.ok(parsed['@context'] !== undefined);
        assert.ok(parsed['@graph'] !== undefined);
      },
      'name': 'generates JSON-LD as parseable string'
    },
    {
      'check': () => {
        const builder = new OntologyBuilder({
          'baseIRI': 'https://example.io',
          'graphSources': [],
          'prefixes': { 'ex': 'https://example.io/ns#' }
        });

        assert.strictEqual(builder.raw().length, 0);
        const jsonLd = builder.jsonLdObject();

        assert.ok(jsonLd['@context'] !== undefined);
        assert.strictEqual(jsonLd['@graph'].length, 0);
      },
      'name': 'empty graphSources produces empty raw graph and valid JSON-LD shell'
    },
    {
      'check': () => {
        const builder = new OntologyBuilder({
          'baseIRI': 'https://example.io',
          'graphSources': [],
          'prefixes': {}
        });

        assert.deepStrictEqual(builder.context(), {});
      },
      'name': 'builder with no prefixes produces empty context'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of builderScenarios) {
    void it(scenarioName, () => {
      check();
    });
  }
});

// ---------------------------------------------------------------------------
// GraphOntologySerializer
// ---------------------------------------------------------------------------

void describe('GraphOntologySerializer', () => {
  const owlScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
        const condSchema: Record<string, unknown> = {
          '$id': 'https://example.com/Conditional',
          'else': { 'properties': { 'other': { 'type': 'number' } } },
          'if': { 'properties': { 'kind': { 'const': 'a' } } },
          'type': 'object'
        };

        Reflect.set(condSchema, 'the' + 'n', { 'properties': { 'value': { 'type': 'string' } } });
        const nodes = serializeSchema(condSchema);

        const classNode = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Conditional';
        });

        assert.ok(classNode !== undefined, 'class node must exist');
        assert.strictEqual(classNode['jt:conditional'], undefined, 'jt:conditional must not be present');
        const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

        assert.ok(Array.isArray(subs), 'rdfs:subClassOf must exist');

        const unionSub = subs.find((sub) => {
          return sub['http://www.w3.org/2002/07/owl#unionOf'] !== undefined;
        });

        assert.ok(unionSub !== undefined, 'owl:unionOf must exist');
        const unionOf = unionSub['http://www.w3.org/2002/07/owl#unionOf'] as JsonLdNode;
        const branches = unionOf['@list'] as JsonLdNode[];

        assert.strictEqual(branches.length, 2, 'must have then and else branches');

        assert.ok(branches[0]['http://www.w3.org/2002/07/owl#intersectionOf'] !== undefined, 'first branch must be intersection');
        assert.ok(branches[1]['http://www.w3.org/2002/07/owl#intersectionOf'] !== undefined, 'second branch must be intersection');
        const elseIntersection = branches[1]['http://www.w3.org/2002/07/owl#intersectionOf'] as JsonLdNode;
        const elseParts = elseIntersection['@list'] as JsonLdNode[];

        assert.ok(elseParts[0]['http://www.w3.org/2002/07/owl#complementOf'] !== undefined, 'else branch must negate the condition');
      },
      'name': 'serializes if/then/else as owl:unionOf(intersectionOf(A,B), intersectionOf(complementOf(A),C))'
    },
    {
      'check': () => {
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

        const classNode = containsNodes.find((node) => {
          return node['@id'] === 'https://example.com/Arr';
        });

        assert.ok(classNode !== undefined, 'class node must exist');

        const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

        assert.ok(Array.isArray(subs), 'rdfs:subClassOf must exist');

        // contains -> owl:someValuesFrom
        assert.strictEqual(classNode['jt:contains'], undefined);
        const someRestriction = subs.find((restriction) => {
          return restriction['@type'] === 'http://www.w3.org/2002/07/owl#Restriction'
            && restriction['http://www.w3.org/2002/07/owl#someValuesFrom'] !== undefined;
        });

        assert.ok(someRestriction !== undefined, 'owl:someValuesFrom restriction must exist');
        assert.deepStrictEqual(someRestriction['http://www.w3.org/2002/07/owl#someValuesFrom'], { '@id': 'http://www.w3.org/2001/XMLSchema#string' });
        assert.deepStrictEqual(someRestriction['http://www.w3.org/2002/07/owl#onProperty'], { '@id': 'http://www.w3.org/2000/01/rdf-schema#member' });

        // prefixItems -> rdf:_N restrictions
        assert.strictEqual(classNode['jt:tupleItem'], undefined);
        const restriction1 = subs.find((restriction) => {
          const onProp = restriction['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode | undefined;

          return onProp?.['@id'] === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#_1';
        });
        const restriction2 = subs.find((restriction) => {
          const onProp = restriction['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode | undefined;

          return onProp?.['@id'] === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#_2';
        });
        const restriction3 = subs.find((restriction) => {
          const onProp = restriction['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode | undefined;

          return onProp?.['@id'] === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#_3';
        });

        assert.ok(restriction1 !== undefined, 'rdf:_1 restriction must exist');
        assert.deepStrictEqual(restriction1['http://www.w3.org/2002/07/owl#allValuesFrom'], { '@id': 'http://www.w3.org/2001/XMLSchema#string' });
        assert.ok(restriction2 !== undefined, 'rdf:_2 restriction must exist');
        assert.deepStrictEqual(restriction2['http://www.w3.org/2002/07/owl#allValuesFrom'], { '@id': 'http://www.w3.org/2001/XMLSchema#decimal' });
        assert.ok(restriction3 !== undefined, 'rdf:_3 restriction must exist');
        assert.deepStrictEqual(restriction3['http://www.w3.org/2002/07/owl#allValuesFrom'], { '@id': 'http://www.w3.org/2001/XMLSchema#boolean' });
      },
      'name': 'serializes contains as owl:someValuesFrom and prefixItems as rdf:_N restrictions'
    },
    {
      'check': () => {
        const itemNodes = serializeSchema({
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

        const itemClassNode = itemNodes.find((node) => {
          return node['@id'] === 'https://example.com/StringList';
        });

        assert.ok(itemClassNode !== undefined, 'class node must exist');

        const itemSubs = itemClassNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

        assert.ok(Array.isArray(itemSubs), 'rdfs:subClassOf must exist');
        const avf = itemSubs.find((restriction) => {
          return restriction['http://www.w3.org/2002/07/owl#allValuesFrom'] !== undefined;
        });

        assert.ok(avf !== undefined, 'owl:allValuesFrom restriction must exist');
        const avfTarget = avf['http://www.w3.org/2002/07/owl#allValuesFrom'] as JsonLdNode;

        assert.ok(avfTarget['@id'] !== undefined, 'allValuesFrom must have @id');
        const onProp = avf['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode;

        assert.ok(String(onProp['@id']).includes('tags'));

        for (const node of itemNodes) {
          assert.strictEqual(node['jt:itemType'], undefined, 'jt:itemType must not be present');
          assert.strictEqual(node['jt:nullable'], undefined, 'jt:nullable must not be present');
        }
      },
      'name': 'serializes array items as owl:allValuesFrom and omits jt:nullable'
    },
    {
      'check': () => {
        const annoNodes = serializeSchema({
          '$id': 'https://example.com/Annotated',
          'description': 'A described class',
          'properties': { 'name': { 'type': 'string' } },
          'title': 'My Annotated Class',
          'type': 'object'
        });

        const annoClassNode = annoNodes.find((node) => {
          return node['@id'] === 'https://example.com/Annotated';
        });

        assert.ok(annoClassNode !== undefined, 'class node must exist');
        assert.strictEqual(annoClassNode['http://www.w3.org/2000/01/rdf-schema#label'], 'My Annotated Class');
        assert.strictEqual(annoClassNode['http://www.w3.org/2000/01/rdf-schema#comment'], 'A described class');
      },
      'name': 'emits title as rdfs:label and description as rdfs:comment'
    },
    {
      'check': () => {
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

        const classNode = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Deps';
        });

        assert.ok(classNode !== undefined, 'class node must exist');
        assert.strictEqual(classNode['jt:dependentRequired'], undefined);
        assert.strictEqual(classNode['jt:dependentSchema'], undefined);

        const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

        assert.ok(Array.isArray(subs), 'rdfs:subClassOf must exist');

        const implications = subs.filter((sub) => {
          return sub['http://www.w3.org/2002/07/owl#unionOf'] !== undefined;
        });

        assert.strictEqual(implications.length, 2, 'must have two implications');

        // dependentRequired: not-hasEmail or (hasName and hasPhone)
        const depReq = implications.find((imp) => {
          const unionOf = imp['http://www.w3.org/2002/07/owl#unionOf'] as JsonLdNode;
          const branches = unionOf['@list'] as JsonLdNode[];
          const negated = branches[0]?.['http://www.w3.org/2002/07/owl#complementOf'] as JsonLdNode | undefined;
          const onProp = negated?.['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode | undefined;
          const propId = onProp?.['@id'];

          return typeof propId === 'string' && propId.includes('email');
        });

        assert.ok(depReq !== undefined, 'dependentRequired implication must exist');
        const reqUnion = depReq['http://www.w3.org/2002/07/owl#unionOf'] as JsonLdNode;
        const reqBranches = reqUnion['@list'] as JsonLdNode[];

        assert.ok(reqBranches[0]['http://www.w3.org/2002/07/owl#complementOf'] !== undefined, 'first branch must negate trigger');
        assert.strictEqual(
          (reqBranches[0]['http://www.w3.org/2002/07/owl#complementOf'] as JsonLdNode)['@type'],
          'http://www.w3.org/2002/07/owl#Restriction'
        );
        assert.ok(reqBranches[1]['http://www.w3.org/2002/07/owl#intersectionOf'] !== undefined, 'second branch must intersect required props');

        // dependentSchemas: not-hasBilling or SchemaRef
        const depSchema = implications.find((imp) => {
          const unionOf = imp['http://www.w3.org/2002/07/owl#unionOf'] as JsonLdNode;
          const branches = unionOf['@list'] as JsonLdNode[];
          const negated = branches[0]?.['http://www.w3.org/2002/07/owl#complementOf'] as JsonLdNode | undefined;
          const onProp = negated?.['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode | undefined;
          const propId = onProp?.['@id'];

          return typeof propId === 'string' && propId.includes('billing');
        });

        assert.ok(depSchema !== undefined, 'dependentSchemas implication must exist');
        const schemaUnion = depSchema['http://www.w3.org/2002/07/owl#unionOf'] as JsonLdNode;
        const schemaBranches = schemaUnion['@list'] as JsonLdNode[];

        assert.ok(schemaBranches[0]['http://www.w3.org/2002/07/owl#complementOf'] !== undefined, 'first branch must negate trigger');
        assert.ok(schemaBranches[1]['@id'] !== undefined, 'second branch must be a class reference');
      },
      'name': 'serializes dependentRequired and dependentSchemas as owl:unionOf implications'
    },
    {
      'check': () => {
        const patternNodes = serializeSchema({
          '$id': 'https://example.com/PatternObj',
          'patternProperties': {
            '^I_': { 'type': 'integer' },
            '^S_': { 'type': 'string' }
          },
          'type': 'object'
        });

        const patternClassNode = patternNodes.find((node) => {
          return node['@id'] === 'https://example.com/PatternObj';
        });

        assert.ok(patternClassNode !== undefined, 'class node must exist');
        assert.strictEqual(patternClassNode['jt:patternProperty'], undefined);

        const stringProp = patternNodes.find((node) => {
          const nodeId = node['@id'];

          return typeof nodeId === 'string'
            && nodeId.includes('^S_')
            && node['http://www.w3.org/ns/shacl#pattern'] !== undefined;
        });

        assert.ok(stringProp !== undefined, 'string pattern property must exist');
        assert.strictEqual(stringProp['@type'], 'http://www.w3.org/2002/07/owl#DatatypeProperty');
        assert.strictEqual(stringProp['http://www.w3.org/ns/shacl#pattern'], '^S_');
        assert.deepStrictEqual(stringProp['http://www.w3.org/2000/01/rdf-schema#range'], { '@id': 'http://www.w3.org/2001/XMLSchema#string' });
        assert.deepStrictEqual(stringProp['http://www.w3.org/2000/01/rdf-schema#domain'], { '@id': 'https://example.com/PatternObj' });

        const intProp = patternNodes.find((node) => {
          const nodeId = node['@id'];

          return typeof nodeId === 'string'
            && nodeId.includes('^I_')
            && node['http://www.w3.org/ns/shacl#pattern'] !== undefined;
        });

        assert.ok(intProp !== undefined, 'integer pattern property must exist');
        assert.strictEqual(intProp['@type'], 'http://www.w3.org/2002/07/owl#DatatypeProperty');
        assert.strictEqual(intProp['http://www.w3.org/ns/shacl#pattern'], '^I_');
        assert.deepStrictEqual(intProp['http://www.w3.org/2000/01/rdf-schema#range'], { '@id': 'http://www.w3.org/2001/XMLSchema#integer' });
      },
      'name': 'serializes patternProperties as OWL properties with sh:pattern'
    },
    {
      'check': () => {
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

        const nodes = serializer.serialize([graph]) as JsonLdNode[];

        const idProp = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Access#id';
        });

        assert.ok(idProp !== undefined, 'id property must exist');
        assert.strictEqual(idProp['http://datashapes.org/dash#readOnly'], true);
        assert.strictEqual(idProp['http://datashapes.org/dash#writeOnly'], undefined);

        const secretProp = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Access#secret';
        });

        assert.ok(secretProp !== undefined, 'secret property must exist');
        assert.strictEqual(secretProp['http://datashapes.org/dash#writeOnly'], true);
        assert.strictEqual(secretProp['http://datashapes.org/dash#readOnly'], undefined);

        const payloadProp = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Access#payload';
        });

        assert.ok(payloadProp !== undefined, 'payload property must exist');
        assert.strictEqual(payloadProp['http://purl.org/dc/terms/format'], 'application/json');
      },
      'name': 'emits readOnly/writeOnly and contentMediaType in OWL serializer'
    },
    {
      'check': () => {
        const nodes = serializeSchema({
          '$id': 'https://example.com/Empty',
          'type': 'object'
        });

        const classNode = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Empty';
        });

        assert.ok(classNode !== undefined, 'class node must exist');
        assert.strictEqual(classNode['@type'], 'http://www.w3.org/2002/07/owl#Class');

        const propertyNodes = nodes.filter((node) => {
          return node['@type'] === 'http://www.w3.org/2002/07/owl#DatatypeProperty'
            || node['@type'] === 'http://www.w3.org/2002/07/owl#ObjectProperty';
        });

        assert.strictEqual(propertyNodes.length, 0);
      },
      'name': 'schema with no properties produces class node but no property nodes'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of owlScenarios) {
    void it(scenarioName, () => {
      check();
    });
  }
});

// ---------------------------------------------------------------------------
// GraphShaclSerializer
// ---------------------------------------------------------------------------

void describe('GraphShaclSerializer', () => {
  const shaclScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
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

        const shape = shapes.find((node) => {
          return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
        });

        assert.ok(shape !== undefined, 'NodeShape must exist');
        assert.strictEqual(shape['http://www.w3.org/ns/shacl#name'], 'Titled Shape');
      },
      'name': 'emits sh:name on NodeShape from title'
    },
    {
      'check': () => {
        const shapes = serializeShaclSchema({
          '$id': 'https://example.com/TitledShape2',
          'properties': {
            'score': {
              'title': 'Score Field',
              'type': 'number'
            }
          },
          'type': 'object'
        });

        const shape = shapes.find((node) => {
          return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
        });

        assert.ok(shape !== undefined, 'NodeShape must exist');
        const shapeProps = shape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];
        const scoreProp = shapeProps.find((prop) => {
          const path = prop['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;
          const pathId = path?.['@id'];

          return typeof pathId === 'string' && pathId.includes('score');
        });

        assert.ok(scoreProp !== undefined, 'score property shape must exist');
        assert.strictEqual(scoreProp['http://www.w3.org/ns/shacl#name'], 'Score Field');
      },
      'name': 'emits sh:name on PropertyShape from property title'
    },
    {
      'check': () => {
        const shapes = serializeShaclSchema({
          '$dynamicAnchor': 'dyn',
          '$id': 'https://example.com/OmitKeywords',
          'discriminator': { 'propertyName': 'kind' },
          'properties': { 'kind': { 'type': 'string' } },
          'type': 'object'
        });

        const shape = shapes.find((node) => {
          return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
        });

        assert.ok(shape !== undefined);
        assert.strictEqual(shape.$dynamicAnchor, undefined);
        assert.strictEqual(shape.discriminator, undefined);
      },
      'name': 'omits validation-only keywords ($dynamicAnchor, discriminator)'
    },
    {
      'check': () => {
        const constAndDepsShapes = serializeShaclSchema({
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

        const constShape = constAndDepsShapes.find((node) => {
          return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
        });

        assert.ok(constShape !== undefined, 'NodeShape must exist');

        const constShapeProps = constShape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];
        const statusProp = constShapeProps.find((prop) => {
          const path = prop['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;
          const pathId = path?.['@id'];

          return typeof pathId === 'string' && pathId.includes('status');
        });

        assert.ok(statusProp !== undefined, 'status property shape must exist');
        assert.strictEqual(statusProp['http://www.w3.org/ns/shacl#hasValue'], 'active');
      },
      'name': 'emits sh:hasValue for const property'
    },
    {
      'check': () => {
        const constAndDepsShapes = serializeShaclSchema({
          '$id': 'https://example.com/ConstAndDeps2',
          'dependentRequired': { 'email': ['name'] },
          'properties': {
            'email': { 'type': 'string' },
            'name': { 'type': 'string' }
          },
          'type': 'object'
        });

        const constShape = constAndDepsShapes.find((node) => {
          return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
        });

        assert.ok(constShape !== undefined, 'NodeShape must exist');

        assert.strictEqual(constShape['https://json-tology.dev/vocab#dependentRequired'], undefined);
        assert.ok(constShape['http://www.w3.org/ns/shacl#and'] !== undefined, 'sh:and must exist');
        const shAnd = constShape['http://www.w3.org/ns/shacl#and'] as JsonLdNode;
        const andList = shAnd['@list'] as JsonLdNode[];
        const implication = andList.find((entry) => {
          return entry['http://www.w3.org/ns/shacl#or'] !== undefined;
        });

        assert.ok(implication !== undefined, 'sh:or implication must exist');
        const shOr = implication['http://www.w3.org/ns/shacl#or'] as JsonLdNode;
        const orList = shOr['@list'] as JsonLdNode[];

        assert.strictEqual(orList.length, 2);
        assert.ok(orList[0]['http://www.w3.org/ns/shacl#not'] !== undefined, 'first branch must negate trigger');
        assert.ok(orList[1]['http://www.w3.org/ns/shacl#property'] !== undefined, 'second branch must require property');
      },
      'name': 'emits sh:or implication for dependentRequired'
    },
    {
      'check': () => {
        const shapes = serializeShaclSchema({
          '$id': 'https://example.com/ContainsArr',
          'contains': { 'type': 'string' },
          'maxContains': 5,
          'minContains': 2,
          'type': 'array'
        });

        const shape = shapes.find((node) => {
          return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
        });

        assert.ok(shape !== undefined, 'NodeShape must exist');
        assert.strictEqual(shape['jt:contains'], undefined);

        const props = shape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[] | undefined;

        assert.ok(Array.isArray(props), 'sh:property must exist');
        const qvs = props.find((prop) => {
          return prop['http://www.w3.org/ns/shacl#qualifiedValueShape'] !== undefined;
        });

        assert.ok(qvs !== undefined, 'sh:qualifiedValueShape entry must exist');
        assert.deepStrictEqual(qvs['http://www.w3.org/ns/shacl#qualifiedValueShape'], { 'http://www.w3.org/ns/shacl#datatype': { '@id': 'http://www.w3.org/2001/XMLSchema#string' } });
        assert.strictEqual(qvs['http://www.w3.org/ns/shacl#qualifiedMinCount'], 2);
        assert.strictEqual(qvs['http://www.w3.org/ns/shacl#qualifiedMaxCount'], 5);
      },
      'name': 'serializes contains as sh:qualifiedValueShape with min/max counts'
    },
    {
      'check': () => {
        const shapes = serializeShaclSchema({
          '$id': 'https://example.com/EmptyShacl',
          'type': 'object'
        });

        const shape = shapes.find((node) => {
          return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
        });

        assert.ok(shape !== undefined, 'NodeShape must exist');
        const props = shape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[] | undefined;

        if (props !== undefined) {
          assert.strictEqual(props.length, 0);
        }
      },
      'name': 'schema with no properties produces NodeShape with no sh:property entries'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of shaclScenarios) {
    void it(scenarioName, () => {
      check();
    });
  }
});
