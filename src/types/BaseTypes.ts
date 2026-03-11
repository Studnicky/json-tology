/**
 * Base Types
 *
 * Core container types and patterns used across multiple domains.
 */

import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

export namespace BaseTypes {
  /* ── Schema definitions ── */

  const DurationDef = {
    description: 'Duration information',
    properties: {
      duration: { type: 'number' },
      unit: {
        enum: ['ms', 's', 'm', 'h'],
        type: 'string',
      },
    },
    required: ['duration'],
    type: 'object',
  } as const;

  const ErrorDetailsDef = {
    description: 'Core error information',
    properties: {
      code: { type: 'string' },
      details: { type: 'object' },
      message: { type: 'string' },
    },
    required: ['message'],
    type: 'object',
  } as const;

  const ProgressDef = {
    description: 'Progress/lifecycle state',
    properties: {
      phase: { type: 'string' },
      progress: {
        maximum: 1,
        minimum: 0,
        type: 'number',
      },
      timeRemaining: { type: 'number' },
    },
    required: ['progress'],
    type: 'object',
  } as const;

  const TimedDef = {
    description: 'Basic timestamp wrapper',
    properties: {
      timestamp: { type: 'number' },
    },
    required: ['timestamp'],
    type: 'object',
  } as const;

  const TimestampedDef = {
    description: 'Timestamped with duration',
    properties: {
      duration: { type: 'number' },
      endTime: { type: 'number' },
      startTime: { type: 'number' },
    },
    required: ['startTime', 'endTime', 'duration'],
    type: 'object',
  } as const;

  const ResponseDef = {
    description: 'Generic response container',
    properties: {
      body: { type: 'object' },
      message: { type: 'string' },
      statusCode: { type: 'number' },
      success: { type: 'boolean' },
      timestamp: { type: 'number' },
    },
    required: ['success'],
    type: 'object',
  } as const;

  const ResultDef = {
    description: 'Generic result container',
    properties: {
      data: { type: 'object' },
      errorCode: { type: 'string' },
      errors: {
        items: { type: 'string' },
        type: 'array',
      },
      success: { type: 'boolean' },
      timestamp: { type: 'number' },
    },
    required: ['success'],
    type: 'object',
  } as const;

  const StateSnapshotDef = {
    description: 'State snapshot container with metadata',
    properties: {
      count: { type: 'number' },
      items: { type: 'array' },
      metadata: { type: 'object' },
      timestamp: { type: 'number' },
    },
    required: ['items'],
    type: 'object',
  } as const;

  const SortOrderDef = {
    description: 'Sort direction for ordered results',
    enum: ['asc', 'desc'],
    type: 'string',
  } as const;

  const CursorDef = {
    description: 'Opaque pagination cursor',
    type: 'string',
  } as const;

  const PaginationDef = {
    description: 'Pagination request parameters',
    properties: {
      cursor: { type: 'string' },
      page: { default: 1, minimum: 1, type: 'number' },
      pageSize: { default: 20, maximum: 1000, minimum: 1, type: 'number' },
      sortBy: { type: 'string' },
      sortOrder: SortOrderDef,
    },
    required: [] as const,
    type: 'object',
  } as const;

