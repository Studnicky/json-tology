/**
 * Direct serializer access for advanced use cases
 *
 * When not using the JsonTology facade, serializers are directly importable
 * from json-tology/ontology.
 */

import {
  GraphOntologySerializer,
  GraphSchemaSerializer,
  GraphShaclSerializer,
  OntologyBuilder
} from '../../../src/ontology.js';
import { SchemaRegistry } from '../../../src/schema.js';
import { BookSchema } from '../bookstore/index.js';

const registry = new SchemaRegistry();

registry.set(BookSchema);

const graphs = registry.listGraphs();

// OWL
const owlSerializer = new GraphOntologySerializer();
const owlQuads = owlSerializer.serializeQuads(graphs);

const builder = new OntologyBuilder({
  'baseIRI': 'https://bookstore.example',
  'prefixes': { 'bs': 'https://bookstore.example/' }
}).addFromQuads(owlQuads);
const owlJson = builder.jsonLd();

// SHACL
const shaclSerializer = new GraphShaclSerializer();
const shaclQuads = shaclSerializer.serializeQuads(graphs);

builder.addShaclFromQuads(shaclQuads);
const shaclJson = JSON.stringify(builder.shaclObject(), null, 2);

console.log('SHACL JSON-LD (first 60 chars):', shaclJson.slice(0, 60));

// Reconstruct schema from a single graph
const schemaSerializer = new GraphSchemaSerializer();
const graph = registry.graph(BookSchema.$id);

if (graph) {
  const schema = schemaSerializer.serialize(graph);

  console.assert(Boolean(schema), 'schema reconstructed');
  console.log('Schema reconstructed from graph:', schema.$id);
}

console.log('OWL quads count:', owlQuads.length);
console.log('OWL JSON-LD byte length:', owlJson.length);
console.log('SHACL quads count:', shaclQuads.length);
