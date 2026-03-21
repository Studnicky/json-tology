/**
 * Schema Loader
 *
 * Loads JSON schemas from files and directories.
 * Supports validation, error reporting, and batch registration.
 */

import {
  readdirSync, readFileSync
} from 'node:fs';
import {
  relative, resolve
} from 'node:path';
import type {
  SchemaLoadErrorType, SchemaLoadResultType
} from '../../types/loader.js';
import type { LoggerInterface } from '../../interfaces/logger.js';
import type { SchemaLoaderInterface } from '../../interfaces/schema-loader-impl.js';
import { LoadError } from '../../errors/LoadError.js';
import { SILENT_LOGGER } from '../../constants/logger.js';


/**
 * Schema Loader
 *
 * Loads and validates schemas from the file system.
 */
export class SchemaLoader implements SchemaLoaderInterface {
  /**
   * Create a new SchemaLoader with optional logger.
   *
   * @param logger - Optional logger (defaults to silent)
   */
  public constructor(private readonly logger: LoggerInterface = SILENT_LOGGER) {}

  /**
   * Collect all $anchor values in a schema and return duplicates.
   */
  private findDuplicateAnchors(schema: Record<string, unknown>): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    const walk = (node: unknown): void => {
      if (typeof node !== 'object' || node === null || Array.isArray(node)) {
        return;
      }

      const obj = node as Record<string, unknown>;

      if (typeof obj.$anchor === 'string') {
        if (seen.has(obj.$anchor)) {
          duplicates.add(obj.$anchor);
        } else {
          seen.add(obj.$anchor);
        }
      }

      for (const value of Object.values(obj)) {
        walk(value);
      }
    };

    walk(schema);

