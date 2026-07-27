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
import type { ExecFileException } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync
} from 'node:fs';
import {
  basename, dirname, resolve
} from 'node:path';
import { Command } from 'commander';
import pkg from '../package.json' with { 'type': 'json' };
import { SchemaRegistry } from './modules/registry/SchemaRegistry.js';
import type { SchemaRegistryInterface } from './interfaces/SchemaRegistryInterface.js';
import { DataType } from './modules/data/DataType.js';
import { SCHEMA_ERROR_CODE } from './constants/ERROR_CODES.js';
import { GraphArtifact } from './modules/graph/GraphArtifact.js';
import { GraphSchemaSerializer } from './modules/ontology/GraphSchemaSerializer.js';
import { GraphOntologySerializer } from './modules/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from './modules/ontology/GraphShaclSerializer.js';
import { OntologyBuilder } from './modules/ontology/OntologyBuilder.js';
import { VizDataCollector } from './modules/viz/VizDataCollector.js';
import { HtmlRenderer } from './modules/viz/HtmlRenderer.js';
import type { SchemaGraphInterface } from './interfaces/SchemaGraphInterface.js';
import type { BuildOptionsEntity } from './entities/BuildOptionsEntity.js';
import type { VizOptionsEntity } from './entities/VizOptionsEntity.js';
import type { BuildOutputOptionsInterface } from './interfaces/BuildOutputOptionsInterface.js';
import { STANDARD_PREFIXES } from './constants/STANDARD_PREFIXES.js';
import { SchemaError } from './errors/SchemaError.js';
import { CliWriter } from './modules/cli/CliWriter.js';
import { SchemaIri } from './modules/graph/SchemaIri.js';
import {
  NON_ALPHANUMERIC_ASCII, NON_WORD_CHARS, NUMERIC_DOTTED_SEGMENT, TRAILING_SLASH, UNSAFE_FILENAME_CHARS
} from './constants/PATH.js';

const writer = CliWriter.default;

const CLI_PREFIXES: Record<string, string> = {
  ...STANDARD_PREFIXES,
  'jsonschema': 'https://json-schema.org/ontology#'
};

// ---------------------------------------------------------------------------
// File and schema loading
// ---------------------------------------------------------------------------

class SchemaLoader {
  static findFiles(pattern: string): string[] {
    if (pattern.includes('*')) {
      const dir = pattern.slice(0, pattern.indexOf('*')).replace(TRAILING_SLASH, '') || '.';
      const ext = pattern.slice(pattern.lastIndexOf('.'));
      const entries = readdirSync(resolve(dir), {
        'encoding': 'utf8',
        'recursive': true
      });

      return entries
        .reduce((matched: string[], entry: string): string[] => {
          if (entry.endsWith(ext)) {
            matched.push(resolve(dir, entry));
          }

          return matched;
        }, [])
        .sort();
    }

    return [resolve(pattern)];
  }

  static loadFiles(schemaGlob: string): Array<Record<string, unknown>> {
    const files = SchemaLoader.findFiles(schemaGlob);

    if (files.length === 0) {
      writer.error(`No files matched: ${schemaGlob}`);
      writer.exit(1);
    }

    return files.map((filePath: string): Record<string, unknown> => {
      const content = readFileSync(resolve(filePath), 'utf8');
      let parsed: unknown;

      try {
        parsed = JSON.parse(content);
      } catch (error) {
        throw new SchemaError(`Invalid JSON in schema file: ${filePath}`, {
          'code': SCHEMA_ERROR_CODE.INVALID_INPUT,
          ...(error instanceof Error && { 'cause': error })
        });
      }

      if (!DataType.isRecord(parsed)) {
        throw new SchemaError(`Schema file is not a JSON object: ${filePath}`, { 'code': SCHEMA_ERROR_CODE.INVALID_INPUT });
      }

      return parsed;
    });
  }

  static loadRegistry(schemaGlob: string): SchemaRegistryInterface {
    const schemas = SchemaLoader.loadFiles(schemaGlob);
    const registry = new SchemaRegistry();

    for (const schema of schemas) {
      const id = schema.$id;

      if (typeof id === 'string') {
        registry.set(schema, id);
      }
    }

    return registry;
  }
}

