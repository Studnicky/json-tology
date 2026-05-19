// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.882Z
// Source:    examples/docs/ontologies/dcat-subset.jsonld
// IRI:       http://purl.org/dc/terms/Resource
// ============================================================

import type { InferType } from 'json-tology/types';

export const ResourceSchema = {
  "$id": "http://purl.org/dc/terms/Resource",
  "description": "Anything described by RDF (external Dublin Core class, kept as a stub).",
  "properties": {
    "description": {
      "type": "string",
    },
    "title": {
      "type": "string",
    },
  },
  "required": [],
  "title": "Resource",
  "type": "object",
} as const;

export type Resource = InferType<typeof ResourceSchema>;
