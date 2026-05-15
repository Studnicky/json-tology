import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from './PAGINATION.js';

export const DurationDef = {
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

export const ErrorDetailsDef = {
  'description': 'Core error information',
  'properties': {
    'code': { 'type': 'string' },
    'details': { 'type': 'object' },
    'message': { 'type': 'string' }
  },
  'required': ['message'],
  'type': 'object'
} as const;

export const ProgressDef = {
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

export const TimedDef = {
  'description': 'Basic timestamp wrapper',
  'properties': { 'timestamp': { 'type': 'number' } },
  'required': ['timestamp'],
  'type': 'object'
} as const;

export const TimestampedDef = {
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

export const ResponseDef = {
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

export const ResultDef = {
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

export const StateSnapshotDef = {
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

export const SortOrderDef = {
  'description': 'Sort direction for ordered results',
  'enum': [
    'asc',
    'desc'
  ],
  'type': 'string'
} as const;

export const CursorDef = {
  'description': 'Opaque pagination cursor',
  'type': 'string'
} as const;

export const PaginationDef = {
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

export const FilterDef = {
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

export const PageDef = {
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
