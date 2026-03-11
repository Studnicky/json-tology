/**
 * Schema Loader
 *
 * Loads JSON schemas from files and directories.
 * Supports validation, error reporting, and batch registration.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, relative } from 'path';
import type { SchemaLoadResult, SchemaLoadError, SchemaLogger } from '../interfaces/loader.js';
import { SilentLogger } from '../SilentLogger.js';

export type { SchemaLoadResult, SchemaLoadError, SchemaLogger } from '../interfaces/loader.js';

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
   * Load a single schema from a file.
   *
   * @param filePath - Path to schema JSON file
   * @returns Schema object or null if invalid
   */
  public loadSchema(filePath: string): Record<string, unknown> | null {
    const absolutePath = resolve(filePath);

    try {
      const content = readFileSync(absolutePath, 'utf-8');
      const schema = JSON.parse(content);

      if (!this.isValidSchema(schema)) {
        this.logger.warn(`Schema missing required properties: ${filePath}`);
        return null;
      }

      return schema;
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.logger.warn(`Invalid JSON in ${filePath}: ${error.message}`);
      } else {
        this.logger.error(`Failed to read ${filePath}: ${error}`);
      }
      return null;
    }
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
      stopOnError?: boolean;
      filePattern?: RegExp;
    },
  ): [schemas: Record<string, unknown>[], result: SchemaLoadResult] {
    const absolutePath = resolve(dirPath);
    const schemas: Record<string, unknown>[] = [];
    const errors: SchemaLoadError[] = [];
    const seenIds = new Set<string>();
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    const filePattern = options?.filePattern ?? /\.json$/i;
    const stopOnError = options?.stopOnError ?? false;

    this.logger.info(`Loading schemas from: ${absolutePath}`);

    try {
      this.scanDirectory(absolutePath, (filePath) => {
        const relativePath = relative(absolutePath, filePath);

        // Check file extension
        if (!filePattern.test(filePath)) {
          this.logger.trace(`Skipping non-JSON file: ${relativePath}`);
          skipped++;
          return;
        }

        // Load schema
        try {
          const content = readFileSync(filePath, 'utf-8');
          let schema: unknown;

          try {
            schema = JSON.parse(content);
          } catch (jsonError) {
            const message = jsonError instanceof Error ? jsonError.message : String(jsonError);
            this.logger.warn(`Invalid JSON in ${relativePath}: ${message}`);
            errors.push({
              file: relativePath,
              reason: 'invalid-json',
              message,
            });
            failed++;
            if (stopOnError) throw new Error(`Stopping: ${relativePath}`);
            return;
          }

          // Validate schema structure
          if (typeof schema !== 'object' || schema === null) {
            this.logger.warn(`Not a schema object: ${relativePath}`);
            errors.push({
              file: relativePath,
              reason: 'invalid-schema',
              message: 'Schema must be an object',
            });
            failed++;
            if (stopOnError) throw new Error(`Stopping: ${relativePath}`);
            return;
          }

          const schemaObj = schema as Record<string, unknown>;

          // Check for $id
          if (!schemaObj['$id']) {
            this.logger.warn(`Schema missing $id: ${relativePath}`);
            errors.push({
              file: relativePath,
              reason: 'no-id',
              message: 'Schema must have $id property',
            });
            failed++;
            if (stopOnError) throw new Error(`Stopping: ${relativePath}`);
            return;
          }

          const schemaId = schemaObj['$id'] as string;

          // Check for duplicates
          if (seenIds.has(schemaId)) {
            this.logger.warn(`Duplicate schema $id: ${schemaId} (in ${relativePath})`);
            errors.push({
              file: relativePath,
              reason: 'duplicate-id',
              message: `Duplicate $id: ${schemaId}`,
            });
            failed++;
            if (stopOnError) throw new Error(`Stopping: ${relativePath}`);
            return;
          }

          // Validate schema
          if (!this.isValidSchema(schemaObj)) {
            this.logger.warn(`Invalid schema structure: ${relativePath}`);
            errors.push({
              file: relativePath,
              reason: 'invalid-schema',
              message: 'Schema missing required properties',
            });
            failed++;
            if (stopOnError) throw new Error(`Stopping: ${relativePath}`);
            return;
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
            file: relativePath,
            reason: 'unknown',
            message,
          });
          failed++;
          if (stopOnError) throw new Error(`Stopping: ${relativePath}`);
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Stopping:')) {
        this.logger.warn(`Loading stopped due to error`);
      } else {
        this.logger.error(`Failed to scan directory: ${error}`);
      }
    }

    const result: SchemaLoadResult = {
      successful,
      failed,
      skipped,
      errors,
    };

    this.logger.info(
      `Load complete: ${successful} loaded, ${failed} failed, ${skipped} skipped`,
    );

    return [schemas, result];
  }

  /**
   * Check if an object is a valid schema.
   *
   * @param schema - Schema to validate
   * @returns true if valid schema
   */
  private isValidSchema(schema: Record<string, unknown>): boolean {
    // Minimal validation: has $id and type or properties
    if (!schema['$id']) {
      return false;
    }

    // Either has type or $defs or properties
    const hasType = 'type' in schema;
    const hasDefs = '$defs' in schema;
    const hasProperties = 'properties' in schema;

    return hasType || hasDefs || hasProperties;
  }

  /**
   * Recursively scan a directory.
   *
   * @param dirPath - Directory path
   * @param callback - Callback for each file
   */
  private scanDirectory(dirPath: string, callback: (filePath: string) => void): void {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = resolve(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recurse into subdirectories
          this.scanDirectory(fullPath, callback);
        } else if (entry.isFile()) {
          callback(fullPath);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to scan directory ${dirPath}: ${error}`);
    }
  }
}
