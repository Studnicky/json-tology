#!/usr/bin/env node

/**
 * json-tology CLI
 *
 * Build-time graph artifact generation.
 *
 * Usage:
 *   json-tology build --schema 'schemas/*.json' --output dist/graphs
 */

import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync
} from 'node:fs';
import {
  basename, resolve
} from 'node:path';
import { SchemaRegistry } from './modules/registry/SchemaRegistry.js';
import { GraphArtifact } from './modules/graph/GraphArtifact.js';
import { GraphSchemaSerializer } from './modules/ontology/GraphSchemaSerializer.js';
import { GraphOntologySerializer } from './modules/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from './modules/ontology/GraphShaclSerializer.js';
import { OntologyBuilder } from './modules/ontology/OntologyBuilder.js';
import type { SchemaGraph } from './modules/graph/SchemaGraph.js';
import { DEFAULT_PREFIXES as BASE_PREFIXES } from './constants/prefixes.js';

const DEFAULT_PREFIXES: Record<string, string> = {
  ...BASE_PREFIXES,
  'dash': 'http://datashapes.org/dash#',
  'dct': 'http://purl.org/dc/terms/',
  'jsonschema': 'https://json-schema.org/ontology#',
  'sh': 'http://www.w3.org/ns/shacl#'
};

function usage(): never {
  console.error('Usage: json-tology build --schema <glob> --output <dir> [--format artifact|schema|ontology|shacl] [--base-iri <iri>] [--output-file <filename>]');
  process.exit(1);
}

function parseArgs(argv: string[]): { 'baseIRI': string | undefined;
  'command': string;
  'format': string
  'output': string;
  'outputFile': string | undefined;
  'schema': string; } {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] !== 'build') {
    usage();
  }

  let schema = '';
  let output = '';
  let format = 'artifact';
  let baseIRI: string | undefined;
  let outputFile: string | undefined;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--base-iri':
        baseIRI = args[++i] ?? '';
        break;
      case '--format':
        format = args[++i] ?? 'artifact';
        break;
      case '--output':
        output = args[++i] ?? '';
        break;
      case '--output-file':
        outputFile = args[++i] ?? '';
        break;
      case '--schema':
        schema = args[++i] ?? '';
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        usage();
    }
  }

  if (schema === '' || output === '') {
    usage();
  }

  return {
    baseIRI,
    'command': 'build',
    format,
    output,
    outputFile,
    schema
  };
}

function normalizeBaseIRI(value: string): string {
  let baseIRI = value;

  while (baseIRI.endsWith('/')) {
    baseIRI = baseIRI.slice(0, -1);
  }

  return baseIRI;
}

function deriveBaseIRIFromSchemaId(schemaId: string): string {
  const withoutHash = schemaId.split('#')[0] ?? schemaId;

  try {
    const parsed = new URL(withoutHash);
    const pathname = parsed.pathname.replace(/\/$/u, '');
    const lastSlash = pathname.lastIndexOf('/');

    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = lastSlash <= 0 ? '/' : pathname.slice(0, lastSlash);

    return normalizeBaseIRI(parsed.toString());
  } catch {
    const lastSlash = withoutHash.lastIndexOf('/');

    return normalizeBaseIRI(lastSlash <= 0 ? withoutHash : withoutHash.slice(0, lastSlash));
  }
}

function resolveBaseIRI(graphs: readonly SchemaGraph[], configuredBaseIRI?: string): string {
  if (configuredBaseIRI !== undefined && configuredBaseIRI !== '') {
    return normalizeBaseIRI(configuredBaseIRI);
  }

  const firstRootSchema = graphs[0]?.rootSchema;
  const firstSchemaId = typeof firstRootSchema === 'object'
    ? (firstRootSchema).$id
    : undefined;

  if (typeof firstSchemaId !== 'string' || firstSchemaId === '') {
    throw new Error('Unable to derive base IRI from registered schemas. Pass --base-iri explicitly.');
  }

  return deriveBaseIRIFromSchemaId(firstSchemaId);
}

