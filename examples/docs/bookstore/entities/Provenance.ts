/**
 * Provenance — non-empty string describing the chain of custody for a rare book.
 *
 * At least 1 character is required to prevent empty provenance records.
 * Used for SignedFirstEdition.provenance.
 *
 * `x-jt-language: 'de'` tags the provenance text as German — the canonical
 * Neverending Story narrative is set in Munich (München) and the provenance
 * record for the Thienemann Verlag copy uses German prose. This allows
 * `toQuads` to emit the provenance literal with an `@de` language tag,
 * producing an `rdf:langString` rather than a plain `xsd:string`.
 *
 * Example: "Erworben aus dem Nachlass von Carl Conrad Coreander, München, 1994.
 *           Signiert 'M.E.' in blauer Tinte auf der Schmutztitelseite."
 */

export const ProvenanceSchema = {
  '$id': 'urn:bookstore:Provenance',
  'minLength': 1,
  'type': 'string',
  'x-jt-language': 'de'
} as const;
