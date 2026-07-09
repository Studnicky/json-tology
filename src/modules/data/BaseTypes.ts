import type { JsonSchemaDocumentType } from '../../types/Schema.js';
import { DEFAULT_DIALECT_URI } from '../../constants/DIALECT.js';
import {
  CURSOR_DEF,
  DURATION_DEF,
  ERROR_DETAILS_DEF,
  FILTER_DEF,
  PAGE_DEF,
  PAGINATION_DEF,
  PROGRESS_DEF,
  RESPONSE_DEF,
  RESULT_DEF,
  SORT_ORDER_DEF,
  STATE_SNAPSHOT_DEF,
  TIMED_DEF,
  TIMESTAMPED_DEF
} from '../../constants/BASE_SCHEMAS.js';

export const BaseTypes = {
  'FilterSchema': {
    ...FILTER_DEF,
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
    ...PAGE_DEF,
    '$id': 'https://json-tology.dev/schemas/base-types/page.schema.json'
  } as const,

  'PaginationSchema': {
    ...PAGINATION_DEF,
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
    ...RESPONSE_DEF,
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
    ...RESULT_DEF,
    '$id': 'https://json-tology.dev/schemas/base-types/result.schema.json'
  } as const,

  'Schema': {
    '$defs': {
      'Cursor': CURSOR_DEF,
      'Duration': DURATION_DEF,
      'ErrorDetails': ERROR_DETAILS_DEF,
      'Filter': FILTER_DEF,
      'Page': PAGE_DEF,
      'Pagination': PAGINATION_DEF,
      'Progress': PROGRESS_DEF,
      'Response': RESPONSE_DEF,
      'Result': RESULT_DEF,
      'SortOrder': SORT_ORDER_DEF,
      'StateSnapshot': STATE_SNAPSHOT_DEF,
      'Timed': TIMED_DEF,
      'Timestamped': TIMESTAMPED_DEF
    },
    '$id': 'https://json-tology.dev/schemas/base-types.schema.json',
    '$schema': DEFAULT_DIALECT_URI,
    'description': 'Core container types and patterns used across multiple domains',
    'title': 'Base Types',
    'type': 'object'
  } as const
} as const;
