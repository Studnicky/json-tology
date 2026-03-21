#!/usr/bin/env node

/**
 * json-tology CLI
 *
 * Build-time graph artifact generation and schema visualization.
 *
 * Usage:
 *   json-tology build --schema 'schemas/*.json' --output dist/graphs
 *   json-tology viz  --schema 'schemas/*.json' [--output file.html] [--no-open]
 */

import { exec } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync
} from 'node:fs';
import {
  basename, dirname, resolve
} from 'node:path';
import { SchemaRegistry } from './modules/registry/SchemaRegistry.js';
import { GraphArtifact } from './modules/graph/GraphArtifact.js';
import { GraphSchemaSerializer } from './modules/ontology/GraphSchemaSerializer.js';
import { GraphOntologySerializer } from './modules/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from './modules/ontology/GraphShaclSerializer.js';
import { OntologyBuilder } from './modules/ontology/OntologyBuilder.js';
import { VizDataCollector } from './modules/viz/VizDataCollector.js';
import { HtmlRenderer } from './modules/viz/HtmlRenderer.js';
import type { SchemaGraphInterface } from './interfaces/schema-graph-impl.js';
import { DEFAULT_PREFIXES } from './constants/prefixes.js';
import { SchemaError } from './errors/SchemaError.js';

const CLI_PREFIXES: Record<string, string> = {
  ...DEFAULT_PREFIXES,
  'dash': 'http://datashapes.org/dash#',
  'dct': 'http://purl.org/dc/terms/',
  'jsonschema': 'https://json-schema.org/ontology#',
  'sh': 'http://www.w3.org/ns/shacl#'
};

function usage(): never {
  console.error(`Usage:
  json-tology build --schema <glob> --output <dir> [--format artifact|schema|ontology|shacl] [--base-iri <iri>] [--output-file <filename>]
  json-tology viz  --schema <glob> [--output <file>] [--no-open]`);
  process.exit(1);
}

interface BuildArgsInterface {
  'baseIRI': string | undefined;
  'command': 'build';
  'format': string;
  'output': string;
  'outputFile': string | undefined;
  'schema': string;
}

interface VizArgsInterface {
  'command': 'viz';
  'noOpen': boolean;
  'output': string;
  'schema': string;
}

type CliArgsType = BuildArgsInterface | VizArgsInterface;

function parseArgs(argv: string[]): CliArgsType {
  const args = argv.slice(2);

  if (args.length === 0) {
    usage();
  }

  const command = args[0];

  if (command === 'build') {
    return parseBuildArgs(args);
  }

  if (command === 'viz') {
    return parseVizArgs(args);
  }

  return usage();
}