function resolveSingleOutputPath(outputDir: string, outputFile: string | undefined, defaultFileName: string): string {
  return resolve(outputDir, outputFile === undefined || outputFile === '' ? defaultFileName : outputFile);
}

function findFiles(pattern: string): string[] {
  // Simple glob: if pattern contains *, expand by listing the directory
  // and matching the file extension. For production use, consider a glob library.
  if (pattern.includes('*')) {
    const dir = pattern.slice(0, pattern.indexOf('*')).replace(/\/$/u, '') || '.';
    const ext = pattern.slice(pattern.lastIndexOf('.'));
    const entries = readdirSync(resolve(dir), { 'recursive': true }) as unknown as string[];

    return entries
      .filter((entry) => {
        return entry.endsWith(ext);
      })
      .map((entry) => {
        return resolve(dir, entry);
      })
      .sort();
  }

  return [resolve(pattern)];
}

async function main(): Promise<void> {
  const {
    'baseIRI': configuredBaseIRI, format, output, outputFile, 'schema': schemaGlob
  } = parseArgs(process.argv);
  const files = findFiles(schemaGlob);

  if (files.length === 0) {
    console.error(`No files matched: ${schemaGlob}`);
    process.exit(1);
  }

  const registry = new SchemaRegistry();
  const schemas: Array<Record<string, unknown>> = [];

  for (const filePath of files) {
    const content = readFileSync(resolve(filePath), 'utf8');
    const schema = JSON.parse(content) as Record<string, unknown>;

    schemas.push(schema);
    registry.register(schema);
  }

  if (!existsSync(output)) {
    mkdirSync(output, { 'recursive': true });
  }

  const graphs = registry.listGraphs();
  const baseIRI = resolveBaseIRI(graphs, configuredBaseIRI);

  if (format === 'ontology' || format === 'shacl') {
    if (format === 'ontology') {
      const serializer = new GraphOntologySerializer();
      const result = serializer.serialize(graphs);
      const builder = new OntologyBuilder({
        baseIRI,
        'graphSources': [result],
        'prefixes': DEFAULT_PREFIXES
      });

      writeFileSync(resolveSingleOutputPath(output, outputFile, 'ontology.jsonld'), JSON.stringify(builder.jsonLdObject(), null, 2));

      console.log(`Built ${graphs.length} graph(s) → ${output}/`);

      return;
    }

    const serializer = new GraphShaclSerializer();
    const result = serializer.serialize(graphs);
    const builder = new OntologyBuilder({
      baseIRI,
      'graphSources': [],
      'prefixes': DEFAULT_PREFIXES
    });

    builder.addShacl(result);

    writeFileSync(resolveSingleOutputPath(output, outputFile, 'shacl.jsonld'), JSON.stringify(builder.shaclObject(), null, 2));

    console.log(`Built ${graphs.length} graph(s) → ${output}/`);

    return;
  }

  for (const graph of graphs) {
    const rootSchema = graph.rootSchema as Record<string, unknown>;
    const schemaId = rootSchema.$id as string;
    const safeName = basename(schemaId).replaceAll(/[^\w-]/gu, '_');

    switch (format) {
      case 'artifact': {
        const artifact = GraphArtifact.toArtifact(graph);

        writeFileSync(resolve(output, `${safeName}.artifact.json`), JSON.stringify(artifact, null, 2));
        break;
      }
      case 'schema': {
        const serializer = new GraphSchemaSerializer();
        const result = serializer.serialize(graph);

        writeFileSync(resolve(output, `${safeName}.schema.json`), JSON.stringify(result, null, 2));
        break;
      }
      default:
        console.error(`Unknown format: ${format}`);
        process.exit(1);
    }
  }

  console.log(`Built ${graphs.length} graph(s) → ${output}/`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
