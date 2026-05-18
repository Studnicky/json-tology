import type { JsonSchemaDocumentType } from '../../types/Schema.js';
import { DEFAULT_DIALECT_URI } from '../../constants/DIALECT.js';
import {
  CursorDef,
  DurationDef,
  ErrorDetailsDef,
  FilterDef,
  PageDef,
  PaginationDef,
  ProgressDef,
  ResponseDef,
  ResultDef,
  SortOrderDef,
  StateSnapshotDef,
  TimedDef,
  TimestampedDef
} from '../../constants/BASE_SCHEMAS.js';

export {
  CursorDef,
  DurationDef,
  ErrorDetailsDef,
  FilterDef,
  PageDef,
  PaginationDef,
  ProgressDef,
  ResponseDef,
  ResultDef,
  SortOrderDef,
  StateSnapshotDef,
  TimedDef,
  TimestampedDef
} from '../../constants/BASE_SCHEMAS.js';

export const BaseTypes = {
  'FilterSchema': {
    ...FilterDef,
    '$id': 'https://json-tology.dev/schemas/base-types/filter.schema.json'
  } as const,

  'page': <TItem extends JsonSchemaDocumentType, TId extends string>(
    itemSchema: TItem,
    id: TId
  ) => {
    return {
      '$id': id,
      'description': 'A page of results with pagination metadata',
      'properties': {
        'hasNext': { 'type': 'boolean' },
        'hasPrev': { 'type': 'boolean' },
        'items': {
          'items': itemSchema,
          'type': 'array'
        },
        'nextCursor': { 'type': 'string' },
        'page': {
          'minimum': 1,
          'type': 'number'
        },
        'pageSize': {
          'minimum': 1,
          'type': 'number'
        },
        'prevCursor': { 'type': 'string' },
        'total': {
          'minimum': 0,
          'type': 'number'
        },
        'totalPages': {
          'minimum': 0,
          'type': 'number'
        }
      },
      'required': [
        'items',
        'total',
        'page',
        'pageSize'
      ],
      'type': 'object'
    } as const;
  },

  'PageSchema': {
    ...PageDef,
    '$id': 'https://json-tology.dev/schemas/base-types/page.schema.json'
  } as const,

  'PaginationSchema': {
    ...PaginationDef,
    '$id': 'https://json-tology.dev/schemas/base-types/pagination.schema.json'
  } as const,

  'response': <TBody extends JsonSchemaDocumentType, TId extends string>(
    bodySchema: TBody,
    id: TId
  ) => {
    return {
      '$id': id,
      'description': 'Generic response container',
      'properties': {
        'body': bodySchema,
        'message': { 'type': 'string' },
        'statusCode': { 'type': 'number' },
        'success': { 'type': 'boolean' },
        'timestamp': { 'type': 'number' }
      },
      'required': ['success'],
      'type': 'object'
    } as const;
  },

  'ResponseSchema': {
    ...ResponseDef,
    '$id': 'https://json-tology.dev/schemas/base-types/response.schema.json'
  } as const,

  'result': <TData extends JsonSchemaDocumentType, TId extends string>(
    dataSchema: TData,
    id: TId
  ) => {
    return {
      '$id': id,
      'description': 'Generic result container',
      'properties': {
        'data': dataSchema,
        'errorCode': { 'type': 'string' },
        'errors': {
          'items': { 'type': 'string' },
          'type': 'array'
        },
        'success': { 'type': 'boolean' },
        'timestamp': { 'type': 'number' }
      },
      'required': ['success'],
      'type': 'object'
    } as const;
  },

  'ResultSchema': {
    ...ResultDef,
    '$id': 'https://json-tology.dev/schemas/base-types/result.schema.json'
  } as const,

  'Schema': {
    '$defs': {
      'Cursor': CursorDef,
      'Duration': DurationDef,
      'ErrorDetails': ErrorDetailsDef,
      'Filter': FilterDef,
      'Page': PageDef,
      'Pagination': PaginationDef,
      'Progress': ProgressDef,
      'Response': ResponseDef,
      'Result': ResultDef,
      'SortOrder': SortOrderDef,
      'StateSnapshot': StateSnapshotDef,
      'Timed': TimedDef,
      'Timestamped': TimestampedDef
    },
    '$id': 'https://json-tology.dev/schemas/base-types.schema.json',
    '$schema': DEFAULT_DIALECT_URI,
    'description': 'Core container types and patterns used across multiple domains',
    'title': 'Base Types',
    'type': 'object'
  } as const
} as const;
