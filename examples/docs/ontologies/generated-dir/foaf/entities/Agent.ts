// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.881Z
// Source:    examples/docs/ontologies/foaf-subset.jsonld
// IRI:       http://xmlns.com/foaf/0.1/Agent
// ============================================================

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

export type Agent = InferType<typeof AgentSchema>;
