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
  SchemaLoadError, SchemaLoadResult, SchemaLogger
} from '../interfaces/loader.js';
import { SilentLogger } from '../SilentLogger.js';

export type {
  SchemaLoadError, SchemaLoadResult, SchemaLogger
} from '../interfaces/loader.js';

/**
 * Schema Loader
 *
 * Loads and validates schemas from the file system.
 */
export class SchemaLoader {
  /**
   * Create a new SchemaLoader with optional logger.
   *
   * @param logger - Optional logger (defaults to silent)
   */
  public constructor(private readonly logger: SchemaLogger = SilentLogger) {}

  /**
   * Check if an object is a valid schema.
   *
   * @param schema - Schema to validate
   * @returns true if valid schema
   */
  private isValidSchema(schema: Record<string, unknown>): boolean {
    // Minimal validation: has $id and type or properties
    if (schema.$id === undefined || schema.$id === null || schema.$id === '') {
      return false;
    }

    // Either has type or $defs or properties
    const hasType = 'type' in schema;
    const hasDefs = '$defs' in schema;
    const hasProperties = 'properties' in schema;

    return hasType || hasDefs || hasProperties;
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
  ): [schemas: Array<Record<string, unknown>>, result: SchemaLoadResult] {
    const absolutePath = resolve(dirPath);
    const schemas: Array<Record<string, unknown>> = [];
    const errors: SchemaLoadError[] = [];
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
              throw new Error(`Stopping: ${relativePath}`, { 'cause': jsonError });
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
              throw new Error(`Stopping: ${relativePath}`);
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
              'reason': 'no-id'
            });
            failed++;
            if (stopOnError) {
              throw new Error(`Stopping: ${relativePath}`);
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
              throw new Error(`Stopping: ${relativePath}`);
            }

            continue;
          }

          // Validate schema
          if (!this.isValidSchema(schemaObj)) {
            this.logger.warn(`Invalid schema structure: ${relativePath}`);
            errors.push({
              'file': relativePath,
              'message': 'Schema missing required properties',
              'reason': 'invalid-schema'
            });
            failed++;
            if (stopOnError) {
              throw new Error(`Stopping: ${relativePath}`);
            }

            continue;
          }

          seenIds.add(schemaId);
          schemas.push(schemaObj);
          successful++;
          this.logger.trace(`Loaded schema: ${schemaId} (${relativePath})`);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('Stopping:')) {
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
            throw new Error(`Stopping: ${relativePath}`, { 'cause': error });
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Stopping:')) {
        this.logger.warn('Loading stopped due to error');
      } else {
        this.logger.error(`Failed to scan directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const result: SchemaLoadResult = {
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

      if (!this.isValidSchema(schema)) {
        this.logger.warn(`Schema missing required properties: ${filePath}`);

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
}
