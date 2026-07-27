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
      ...PAGE_DEF,
      '$id': id,
      'properties': {
        ...PAGE_DEF.properties,
        'items': {
          'items': itemSchema,
          'type': 'array'
        }
      }
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
      ...RESPONSE_DEF,
      '$id': id,
      'properties': {
        ...RESPONSE_DEF.properties,
        'body': bodySchema
      }
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
      ...RESULT_DEF,
      '$id': id,
      'properties': {
        ...RESULT_DEF.properties,
        'data': dataSchema
      }
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
