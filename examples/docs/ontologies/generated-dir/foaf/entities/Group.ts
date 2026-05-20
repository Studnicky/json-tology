// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-20T04:39:50.519Z
// Source:    examples/docs/ontologies/foaf-subset.jsonld
// IRI:       http://xmlns.com/foaf/0.1/Group
// ============================================================

import type { InferType } from 'json-tology/types';

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

export type Group = InferType<typeof GroupSchema>;
