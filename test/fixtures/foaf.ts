/**
 * FOAF (Friend of a Friend) test schemas and fixtures.
 */

export const MboxSchema = {
  '$id': 'http://xmlns.com/foaf/0.1/Mbox',
  'format': 'email',
  'type': 'string'
} as const;

export const DateTimeSchema = {
  '$id': 'http://xmlns.com/foaf/0.1/DateTime',
  'format': 'date-time',
  'type': 'string'
} as const;

export const PersonSchema = {
  '$id': 'http://xmlns.com/foaf/0.1/Person',
  'properties': {
    'familyName': { 'type': 'string' },
    'givenName': { 'type': 'string' },
    'knows': {
      'items': { '$ref': 'http://xmlns.com/foaf/0.1/Person' },
      'type': 'array'
    },
    'mbox': { 'type': 'string' }
  },
  'required': ['givenName'],
  'type': 'object'
} as const;

export const OrganizationSchema = {
  '$id': 'http://xmlns.com/foaf/0.1/Organization',
  'properties': {
    'member': {
      'items': { '$ref': 'http://xmlns.com/foaf/0.1/Person' },
      'type': 'array'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

export const foafPersons: Array<Record<string, unknown>> = [
  {
    'familyName': 'Smith',
    'givenName': 'Alice',
    'knows': [],
    'mbox': 'alice@example.com'
  },
  {
    'familyName': 'Jones',
    'givenName': 'Bob',
    'knows': [],
    'mbox': 'bob@example.com'
  }
];

export const foafOrganizations: Array<Record<string, unknown>> = [{
  'member': [],
  'name': 'Acme Corp'
}];

export const allSchemas = [
  PersonSchema,
  OrganizationSchema
];