// ---------------------------------------------------------------------------
// IRI resolution
// ---------------------------------------------------------------------------

class BaseIri {
  static deriveFromSchemaId(schemaId: string): string {
    // parseReference extracts the IRI base (before '#') in the canonical way.
    const withoutHash = SchemaIri.parseReference(schemaId).id;

    try {
      const parsed = new URL(withoutHash);
      const pathname = parsed.pathname.replace(TRAILING_SLASH, '');
      const lastSlash = pathname.lastIndexOf('/');

      parsed.hash = '';
      parsed.search = '';
      parsed.pathname = lastSlash <= 0 ? '/' : pathname.slice(0, lastSlash);

      return BaseIri.normalize(parsed.toString());
    } catch {
      const lastSlash = withoutHash.lastIndexOf('/');

      return BaseIri.normalize(lastSlash <= 0 ? withoutHash : withoutHash.slice(0, lastSlash));
    }
  }

  static normalize(value: string): string {
    const result = SchemaIri.normalizeBase(value);

    return result;
  }

  static resolve(
    graphs: readonly SchemaGraphInterface[],
    configuredBaseIri: string | undefined
  ): string {
    if (configuredBaseIri !== undefined && configuredBaseIri !== '') {
      return BaseIri.normalize(configuredBaseIri);
    }

    const firstRootSchema = graphs[0]?.rootSchema;
    const firstSchemaId = typeof firstRootSchema === 'object'
      ? (firstRootSchema).$id
      : undefined;

    if (typeof firstSchemaId !== 'string' || firstSchemaId === '') {
      throw new SchemaError(
        'Unable to derive base IRI from registered schemas. Pass --base-iri explicitly.',
        { 'code': SCHEMA_ERROR_CODE.MISSING_ID }
      );
    }

    return BaseIri.deriveFromSchemaId(firstSchemaId);
  }
}

// ---------------------------------------------------------------------------
// Prefix derivation
// ---------------------------------------------------------------------------

class IdUrl {
  static parse(id: string): undefined | URL {
    try {
      return new URL(id);
    } catch {
      writer.error(`Skipping prefix derivation for unparseable $id URL: ${id}`);

      return undefined;
    }
  }
}

class PrefixDerivation {
  static fromIri(iri: URL): string {
    const segments = iri.pathname.split('/').filter(Boolean);

    segments.pop();

    for (let i = segments.length - 1; i >= 0; i--) {
      const segment = segments[i];

      if (segment === undefined) {
        continue;
      }

      const candidate = segment.replaceAll(NON_WORD_CHARS, '').toLowerCase();

      if (candidate !== '' && !NUMERIC_DOTTED_SEGMENT.test(segment)) {
        return candidate;
      }
    }

    const host = iri.hostname.split('.');
    const domain = host.length > 1 ? host.at(-2) : host[0];

    return (domain ?? 'ns').toLowerCase();
  }

  static fromSchemas(schemas: ReadonlyArray<Record<string, unknown>>): Record<string, string> {
    const prefixes: Record<string, string> = {};

    for (const schema of schemas) {
      const id = schema.$id;

      if (typeof id !== 'string') {
        continue;
      }

      const parsed = IdUrl.parse(id);

      if (parsed === undefined) {
        continue;
      }

      const lastSlash = id.lastIndexOf('/');
      const namespace = `${id.slice(0, lastSlash)}/`;
      const prefix = PrefixDerivation.fromIri(parsed);

      if (prefix !== '' && !Object.hasOwn(prefixes, prefix)) {
        prefixes[prefix] = namespace;
      }
    }

    return prefixes;
  }
}

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------

