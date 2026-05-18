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
const owlNodes = owlSerializer.serialize(graphs);

const builder = new OntologyBuilder({
  'baseIRI': 'https://bookstore.example',
  'graphSources': [owlNodes],
  'prefixes': { 'bs': 'https://bookstore.example/' }
});
const owlJson = builder.jsonLd();

// SHACL
const shaclSerializer = new GraphShaclSerializer();
const shaclNodes = shaclSerializer.serialize(graphs);

builder.addShacl(shaclNodes);
const shaclJson = JSON.stringify(builder.shaclObject(), null, 2);

// Reconstruct schema from a single graph
const schemaSerializer = new GraphSchemaSerializer();
const graph = registry.graph(BookSchema.$id);

if (graph) {
  const schema = schemaSerializer.serialize(graph);

  console.assert(schema, 'schema reconstructed');
}

void owlJson;
void shaclJson;
