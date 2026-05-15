/**
 * BaseTypes — runtime schema data and schema factory methods.
 *
 * Core container schemas and per-body factory methods.
 *
 * Named following noun.verb(): `BaseTypes.response()`, `BaseTypes.result()`, `BaseTypes.page()`.
 */

import type { JSONSchema7Definition } from 'json-schema';
import { DEFAULT_DIALECT_URI } from '../../constants/DIALECT.js';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from '../../constants/PAGINATION.js';

const DurationDef = {
  'description': 'Duration information',
  'properties': {
    'duration': { 'type': 'number' },
    'unit': {
      'enum': [
        'ms',
        's',
        'm',
        'h'
      ],
      'type': 'string'
    }
  },
  'required': ['duration'],
  'type': 'object'
} as const;

const ErrorDetailsDef = {
  'description': 'Core error information',
  'properties': {
    'code': { 'type': 'string' },
    'details': { 'type': 'object' },
    'message': { 'type': 'string' }
  },
  'required': ['message'],
  'type': 'object'
} as const;

const ProgressDef = {
  'description': 'Progress/lifecycle state',
  'properties': {
    'phase': { 'type': 'string' },
    'progress': {
      'maximum': 1,
      'minimum': 0,
      'type': 'number'
    },
    'timeRemaining': { 'type': 'number' }
  },
  'required': ['progress'],
  'type': 'object'
} as const;

const TimedDef = {
  'description': 'Basic timestamp wrapper',
  'properties': { 'timestamp': { 'type': 'number' } },
  'required': ['timestamp'],
  'type': 'object'
} as const;

const TimestampedDef = {
  'description': 'Timestamped with duration',
  'properties': {
    'duration': { 'type': 'number' },
    'endTime': { 'type': 'number' },
    'startTime': { 'type': 'number' }
  },
  'required': [
    'startTime',
    'endTime',
    'duration'
  ],
  'type': 'object'
} as const;

const ResponseDef = {
  'description': 'Generic response container',
  'properties': {
    'body': { 'type': 'object' },
    'message': { 'type': 'string' },
    'statusCode': { 'type': 'number' },
    'success': { 'type': 'boolean' },
    'timestamp': { 'type': 'number' }
  },
  'required': ['success'],
  'type': 'object'
} as const;

const ResultDef = {
  'description': 'Generic result container',
  'properties': {
    'data': { 'type': 'object' },
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

const StateSnapshotDef = {
  'description': 'State snapshot container with metadata',
  'properties': {
    'count': { 'type': 'number' },
    'items': { 'type': 'array' },
    'metadata': { 'type': 'object' },
    'timestamp': { 'type': 'number' }
  },
  'required': ['items'],
  'type': 'object'
} as const;

const SortOrderDef = {
  'description': 'Sort direction for ordered results',
  'enum': [
    'asc',
    'desc'
  ],
  'type': 'string'
} as const;

const CursorDef = {
  'description': 'Opaque pagination cursor',
  'type': 'string'
} as const;

const PaginationDef = {
  'description': 'Pagination request parameters',
  'properties': {
    'cursor': { 'type': 'string' },
    'page': {
      'default': 1,
      'minimum': 1,
      'type': 'number'
    },
    'pageSize': {
      'default': DEFAULT_PAGE_SIZE,
      'maximum': MAX_PAGE_SIZE,
      'minimum': 1,
      'type': 'number'
    },
    'sortBy': { 'type': 'string' },
    'sortOrder': SortOrderDef
  },
  'required': [] as const,
  'type': 'object'
} as const;

const FilterDef = {
  'description': 'Generic filter specification',
  'properties': {
    'field': { 'type': 'string' },
    'operator': {
      'enum': [
        'eq',
        'neq',
        'gt',
        'gte',
        'lt',
        'lte',
        'in',
        'nin',
        'contains',
        'startsWith',
        'endsWith'
      ],
      'type': 'string'
    },
    'value': {}
  },
  'required': [
    'field',
    'operator'
  ],
  'type': 'object'
} as const;

const PageDef = {
  'description': 'A page of results with pagination metadata',
  'properties': {
    'hasNext': { 'type': 'boolean' },
    'hasPrev': { 'type': 'boolean' },
    'items': {
      'items': { 'type': 'object' },
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

export const BaseTypes = {
  'FilterSchema': {
    ...FilterDef,
    '$id': 'https://json-tology.dev/schemas/base-types/filter.schema.json'
  } as const,

  /**
   * Create a Page schema with a concrete item type.
   *
   * @example
   * const UserPageSchema = BaseTypes.page(
   *   UserSchema,
   *   'https://myapp.io/UserPage'
   * );
   * type UserPage = InferType<typeof UserPageSchema>;
   * // { items: User[]; total: number; page: number; pageSize: number; ... }
   */
  'page': <TItem extends JSONSchema7Definition, TId extends string>(
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

  /**
   * Create a Response schema with a concrete body type.
   *
   * @example
   * const UserResponseSchema = BaseTypes.response(
   *   UserSchema,
   *   'https://myapp.io/UserResponse'
   * );
   * type UserResponse = InferType<typeof UserResponseSchema>;
   */
  'response': <TBody extends JSONSchema7Definition, TId extends string>(
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

  /**
   * Create a Result schema with a concrete data type.
   *
   * @example
   * const UserResultSchema = BaseTypes.result(
   *   UserSchema,
   *   'https://myapp.io/UserResult'
   * );
   * type UserResult = InferType<typeof UserResultSchema>;
   */
  'result': <TData extends JSONSchema7Definition, TId extends string>(
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
