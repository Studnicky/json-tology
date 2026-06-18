/**
 * Access-control domain fixture.
 *
 * Shared across e2e examples: types, validation, reasoning.
 * Schemas use `as const` so InferType works at compile time.
 */

import { Transform } from '../../src/index.js';
import { brand } from '../../src/modules/data/Brand.js';
import type { InferSchemaType } from '../../src/types/Infer.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ResourceSchema = {
  '$id': 'https://acl.io/Resource',
  'properties': {
    'id': {
      'minLength': 1,
      'type': 'string'
    },
    'kind': {
      'enum': [
        'document',
        'service',
        'database'
      ],
      'type': 'string'
    },
    'name': { 'type': 'string' }
  },
  'required': [
    'id',
    'name',
    'kind'
  ],
  'type': 'object'
} as const;

export const PermissionSchema = {
  '$id': 'https://acl.io/Permission',
  'properties': {
    'action': {
      'enum': [
        'read',
        'write',
        'delete',
        'admin'
      ],
      'type': 'string'
    },
    'id': {
      'minLength': 1,
      'type': 'string'
    },
    'resource': { 'type': 'string' }
  },
  'required': [
    'id',
    'action',
    'resource'
  ],
  'type': 'object'
} as const;

export const RoleSchema = {
  '$id': 'https://acl.io/Role',
  'properties': {
    'id': {
      'minLength': 1,
      'type': 'string'
    },
    'name': { 'type': 'string' },
    'permissions': {
      'items': { 'type': 'string' },
      'type': 'array'
    }
  },
  'required': [
    'id',
    'name',
    'permissions'
  ],
  'type': 'object'
} as const;

export const UserSchema = {
  '$id': 'https://acl.io/User',
  'properties': {
    'active': {
      'default': true,
      'type': 'boolean'
    },
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'id': {
      'minLength': 1,
      'type': 'string'
    },
    'name': { 'type': 'string' },
    'roles': {
      'items': { 'type': 'string' },
      'type': 'array'
    },
    'tags': {
      'default': [],
      'items': { 'type': 'string' },
      'type': 'array'
    }
  },
  'required': [
    'id',
    'name',
    'email',
    'roles'
  ],
  'type': 'object'
} as const;

const DateTimeRawSchema = {
  '$id': 'https://acl.io/DateTime',
  'format': 'date-time',
  'type': 'string'
} as const;

// Normalize transform: the raw wire date-time string is normalized into the
// schema's canonical (branded, format-validated) form. The schema describes
// decode's OUTPUT, so format validation runs on the decoded result.
export const DateTimeSchema = Transform.create(DateTimeRawSchema, {
  'decode': (raw: string) => {
    return brand<InferSchemaType<typeof DateTimeRawSchema>>(raw);
  },
  'encode': (value) => {
    return value;
  }
});

export const UserIdSchema = Transform.brand(
  {
    '$id': 'https://acl.io/UserId',
    'minLength': 1,
    'type': 'string'
  } as const,
  'UserId'
);

export const RoleIdSchema = Transform.brand(
  {
    '$id': 'https://acl.io/RoleId',
    'minLength': 1,
    'type': 'string'
  } as const,
  'RoleId'
);

export const allSchemas = [
  ResourceSchema,
  PermissionSchema,
  RoleSchema,
  UserSchema,
  DateTimeSchema,
  UserIdSchema,
  RoleIdSchema
] as const;

// ---------------------------------------------------------------------------
// Instance data
// ---------------------------------------------------------------------------

export const aclResources = [
  {
    'id': 'res-docs',
    'kind': 'document' as const,
    'name': 'Engineering Docs'
  },
  {
    'id': 'res-billing',
    'kind': 'service' as const,
    'name': 'Billing Service'
  },
  {
    'id': 'res-db',
    'kind': 'database' as const,
    'name': 'Production DB'
  }
];

export const aclPermissions = [
  {
    'action': 'read' as const,
    'id': 'perm-read-docs',
    'resource': 'res-docs'
  },
  {
    'action': 'write' as const,
    'id': 'perm-write-docs',
    'resource': 'res-docs'
  },
  {
    'action': 'read' as const,
    'id': 'perm-read-billing',
    'resource': 'res-billing'
  },
  {
    'action': 'admin' as const,
    'id': 'perm-admin-db',
    'resource': 'res-db'
  },
  {
    'action': 'read' as const,
    'id': 'perm-read-db',
    'resource': 'res-db'
  }
];

export const aclRoles = [
  {
    'id': 'role-viewer',
    'name': 'Viewer',
    'permissions': [
      'perm-read-docs',
      'perm-read-db'
    ]
  },
  {
    'id': 'role-editor',
    'name': 'Editor',
    'permissions': [
      'perm-read-docs',
      'perm-write-docs',
      'perm-read-billing'
    ]
  },
  {
    'id': 'role-dba',
    'name': 'DBA',
    'permissions': [
      'perm-read-db',
      'perm-admin-db'
    ]
  }
];

export const aclUsers = [
  {
    'email': 'alice@acl.io',
    'id': 'user-alice',
    'name': 'Alice',
    'roles': ['role-editor']
  },
  {
    'email': 'bob@acl.io',
    'id': 'user-bob',
    'name': 'Bob',
    'roles': ['role-viewer']
  },
  {
    'email': 'carol@acl.io',
    'id': 'user-carol',
    'name': 'Carol',
    'roles': [
      'role-editor',
      'role-dba'
    ]
  }
];
