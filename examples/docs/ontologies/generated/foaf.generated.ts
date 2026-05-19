// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T14:19:33.160Z
// Source:    examples/docs/ontologies/foaf-subset.jsonld
// ============================================================

import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';

export const AgentSchema = {
  "$id": "http://xmlns.com/foaf/0.1/Agent",
  "description": "An agent (e.g. a person, group, software or physical artifact).",
  "properties": {
    "mbox": {
      "type": "string",
    },
    "name": {
      "type": "string",
    },
  },
  "required": [],
  "title": "Agent",
  "type": "object",
} as const;

export const NameSchema = {
  "$id": "http://xmlns.com/foaf/0.1/name",
  "description": "A name for some thing.",
  "title": "name",
} as const;

export const MboxSchema = {
  "$id": "http://xmlns.com/foaf/0.1/mbox",
  "description": "A personal mailbox, ie. an Internet mailbox associated with exactly one owner.",
  "title": "personal mailbox",
} as const;

export const KnowsSchema = {
  "$id": "http://xmlns.com/foaf/0.1/knows",
  "description": "A person known by this person (indicating some level of reciprocated interaction between the parties).",
  "title": "knows",
} as const;

export const MemberSchema = {
  "$id": "http://xmlns.com/foaf/0.1/member",
  "description": "Indicates a member of a Group.",
  "title": "member",
} as const;

export const GroupSchema = {
  "$id": "http://xmlns.com/foaf/0.1/Group",
  "allOf": [
    {
      "$ref": "http://xmlns.com/foaf/0.1/Agent",
    },
  ],
  "description": "A class of Agents.",
  "disjointWith": "http://xmlns.com/foaf/0.1/Person",
  "properties": {
    "member": {
      "$ref": "http://xmlns.com/foaf/0.1/Agent",
    },
  },
  "required": [],
  "title": "Group",
  "type": "object",
} as const;

export const PersonSchema = {
  "$id": "http://xmlns.com/foaf/0.1/Person",
  "allOf": [
    {
      "$ref": "http://xmlns.com/foaf/0.1/Agent",
    },
  ],
  "description": "A person.",
  "disjointWith": "http://xmlns.com/foaf/0.1/Group",
  "properties": {
    "knows": {
      "$ref": "http://xmlns.com/foaf/0.1/Person",
    },
  },
  "required": [],
  "title": "Person",
  "type": "object",
} as const;

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

export type Agent = InferType<typeof AgentSchema>;
export type Name = InferType<typeof NameSchema>;
export type Mbox = InferType<typeof MboxSchema>;
export type Knows = InferType<typeof KnowsSchema>;
export type Member = InferType<typeof MemberSchema>;
export type Group = InferType<typeof GroupSchema>;
export type Person = InferType<typeof PersonSchema>;

// ============================================================
// END AUTO-GENERATED
// ============================================================
