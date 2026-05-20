// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.519Z
// Source:    examples/docs/ontologies/foaf-subset.jsonld
// ============================================================

import { JsonTology } from 'json-tology';

import { AgentSchema } from './entities/Agent.js';
import { NameSchema } from './entities/Name.js';
import { MboxSchema } from './entities/Mbox.js';
import { KnowsSchema } from './entities/Knows.js';
import { MemberSchema } from './entities/Member.js';
import { GroupSchema } from './entities/Group.js';
import { PersonSchema } from './entities/Person.js';

export const foafSchemas = [
  AgentSchema,
  NameSchema,
  MboxSchema,
  KnowsSchema,
  MemberSchema,
  GroupSchema,
  PersonSchema,
] as const;

export const foaf = JsonTology.create({
  "baseIRI": "http://xmlns.com/foaf/0.1",
  "schemas": foafSchemas,
} as const);

// Type re-exports — consumers import named types from this index
export type { Agent } from './entities/Agent.js';
export type { Name } from './entities/Name.js';
export type { Mbox } from './entities/Mbox.js';
export type { Knows } from './entities/Knows.js';
export type { Member } from './entities/Member.js';
export type { Group } from './entities/Group.js';
export type { Person } from './entities/Person.js';

// Schema constant re-exports
export { AgentSchema } from './entities/Agent.js';
export { NameSchema } from './entities/Name.js';
export { MboxSchema } from './entities/Mbox.js';
export { KnowsSchema } from './entities/Knows.js';
export { MemberSchema } from './entities/Member.js';
export { GroupSchema } from './entities/Group.js';
export { PersonSchema } from './entities/Person.js';

// ============================================================
// END AUTO-GENERATED
// ============================================================
