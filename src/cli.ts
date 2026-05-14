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

import { execFile } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync
} from 'node:fs';
import {
  basename, dirname, resolve
} from 'node:path';
import { Command } from 'commander';
import { SchemaRegistry } from './modules/registry/SchemaRegistry.js';
import { GraphArtifact } from './modules/graph/GraphArtifact.js';
import { GraphSchemaSerializer } from './modules/ontology/GraphSchemaSerializer.js';
import { GraphOntologySerializer } from './modules/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from './modules/ontology/GraphShaclSerializer.js';
import { OntologyBuilder } from './modules/ontology/OntologyBuilder.js';
import { VizDataCollector } from './modules/viz/VizDataCollector.js';
import { HtmlRenderer } from './modules/viz/HtmlRenderer.js';
import type { SchemaGraphInterface } from './interfaces/SchemaGraphImpl.js';
import { DEFAULT_PREFIXES } from './constants/PREFIXES.js';
import { SchemaError } from './errors/SchemaError.js';
import { CliWriter } from './modules/cli/CliWriter.js';

const writer = CliWriter.default;

const CLI_PREFIXES: Record<string, string> = {
  ...DEFAULT_PREFIXES,
  'jsonschema': 'https://json-schema.org/ontology#'
};

// ---------------------------------------------------------------------------
// File and schema loading
// ---------------------------------------------------------------------------

function findFiles(pattern: string): string[] {
  if (pattern.includes('*')) {
    const dir = pattern.slice(0, pattern.indexOf('*')).replace(/\/$/u, '') || '.';
    const ext = pattern.slice(pattern.lastIndexOf('.'));
    const entries = readdirSync(resolve(dir), {
      'encoding': 'utf8',
      'recursive': true
    });

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
    writer.err(`No files matched: ${schemaGlob}`);
    writer.exit(1);
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
    const id = schema.$id;

    if (typeof id === 'string') {
      registry.set(id, schema);
    }
  }

  return registry;
}

// ---------------------------------------------------------------------------
// IRI resolution
// ---------------------------------------------------------------------------

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

function resolveBaseIRI(
  graphs: readonly SchemaGraphInterface[],
  configuredBaseIRI: string | undefined
): string {
  if (configuredBaseIRI !== undefined && configuredBaseIRI !== '') {
    return normalizeBaseIRI(configuredBaseIRI);
  }

  const firstRootSchema = graphs[0]?.rootSchema;
  const firstSchemaId = typeof firstRootSchema === 'object'
    ? (firstRootSchema).$id
    : undefined;

  if (typeof firstSchemaId !== 'string' || firstSchemaId === '') {
    throw new SchemaError(
      'SCHEMA_MISSING_ID',
      'Unable to derive base IRI from registered schemas. Pass --base-iri explicitly.'
    );
  }

  return deriveBaseIRIFromSchemaId(firstSchemaId);
}

function resolveSingleOutputPath(
  outputDir: string,
  outputFile: string | undefined,
  defaultFileName: string
): string {
  return resolve(
    outputDir,
    outputFile === undefined || outputFile === '' ? defaultFileName : outputFile
  );
}

// ---------------------------------------------------------------------------
// Prefix derivation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------

function openBrowser(filePath: string): void {
  const { platform } = process;
  let cmd = 'xdg-open';

  if (platform === 'darwin') {
    cmd = 'open';
  } else if (platform === 'win32') {
    cmd = 'start';
  }

  execFile(cmd, [filePath], (error) => {
    if (error) {
      writer.err(`Failed to open browser: ${error.message}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Build command
// ---------------------------------------------------------------------------

interface BuildOptionsInterface {
  'baseIri'?: string;
  'format': string;
  'output': string;
  'outputFile'?: string;
  'schema': string;
}

async function runBuild(options: BuildOptionsInterface): Promise<void> {
  const {
    'baseIri': configuredBaseIRI, format, output, outputFile, 'schema': schemaGlob
  } = options;
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
      const outPath = resolveSingleOutputPath(output, outputFile, 'ontology.jsonld');

      writeFileSync(outPath, JSON.stringify(builder.jsonLdObject(), null, 2));
      writer.out(`Built ${graphs.length} graph(s) → ${output}/`);

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

    const outPath = resolveSingleOutputPath(output, outputFile, 'shacl.jsonld');

    writeFileSync(outPath, JSON.stringify(builder.shaclObject(), null, 2));
    writer.out(`Built ${graphs.length} graph(s) → ${output}/`);

    return;
  }

  for (const graph of graphs) {
    const rootSchema = graph.rootSchema as Record<string, unknown>;
    const schemaId = rootSchema.$id as string;
    const safeName = basename(schemaId).replaceAll(/[^\w-]/gu, '_');

    switch (format) {
      case 'artifact': {
        const artifact = GraphArtifact.toArtifact(graph);

        writeFileSync(
          resolve(output, `${safeName}.artifact.json`),
          JSON.stringify(artifact, null, 2)
        );
        break;
      }
      case 'schema': {
        const serializer = new GraphSchemaSerializer();
        const result = serializer.serialize(graph);

        writeFileSync(
          resolve(output, `${safeName}.schema.json`),
          JSON.stringify(result, null, 2)
        );
        break;
      }
      default:
        writer.err(`Unknown format: ${format}`);
        writer.exit(1);
    }
  }

  writer.out(`Built ${graphs.length} graph(s) → ${output}/`);
}

// ---------------------------------------------------------------------------
// Viz command
// ---------------------------------------------------------------------------

interface VizOptionsInterface {
  'noOpen': boolean;
  'output': string;
  'schema': string;
}

async function runViz(options: VizOptionsInterface): Promise<void> {
  const {
    noOpen, output, 'schema': schemaGlob
  } = options;
  const schemas = loadSchemaFiles(schemaGlob);
  const prefixes = derivePrefixesFromSchemas(schemas);
  const registry = new SchemaRegistry(Object.keys(prefixes).length > 0 ? { prefixes } : undefined);

  for (const schema of schemas) {
    const id = schema.$id;

    if (typeof id === 'string') {
      registry.set(id, schema);
    }
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

  writer.out(`Visualization written to ${outputPath}`);

  if (!noOpen) {
    openBrowser(outputPath);
  }
}

// ---------------------------------------------------------------------------
// Commander program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('json-tology')
  .description('Ontology-native type system with declarative JSON Schema authoring')
  .version('0.1.0');

program
  .command('build')
  .description('Generate graph artifacts, ontology, or SHACL from JSON Schema files')
  .requiredOption('--schema <glob>', 'Schema file glob pattern')
  .requiredOption('--output <dir>', 'Output directory')
  .option('--format <type>', 'Output format: artifact, schema, ontology, shacl', 'artifact')
  .option('--base-iri <iri>', 'Base IRI for ontology output')
  .option('--output-file <filename>', 'Override output filename (for single-file formats)')
  .action(async (opts: { 'baseIri'?: string;
    'format': string;
    'output': string;
    'outputFile'?: string;
    'schema': string }) => {
    await runBuild(opts);
  });

program
  .command('viz')
  .description('Generate interactive schema graph visualization')
  .requiredOption('--schema <glob>', 'Schema file glob pattern')
  .option('--output <file>', 'Output HTML file', 'schema-graph.html')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (opts: { 'noOpen': boolean;
    'output': string;
    'schema': string }) => {
    await runViz(opts);
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  writer.err(String(error));
  writer.exit(1);
}