  const FilterDef = {
    description: 'Generic filter specification',
    properties: {
      field: { type: 'string' },
      operator: {
        enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'startsWith', 'endsWith'],
        type: 'string',
      },
      value: {},
    },
    required: ['field', 'operator'],
    type: 'object',
  } as const;

  const PageDef = {
    description: 'A page of results with pagination metadata',
    properties: {
      hasNext: { type: 'boolean' },
      hasPrev: { type: 'boolean' },
      items: { items: { type: 'object' }, type: 'array' },
      nextCursor: { type: 'string' },
      page: { minimum: 1, type: 'number' },
      pageSize: { minimum: 1, type: 'number' },
      prevCursor: { type: 'string' },
      total: { minimum: 0, type: 'number' },
      totalPages: { minimum: 0, type: 'number' },
    },
    required: ['items', 'total', 'page', 'pageSize'],
    type: 'object',
  } as const;

  export const Schema = {
    $defs: {
      Cursor: CursorDef,
      Duration: DurationDef,
      ErrorDetails: ErrorDetailsDef,
      Filter: FilterDef,
      Page: PageDef,
      Pagination: PaginationDef,
      Progress: ProgressDef,
      Response: ResponseDef,
      Result: ResultDef,
      SortOrder: SortOrderDef,
      StateSnapshot: StateSnapshotDef,
      Timed: TimedDef,
      Timestamped: TimestampedDef,
    },
    $id: 'https://json-tology.dev/schemas/base-types.schema.json',
    $schema: 'http://json-schema.org/draft-07/schema#',
    description: 'Core container types and patterns used across multiple domains',
    title: 'Base Types',
    type: 'object',
  } as const;

  /* ── Individual standalone schemas (for direct registration and validation) ── */

  export const ResponseSchema = {
    ...ResponseDef,
    $id: 'https://json-tology.dev/schemas/base-types/response.schema.json',
  } as const;

  export const ResultSchema = {
    ...ResultDef,
    $id: 'https://json-tology.dev/schemas/base-types/result.schema.json',
  } as const;

  export const PaginationSchema = {
    ...PaginationDef,
    $id: 'https://json-tology.dev/schemas/base-types/pagination.schema.json',
  } as const;

  export const FilterSchema = {
    ...FilterDef,
    $id: 'https://json-tology.dev/schemas/base-types/filter.schema.json',
  } as const;

  export const PageSchema = {
    ...PageDef,
    $id: 'https://json-tology.dev/schemas/base-types/page.schema.json',
  } as const;

  /* ── Schema-derived types ── */

  export type Duration     = FromSchema<typeof DurationDef>;
  export type ErrorDetails = FromSchema<typeof ErrorDetailsDef>;
  export type Progress     = FromSchema<typeof ProgressDef>;
  export type Timed        = FromSchema<typeof TimedDef>;
  export type Timestamped  = FromSchema<typeof TimestampedDef>;
  export type SortOrder    = FromSchema<typeof SortOrderDef>;
  export type Cursor       = string;
  export type Pagination   = FromSchema<typeof PaginationDef>;
  export type Filter       = FromSchema<typeof FilterDef>;

  /**
   * Generic response container.
   * Use makeResponseSchema() to get a validatable schema for a concrete body type.
   */
  export interface Response<T> {
    body?: T;
    message?: string;
    statusCode?: number;
    success: boolean;
    timestamp?: number;
  }

  /**
   * Generic result container.
   * Use makeResultSchema() to get a validatable schema for a concrete data type.
   */
  export interface Result<T> {
    data?: T;
    errorCode?: string;
    errors?: string[];
    success: boolean;
    timestamp?: number;
  }

  /**
   * State snapshot container with metadata.
   */
  export interface StateSnapshot<T> {
    count?: number;
    items: T[];
    metadata?: Record<string, unknown>;
    timestamp?: number;
  }

  /**
   * A page of results with pagination metadata.
   * Use makePageSchema() to get a validatable schema for a concrete item type.
   */
  export interface Page<T> {
    hasNext?: boolean;
    hasPrev?: boolean;
    items: T[];
    nextCursor?: string;
    page: number;
    pageSize: number;
    prevCursor?: string;
    total: number;
    totalPages?: number;
  }
}

/* ── Schema factory functions ── */

/**
 * Create a Response schema with a concrete body type.
 *
 * @example
 * const UserResponseSchema = makeResponseSchema(
 *   UserSchema,
 *   'https://myapp.io/UserResponse'
 * );
 * type UserResponse = Infer<typeof UserResponseSchema>;
 */
export function makeResponseSchema<TBody extends JSONSchema, TId extends string>(
  bodySchema: TBody,
  id: TId,
) {
  return {
    $id: id,
    description: 'Generic response container',
    properties: {
      body: bodySchema,
      message: { type: 'string' },
      statusCode: { type: 'number' },
      success: { type: 'boolean' },
      timestamp: { type: 'number' },
    },
    required: ['success'],
    type: 'object',
  } as const;
}

/**
 * Create a Result schema with a concrete data type.
 *
 * @example
 * const UserResultSchema = makeResultSchema(
 *   UserSchema,
 *   'https://myapp.io/UserResult'
 * );
 * type UserResult = Infer<typeof UserResultSchema>;
 */
export function makeResultSchema<TData extends JSONSchema, TId extends string>(
  dataSchema: TData,
  id: TId,
) {
  return {
    $id: id,
    description: 'Generic result container',
    properties: {
      data: dataSchema,
      errorCode: { type: 'string' },
      errors: { items: { type: 'string' }, type: 'array' },
      success: { type: 'boolean' },
      timestamp: { type: 'number' },
    },
    required: ['success'],
    type: 'object',
  } as const;
}

/**
 * Create a Page schema with a concrete item type.
 *
 * @example
 * const UserPageSchema = makePageSchema(
 *   UserSchema,
 *   'https://myapp.io/UserPage'
 * );
 * type UserPage = Infer<typeof UserPageSchema>;
 * // { items: User[]; total: number; page: number; pageSize: number; ... }
 */
export function makePageSchema<TItem extends JSONSchema, TId extends string>(
  itemSchema: TItem,
  id: TId,
) {
  return {
    $id: id,
    description: 'A page of results with pagination metadata',
    properties: {
      hasNext: { type: 'boolean' },
      hasPrev: { type: 'boolean' },
      items: { items: itemSchema, type: 'array' },
      nextCursor: { type: 'string' },
      page: { minimum: 1, type: 'number' },
      pageSize: { minimum: 1, type: 'number' },
      prevCursor: { type: 'string' },
      total: { minimum: 0, type: 'number' },
      totalPages: { minimum: 0, type: 'number' },
    },
    required: ['items', 'total', 'page', 'pageSize'],
    type: 'object',
  } as const;
}
