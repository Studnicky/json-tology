// ============================================================
// AUTO-GENERATED — DO NOT EDIT
// Generated: 2026-05-19T16:53:58.882Z
// Source:    examples/docs/ontologies/dcat-subset.jsonld
// IRI:       http://www.w3.org/ns/dcat#accessURL
// ============================================================

import type { InferType } from 'json-tology/types';

export const AccessURLSchema = {
  "$id": "http://www.w3.org/ns/dcat#accessURL",
  "description": "A URL of the resource that gives access to a distribution. Range is xsd:string in this subset (xsd:anyURI would produce a { format: uri } inline constraint that requires enableStrictGraph: false).",
  "title": "access URL",
} as const;

export type AccessURL = InferType<typeof AccessURLSchema>;
