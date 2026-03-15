import { ValidationErrors } from '../../errors/ValidationErrors.js';
import { Hash } from '../hash/Hash.js';
import { SchemaError } from '../../errors/SchemaError.js';

import type { CompiledValidatorInterface } from '../../interfaces/compiler.js';
import type { GraphEngine } from '../graph/GraphEngine.js';
import type { SchemaGraph } from '../graph/SchemaGraph.js';

export const NO_ERRORS: string[] = Object.freeze([]) as unknown as string[];
export const NO_VALIDATION_ERRORS = new ValidationErrors([]);

export interface SchemaRegistryEntryInterface {
  'compiled'?: CompiledValidatorInterface;
  'engine'?: GraphEngine;
  'graph'?: SchemaGraph;
  'hash': string;
  'schema': Record<string, unknown>;
}

export function collectAnchors(schema: Record<string, unknown>, seen: Set<string>, schemaId: string): void {
  if (typeof schema.$anchor === 'string') {
    if (seen.has(schema.$anchor)) {
      throw new SchemaError(
        'SCHEMA_DUPLICATE_ANCHOR',
        `Duplicate $anchor "${schema.$anchor}" in schema "${schemaId}"`,
        schemaId
      );
    }
    seen.add(schema.$anchor);
  }
  if (typeof schema.$dynamicAnchor === 'string') {
    if (seen.has(schema.$dynamicAnchor)) {
      throw new SchemaError(
        'SCHEMA_DUPLICATE_ANCHOR',
        `Duplicate $dynamicAnchor "${schema.$dynamicAnchor}" in schema "${schemaId}"`,
        schemaId
      );
    }
    seen.add(schema.$dynamicAnchor);
  }

  for (const value of Object.values(schema)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      collectAnchors(value as Record<string, unknown>, seen, schemaId);
    }
  }
}

export function hashSchema(schema: Record<string, unknown>): string {
  const {
    '$id': _, ...rest
  } = schema;

  return Hash.value(rest);
}

export function resolveSchemaId(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string): string {
  return typeof schemaOrId === 'string' ? schemaOrId : schemaOrId.$id;
}
