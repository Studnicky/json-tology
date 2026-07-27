import type { JsonSchemaObjectType } from '../types/JsonSchemaObjectType.js';

/**
 * Documented `@studnicky/type-alias-invariants` exception: this union's contract
 * classification cascades from {@link JsonSchemaObjectType}'s own documented
 * exception (see the file-level comment in `JsonSchemaObjectType.ts`) — a mapped
 * type counts as contract evidence there, and no independent fix exists here
 * without breaking that file's `whole-canonical-types` constraint.
 */
export type JsonSchemaDefinitionType = boolean | JsonSchemaObjectType;