    return [...duplicates];
  }

  /**
   * Load all schemas from a directory (recursively).
   *
   * @param dirPath - Directory path
   * @param options - Loading options
   * @returns Array of loaded schemas and load result
   */
  public loadDirectory(
    dirPath: string,
    options?: {
      'filePattern'?: RegExp;
      'stopOnError'?: boolean;
    }
  ): [schemas: Array<Record<string, unknown>>, result: SchemaLoadResultType] {
    const absolutePath = resolve(dirPath);
    const schemas: Array<Record<string, unknown>> = [];
    const errors: SchemaLoadErrorType[] = [];
    const seenIds = new Set<string>();
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    const filePattern = options?.filePattern ?? /\.json$/iu;
    const stopOnError = options?.stopOnError ?? false;

    this.logger.info(`Loading schemas from: ${absolutePath}`);

    try {
      const filePaths = this.scanDirectory(absolutePath);

      for (const filePath of filePaths) {
        const relativePath = relative(absolutePath, filePath);

        // Check file extension
        if (!filePattern.test(filePath)) {
          this.logger.trace(`Skipping non-JSON file: ${relativePath}`);
          skipped++;

          continue;
        }

        // Load schema
        try {
          const content = readFileSync(filePath, 'utf8');
          let schema: unknown;

          try {
            schema = JSON.parse(content);
          } catch (jsonError) {
            const message = jsonError instanceof Error ? jsonError.message : String(jsonError);

            this.logger.warn(`Invalid JSON in ${relativePath}: ${message}`);
            errors.push({
              'file': relativePath,
              message,
              'reason': 'invalid-json'
            });
            failed++;
            if (stopOnError) {
              throw new LoadError('LOAD_INVALID_JSON', `Stopping: ${relativePath}`, relativePath, { 'cause': jsonError as Error });
            }

            continue;
          }

          // Validate schema structure
          if (typeof schema !== 'object' || schema === null) {
            this.logger.warn(`Not a schema object: ${relativePath}`);
            errors.push({
              'file': relativePath,
              'message': 'Schema must be an object',
              'reason': 'invalid-schema'
            });
            failed++;
            if (stopOnError) {
              throw new LoadError('LOAD_INVALID_SCHEMA', `Stopping: ${relativePath}`, relativePath);
            }

            continue;
          }

          const schemaObj = schema as Record<string, unknown>;

          // Check for $id
          if (schemaObj.$id === undefined || schemaObj.$id === null || schemaObj.$id === '') {
            this.logger.warn(`Schema missing $id: ${relativePath}`);
            errors.push({
              'file': relativePath,
              'message': 'Schema must have $id property',
              'reason': 'missing-id'
            });
            failed++;
            if (stopOnError) {
              throw new LoadError('LOAD_MISSING_ID', `Stopping: ${relativePath}`, relativePath);
            }

            continue;
          }

          const schemaId = schemaObj.$id as string;

          // Check for duplicates
          if (seenIds.has(schemaId)) {
            this.logger.warn(`Duplicate schema $id: ${schemaId} (in ${relativePath})`);
            errors.push({
              'file': relativePath,
              'message': `Duplicate $id: ${schemaId}`,
              'reason': 'duplicate-id'
            });
            failed++;
            if (stopOnError) {
              throw new LoadError('LOAD_DUPLICATE_ID', `Stopping: ${relativePath}`, relativePath);
            }

            continue;
          }

          // Validate schema structure
          const validationFailures = this.validateSchema(schemaObj);

          if (validationFailures.length > 0) {
            const failureMsg = validationFailures.join('; ');

            this.logger.warn(`Invalid schema structure in ${relativePath}: ${failureMsg}`);
            errors.push({
              'file': relativePath,
              'message': failureMsg,
              'reason': 'invalid-schema'
            });
            failed++;
            if (stopOnError) {
              throw new LoadError('LOAD_INVALID_SCHEMA', `Stopping: ${relativePath}`, relativePath);
            }

            continue;
          }

          // Check for duplicate $anchor values
          const duplicateAnchors = this.findDuplicateAnchors(schemaObj);

          if (duplicateAnchors.length > 0) {
            const anchorsStr = duplicateAnchors.join(', ');

            this.logger.warn(`Duplicate $anchor values in ${relativePath}: ${anchorsStr}`);
            errors.push({
              'file': relativePath,
              'message': `Duplicate $anchor values: ${anchorsStr}`,
              'reason': 'duplicate-anchor'
            });
            failed++;
            if (stopOnError) {
              throw new LoadError('LOAD_DUPLICATE_ANCHOR', `Stopping: ${relativePath}`, relativePath);
            }

            continue;
          }

          seenIds.add(schemaId);
          schemas.push(schemaObj);
          successful++;
          this.logger.trace(`Loaded schema: ${schemaId} (${relativePath})`);
        } catch (error) {
          if (error instanceof LoadError) {
            throw error;
          }
          const message = error instanceof Error ? error.message : String(error);

          this.logger.warn(`Failed to load ${relativePath}: ${message}`);
          errors.push({
            'file': relativePath,
            message,
            'reason': 'unknown'
          });
          failed++;
          if (stopOnError) {
            throw new LoadError('LOAD_IO_FAILURE', `Stopping: ${relativePath}`, relativePath, { 'cause': error instanceof Error ? error : new Error(String(error)) });
          }
        }
      }
    } catch (error) {
      if (error instanceof LoadError) {
        this.logger.warn('Loading stopped due to error');
      } else {
        this.logger.error(`Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const result: SchemaLoadResultType = {
      errors,
      failed,
      skipped,
      successful
    };

    this.logger.info(`Load complete: ${successful} loaded, ${failed} failed, ${skipped} skipped`);

    return [
      schemas,
      result
    ];
  }

  /**
   * Load a single schema from a file.
   *
   * @param filePath - Path to schema JSON file
   * @returns Schema object or null if invalid
   */
  public loadSchema(filePath: string): null | Record<string, unknown> {
    const absolutePath = resolve(filePath);

    try {
      const content = readFileSync(absolutePath, 'utf8');
      const parsed: unknown = JSON.parse(content);

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        this.logger.warn(`Schema missing required properties: ${filePath}`);

        return null;
      }

      const schema = parsed as Record<string, unknown>;

      const validationFailures = this.validateSchema(schema);

      if (validationFailures.length > 0) {
        this.logger.warn(`Invalid schema in ${filePath}: ${validationFailures.join('; ')}`);

        return null;
      }

      const duplicateAnchors = this.findDuplicateAnchors(schema);

      if (duplicateAnchors.length > 0) {
        this.logger.warn(`Duplicate $anchor values in ${filePath}: ${duplicateAnchors.join(', ')}`);

        return null;
      }

      return schema;
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.logger.warn(`Invalid JSON in ${filePath}: ${error.message}`);
      } else {
        this.logger.error(`Failed to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }

      return null;
    }
  }

  /**
   * Recursively scan a directory.
   *
   * @param dirPath - Directory path
   * @returns Collected file paths
   */
  private scanDirectory(dirPath: string): string[] {
    const files: string[] = [];

    try {
      const entries = readdirSync(dirPath, { 'withFileTypes': true });

      for (const entry of entries) {
        const fullPath = resolve(dirPath, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.scanDirectory(fullPath));
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to scan directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return files;
  }

  /**
   * Validate authored-schema structure beyond minimal shape checks.
   * Returns an array of validation failure messages (empty if valid).
   */
  private validateSchema(schema: Record<string, unknown>): string[] {
    const failures: string[] = [];

    // $id must be a non-empty string
    if (typeof schema.$id !== 'string' || schema.$id === '') {
      failures.push('$id must be a non-empty string');

      // can't continue without $id
      return failures;
    }

    // $id should look like a URI
    if (!/^[a-z][a-z0-9+.-]*:/iu.test(schema.$id)) {
      failures.push(`$id must be a valid URI: "${schema.$id}"`);
    }

    // Must have at least one of: type, $defs, properties, allOf, anyOf, oneOf, $ref, const, enum
    const hasStructure = [
      'type',
      '$defs',
      'properties',
      'allOf',
      'anyOf',
      'oneOf',
      '$ref',
      'const',
      'enum'
    ]
      .some((k) => {
        return k in schema;
      });

    if (!hasStructure) {
      failures.push('Schema must have at least one structural keyword (type, $defs, properties, allOf, anyOf, oneOf, $ref, const, or enum)');
    }

    // type must be a valid JSON Schema type string or array of type strings
    if ('type' in schema) {
      const validTypes = new Set([
        'array',
        'boolean',
        'integer',
        'null',
        'number',
        'object',
        'string'
      ]);

      if (typeof schema.type === 'string') {
        if (!validTypes.has(schema.type)) {
          failures.push(`Invalid type: "${schema.type}"`);
        }
      } else if (Array.isArray(schema.type)) {
        for (const typeValue of schema.type) {
          if (typeof typeValue !== 'string' || !validTypes.has(typeValue)) {
            failures.push(`Invalid type in type array: ${JSON.stringify(typeValue)}`);
          }
        }
      } else {
        failures.push(`type must be a string or array of strings, got ${typeof schema.type}`);
      }
    }

    // Composition keywords must be arrays
    for (const keyword of [
      'allOf',
      'anyOf',
      'oneOf'
    ] as const) {
      if (keyword in schema && !Array.isArray(schema[keyword])) {
        failures.push(`${keyword} must be an array`);
      }
    }

    // $ref must be a string
    if ('$ref' in schema && typeof schema.$ref !== 'string') {
      failures.push('$ref must be a string');
    }

    // $schema must be a string URI if present
    if ('$schema' in schema && (typeof schema.$schema !== 'string' || !/^https?:/iu.test(schema.$schema))) {
      failures.push('$schema must be a valid URI string');
    }

    // properties must be an object
    if ('properties' in schema && (typeof schema.properties !== 'object' || schema.properties === null || Array.isArray(schema.properties))) {
      failures.push('properties must be an object');
    }

    // required must be an array of strings
    if ('required' in schema) {
      if (!Array.isArray(schema.required)) {
        failures.push('required must be an array');
      } else if (schema.required.some((item: unknown) => {
        return typeof item !== 'string';
      })) {
        failures.push('required entries must be strings');
      }
    }

    return failures;
  }
}