class Browser {
  static open(filePath: string): void {
    const { platform } = process;
    let cmd = 'xdg-open';

    if (platform === 'darwin') {
      cmd = 'open';
    } else if (platform === 'win32') {
      cmd = 'start';
    }

    execFile(cmd, [filePath], (error: ExecFileException | null): void => {
      if (error) {
        writer.error(`Failed to open browser: ${error.message}`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Build command
// ---------------------------------------------------------------------------

class Build {
  private static graphOutput(
    graphs: readonly SchemaGraphInterface[],
    format: string,
    output: string
  ): void {
    for (const graph of graphs) {
      const { rootSchema } = graph;

      if (typeof rootSchema !== 'object' || typeof rootSchema.$id !== 'string') {
        continue;
      }

      const schemaId = rootSchema.$id;
      const safeName = basename(schemaId).replaceAll(UNSAFE_FILENAME_CHARS, '_');

      if (format === 'artifact') {
        const artifact = GraphArtifact.toArtifact(graph);

        writeFileSync(
          resolve(output, `${safeName}.artifact.json`),
          JSON.stringify(artifact, null, 2)
        );
      } else if (format === 'schema') {
        const serializer = new GraphSchemaSerializer();
        const result = serializer.serialize(graph);

        writeFileSync(
          resolve(output, `${safeName}.schema.json`),
          JSON.stringify(result, null, 2)
        );
      } else {
        writer.error(`Unknown format: ${format}`);
        writer.exit(1);
      }
    }

    writer.out(`Built ${graphs.length} graph(s) → ${output}/`);
  }

  private static ontologyOutput(options: BuildOutputOptionsInterface): void {
    const {
      baseIri, graphs, output, outputFile
    } = options;
    const serializer = new GraphOntologySerializer();
    const quads = serializer.serializeQuads(graphs);
    const builder = new OntologyBuilder({
      baseIri,
      'prefixes': CLI_PREFIXES
    }).addFromQuads(quads);
    const outPath = Build.outputPath(output, outputFile, 'ontology.jsonld');

    writeFileSync(outPath, JSON.stringify(builder.jsonLdObject(), null, 2));
    writer.out(`Built ${graphs.length} graph(s) → ${output}/`);
  }

  private static outputPath(
    outputDir: string,
    outputFile: string | undefined,
    defaultFileName: string
  ): string {
    const result = resolve(
      outputDir,
      outputFile === undefined || outputFile === '' ? defaultFileName : outputFile
    );

    return result;
  }

  static async run(options: BuildOptionsEntity.Type): Promise<void> {
    const {
      'baseIri': configuredBaseIri, format, output, outputFile, 'schema': schemaGlob
    } = options;
    const registry = SchemaLoader.loadRegistry(schemaGlob);

    if (!existsSync(output)) {
      mkdirSync(output, { 'recursive': true });
    }

    const graphs = registry.listGraphs();
    const baseIri = BaseIri.resolve(graphs, configuredBaseIri);

    const buildOptions: BuildOutputOptionsInterface = {
      baseIri,
      'graphs': [...graphs],
      output,
      outputFile
    };

    if (format === 'ontology') {
      Build.ontologyOutput(buildOptions);
    } else if (format === 'shacl') {
      Build.shaclOutput(buildOptions);
    } else {
      Build.graphOutput(graphs, format, output);
    }
  }

  private static shaclOutput(options: BuildOutputOptionsInterface): void {
    const {
      baseIri, graphs, output, outputFile
    } = options;
    const serializer = new GraphShaclSerializer();
    const shaclQuads = serializer.serializeQuads(graphs);
    const builder = new OntologyBuilder({
      baseIri,
      'prefixes': CLI_PREFIXES
    }).addShaclFromQuads(shaclQuads);
    const outPath = Build.outputPath(output, outputFile, 'shacl.jsonld');

    writeFileSync(outPath, JSON.stringify(builder.shaclObject(), null, 2));
    writer.out(`Built ${graphs.length} graph(s) → ${output}/`);
  }
}

// ---------------------------------------------------------------------------
// Viz command
// ---------------------------------------------------------------------------

class Viz {
  static async run(options: VizOptionsEntity.Type): Promise<void> {
    const {
      noOpen, output, 'schema': schemaGlob
    } = options;
    const schemas = SchemaLoader.loadFiles(schemaGlob);
    const prefixes = PrefixDerivation.fromSchemas(schemas);
    const registry = new SchemaRegistry(Object.keys(prefixes).length > 0 ? { prefixes } : undefined);

    for (const schema of schemas) {
      const id = schema.$id;

      if (typeof id === 'string') {
        registry.set(schema, id);
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
      Browser.open(outputPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Owl-gen command
// ---------------------------------------------------------------------------

class OwlGen {
  private static async readStdin(): Promise<string> {
    return new Promise<string>((res: (value: string) => void): void => {
      const chunks: Buffer[] = [];

      process.stdin.on('data', (chunk: Buffer): void => {
        chunks.push(chunk);
      });
      process.stdin.on('end', (): void => {
        res(Buffer.concat(chunks).toString('utf8'));
      });
    });
  }

  static async run(
    input: string,
    options: { 'baseIri'?: string;
      'mode'?: string;
      'name'?: string;
      'out': string }
  ): Promise<void> {
    const {
      writeFromTbox, writeRegistryDirectory
    } = await import('./owl-gen-node/index.js');
    const fs = await import('node:fs');
    const path = await import('node:path');

    const jsonLdSource = input === '-'
      ? await OwlGen.readStdin()
      : fs.readFileSync(resolve(input), 'utf8');

    const parsed = JSON.parse(jsonLdSource) as Record<string, unknown>;
    const inferredName = options.name ?? basename(input, path.extname(input)).replaceAll(NON_ALPHANUMERIC_ASCII, '_');
    const outPath = options.out;
    const isDirectoryMode = options.mode === 'directory'
      || (options.mode !== 'single' && !outPath.endsWith('.ts'));

    if (isDirectoryMode) {
      const outDir = resolve(outPath);
      const fileResult = writeRegistryDirectory({
        ...(!(options.baseIri === undefined) && { 'baseIri': options.baseIri }),
        'input': parsed,
        'name': inferredName,
        'outDir': outDir,
        'sourceLabel': input
      });

      writer.out(`Generated registry directory (${fileResult.entityFiles.length} entities + index.ts) → ${outPath}`);
    } else {
      writeFromTbox({
        ...(!(options.baseIri === undefined) && { 'baseIri': options.baseIri }),
        'input': parsed,
        'name': inferredName,
        'output': resolve(outPath),
        'sourceLabel': input
      });

      writer.out(`Generated ${options.out} from ${input}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Commander program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('json-tology')
  .description('Ontology-native type system with declarative JSON Schema authoring')
  .version(pkg.version);

program
  .command('build')
  .description('Generate graph artifacts, ontology, or SHACL from JSON Schema files')
  .requiredOption('--schema <glob>', 'Schema file glob pattern')
  .requiredOption('--output <dir>', 'Output directory')
  .option('--format <type>', 'Output format: artifact, schema, ontology, shacl', 'artifact')
  .option('--base-iri <iri>', 'Base IRI for ontology output')
  .option('--output-file <filename>', 'Override output filename (for single-file formats)')
  .action(async (options: { 'baseIri'?: string;
    'format': string;
    'output': string;
    'outputFile'?: string;
    'schema': string }): Promise<void> => {
    await Build.run(options);
  });

program
  .command('viz')
  .description('Generate interactive schema graph visualization')
  .requiredOption('--schema <glob>', 'Schema file glob pattern')
  .option('--output <file>', 'Output HTML file', 'schema-graph.html')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options: { 'noOpen': boolean;
    'output': string;
    'schema': string }): Promise<void> => {
    await Viz.run(options);
  });

program
  .command('owl-gen <input>')
  .description('Generate TypeScript registry source from an OWL 2 JSON-LD ontology')
  .requiredOption('--out <path>', 'Output path: a .ts file (single-file mode) or a directory without .ts extension (registry-directory mode)')
  .option('--name <name>', 'Registry constant name (defaults to the input filename basename)')
  .option('--base-iri <iri>', 'Override the base IRI used in the generated registry')
  .option('--mode <mode>', 'Emission mode: "single" (default when --out ends in .ts) or "directory"')
  .action(async (input: string, options: { 'baseIri'?: string;
    'mode'?: string;
    'name'?: string;
    'out': string }): Promise<void> => {
    await OwlGen.run(input, options);
  });

try {
  await program.parseAsync(process.argv);
} catch (error) {
  writer.error(String(error));
  writer.exit(1);
}