function parseBuildArgs(args: string[]): BuildArgsInterface {
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

function parseVizArgs(args: string[]): VizArgsInterface {
  let schema = '';
  let output = 'schema-graph.html';
  let noOpen = false;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--no-open':
        noOpen = true;
        break;
      case '--output':
        output = args[++i] ?? 'schema-graph.html';
        break;
      case '--schema':
        schema = args[++i] ?? '';
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        usage();
    }
  }

  if (schema === '') {
    usage();
  }

  return {
    'command': 'viz',
    noOpen,
    output,
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

function resolveBaseIRI(graphs: readonly SchemaGraphInterface[], configuredBaseIRI?: string): string {
  if (configuredBaseIRI !== undefined && configuredBaseIRI !== '') {
    return normalizeBaseIRI(configuredBaseIRI);
  }

  const firstRootSchema = graphs[0]?.rootSchema;
  const firstSchemaId = typeof firstRootSchema === 'object'
    ? (firstRootSchema).$id
    : undefined;

  if (typeof firstSchemaId !== 'string' || firstSchemaId === '') {
    throw new SchemaError('SCHEMA_MISSING_ID', 'Unable to derive base IRI from registered schemas. Pass --base-iri explicitly.');
  }

  return deriveBaseIRIFromSchemaId(firstSchemaId);
}

function resolveSingleOutputPath(outputDir: string, outputFile: string | undefined, defaultFileName: string): string {
  return resolve(outputDir, outputFile === undefined || outputFile === '' ? defaultFileName : outputFile);
}

function findFiles(pattern: string): string[] {
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

function loadSchemaFiles(schemaGlob: string): Array<Record<string, unknown>> {
  const files = findFiles(schemaGlob);

  if (files.length === 0) {
    console.error(`No files matched: ${schemaGlob}`);
    process.exit(1);
  }

  return files.map((filePath) => {
    const content = readFileSync(resolve(filePath), 'utf8');

    return JSON.parse(content) as Record<string, unknown>;
  });
}

function loadSchemas(schemaGlob: string): SchemaRegistry {
  const schemas = loadSchemaFiles(schemaGlob);
  const registry = new SchemaRegistry();

  for (const schema of schemas) {
    registry.register(schema);
  }

  return registry;
}

function derivePrefixFromIRI(iri: URL): string {
  const segments = iri.pathname.split('/').filter(Boolean);

  segments.pop();

  for (let i = segments.length - 1; i >= 0; i--) {
    const candidate = segments[i].replaceAll(/\W/gu, '').toLowerCase();

    if (candidate !== '' && !/^\d[\d.]*$/u.test(segments[i])) {
      return candidate;
    }
  }

  const host = iri.hostname.split('.');
  const domain = host.length > 1 ? host.at(-2) : host[0];

  return (domain ?? 'ns').toLowerCase();
}

function derivePrefixesFromSchemas(schemas: ReadonlyArray<Record<string, unknown>>): Record<string, string> {
  const prefixes: Record<string, string> = {};

  for (const schema of schemas) {
    const id = schema.$id;

    if (typeof id !== 'string') {
      continue;
    }

    let parsed: URL;

    try {
      parsed = new URL(id);
    } catch {
      continue;
    }

    const lastSlash = id.lastIndexOf('/');
    const namespace = `${id.slice(0, lastSlash)}/`;
    const prefix = derivePrefixFromIRI(parsed);

    if (prefix !== '' && !Object.hasOwn(prefixes, prefix)) {
      prefixes[prefix] = namespace;
    }
  }

  return prefixes;
}

function openBrowser(filePath: string): void {
  const { platform } = process;
  let cmd = 'xdg-open';

  if (platform === 'darwin') {
    cmd = 'open';
  } else if (platform === 'win32') {
    cmd = 'start';
  }

  try {
    exec(`${cmd} "${filePath}"`);
  } catch {
    // Silently ignore — opening the browser is best-effort
  }
}

async function mainBuild(buildArgs: BuildArgsInterface): Promise<void> {
  const {
    'baseIRI': configuredBaseIRI, format, output, outputFile, 'schema': schemaGlob
  } = buildArgs;
  const registry = loadSchemas(schemaGlob);

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
        'prefixes': CLI_PREFIXES
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
      'prefixes': CLI_PREFIXES
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

async function mainViz(vizArgs: VizArgsInterface): Promise<void> {
  const {
    noOpen, output, 'schema': schemaGlob
  } = vizArgs;
  const schemas = loadSchemaFiles(schemaGlob);
  const prefixes = derivePrefixesFromSchemas(schemas);
  const registry = new SchemaRegistry(Object.keys(prefixes).length > 0 ? { prefixes } : undefined);

  for (const schema of schemas) {
    registry.register(schema);
  }

  const collector = new VizDataCollector(registry);
  const payload = collector.collect();
  const renderer = new HtmlRenderer();
  const html = renderer.render(payload);
  const outputPath = resolve(output);
  const outputDir = dirname(outputPath);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { 'recursive': true });
  }

  writeFileSync(outputPath, html);

  console.log(`Visualization written to ${outputPath}`);

  if (!noOpen) {
    openBrowser(outputPath);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.command === 'viz') {
    return mainViz(args);
  }

  return mainBuild(args);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
