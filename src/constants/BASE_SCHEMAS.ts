import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
} from './PAGINATION.js';

/**
 * JSON Schema definition for a duration value with a numeric magnitude and time unit.
 *
 * @remarks
 * A reusable schema fragment representing a quantity of time. The `duration` property
 * carries the numeric value and `unit` constrains the time denomination.
 *
 * @example
 * ```ts
 * registry.register({ ...DurationDef, $id: 'https://example.com/Duration' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see TimestampedDef
 * @defaultValue `{...}`
 * @group Constants
 */
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

/**
 * JSON Schema definition for structured error detail information.
 *
 * @remarks
 * A reusable schema fragment for error payloads. The `message` field is required;
 * `code` carries a machine-readable error identifier and `details` holds
 * supplementary context.
 *
 * @example
 * ```ts
 * registry.register({ ...ErrorDetailsDef, $id: 'https://example.com/ErrorDetails' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see ResponseDef
 * @defaultValue `{...}`
 * @group Constants
 */
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

/**
 * JSON Schema definition for lifecycle progress state.
 *
 * @remarks
 * A reusable schema fragment representing how far along an operation has progressed.
 * `progress` is a required fraction in `[0, 1]`; `phase` and `timeRemaining` are optional.
 *
 * @example
 * ```ts
 * registry.register({ ...ProgressDef, $id: 'https://example.com/Progress' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see TimestampedDef
 * @defaultValue `{...}`
 * @group Constants
 */
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

/**
 * JSON Schema definition for a basic timestamp wrapper.
 *
 * @remarks
 * A reusable schema fragment for objects that carry a single Unix millisecond
 * `timestamp` field. Use `TimestampedDef` when both start and end times are needed.
 *
 * @example
 * ```ts
 * registry.register({ ...TimedDef, $id: 'https://example.com/Timed' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see TimestampedDef
 * @defaultValue `{...}`
 * @group Constants
 */
export const TimedDef = {
  'description': 'Basic timestamp wrapper',
  'properties': { 'timestamp': { 'type': 'number' } },
  'required': ['timestamp'],
  'type': 'object'
} as const;

/**
 * JSON Schema definition for an object with start time, end time, and duration.
 *
 * @remarks
 * A reusable schema fragment for timed operations. All three fields —
 * `startTime`, `endTime`, and `duration` — are required.
 *
 * @example
 * ```ts
 * registry.register({ ...TimestampedDef, $id: 'https://example.com/Timestamped' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see TimedDef
 * @defaultValue `{...}`
 * @group Constants
 */
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

/**
 * JSON Schema definition for a generic HTTP-style response container.
 *
 * @remarks
 * A reusable schema fragment for API response envelopes. `success` is the only
 * required field; `statusCode`, `message`, `body`, and `timestamp` are optional.
 *
 * @example
 * ```ts
 * registry.register({ ...ResponseDef, $id: 'https://example.com/Response' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see ResultDef
 * @defaultValue `{...}`
 * @group Constants
 */
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

/**
 * JSON Schema definition for a generic operation result container.
 *
 * @remarks
 * A reusable schema fragment for operation results. `success` is required;
 * `data`, `errors`, `errorCode`, and `timestamp` are optional supplementary fields.
 *
 * @example
 * ```ts
 * registry.register({ ...ResultDef, $id: 'https://example.com/Result' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see ResponseDef
 * @defaultValue `{...}`
 * @group Constants
 */
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

/**
 * JSON Schema definition for a state snapshot with items and metadata.
 *
 * @remarks
 * A reusable schema fragment for capturing point-in-time state. `items` is the
 * only required field; `count`, `metadata`, and `timestamp` are optional.
 *
 * @example
 * ```ts
 * registry.register({ ...StateSnapshotDef, $id: 'https://example.com/StateSnapshot' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see PageDef
 * @defaultValue `{...}`
 * @group Constants
 */
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

/**
 * JSON Schema definition for sort direction of ordered results.
 *
 * @remarks
 * An enum schema fragment with two valid values: `'asc'` and `'desc'`.
 * Used as an inline sub-schema for `sortOrder` in `PaginationDef`.
 *
 * @example
 * ```ts
 * registry.register({ ...SortOrderDef, $id: 'https://example.com/SortOrder' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see PaginationDef
 * @defaultValue `{...}`
 * @group Constants
 */
export const SortOrderDef = {
  'description': 'Sort direction for ordered results',
  'enum': [
    'asc',
    'desc'
  ],
  'type': 'string'
} as const;

/**
 * JSON Schema definition for an opaque pagination cursor string.
 *
 * @remarks
 * A reusable schema fragment for cursor-based pagination. The cursor value is
 * treated as opaque by consumers; its internal encoding is implementation-defined.
 *
 * @example
 * ```ts
 * registry.register({ ...CursorDef, $id: 'https://example.com/Cursor' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see PaginationDef
 * @defaultValue `{...}`
 * @group Constants
 */
export const CursorDef = {
  'description': 'Opaque pagination cursor',
  'type': 'string'
} as const;

/**
 * JSON Schema definition for pagination request parameters.
 *
 * @remarks
 * A reusable schema fragment for request objects that support offset and cursor
 * pagination. `DEFAULT_PAGE_SIZE` and `MAX_PAGE_SIZE` are sourced from PAGINATION
 * constants. All properties are optional; callers apply server-side defaults.
 *
 * @example
 * ```ts
 * registry.register({ ...PaginationDef, $id: 'https://example.com/Pagination' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see PageDef
 * @defaultValue `{...}`
 * @group Constants
 */
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

/**
 * JSON Schema definition for a generic filter specification.
 *
 * @remarks
 * A reusable schema fragment for query filter objects. `field` and `operator`
 * are required; `value` accepts any JSON value. The `operator` enum covers
 * equality, comparison, and substring matching operations.
 *
 * @example
 * ```ts
 * registry.register({ ...FilterDef, $id: 'https://example.com/Filter' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see PaginationDef
 * @defaultValue `{...}`
 * @group Constants
 */
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

/**
 * JSON Schema definition for a page of results with pagination metadata.
 *
 * @remarks
 * A reusable schema fragment for paginated response objects. `items`, `total`,
 * `page`, and `pageSize` are required. Optional cursor fields support
 * cursor-based navigation alongside offset-based navigation.
 *
 * @example
 * ```ts
 * registry.register({ ...PageDef, $id: 'https://example.com/Page' });
 * ```
 *
 * @category Base schemas
 * @since 0.1.0
 * @see PaginationDef
 * @defaultValue `{...}`
 * @group Constants
 */
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
