/**
 * All string/number/vocabulary scalar semantics fields extracted from the
 * raw schema object.
 *
 * @remarks
 * Consolidates all `typeof x === 'string'/'number'` extractions into one
 * named shape to keep `Semantics.build` within complexity limits. Internal
 * to `SchemaFieldExtractor.scalarFields` in
 * `src/modules/graph/SchemaGraphSupport.ts`.
 *
 * @category Graph
 * @since 0.18.0
 * @group Graph
 */
export interface ScalarFieldsInterface {
  'comment': string | undefined;
  'contentEncoding': string | undefined;
  'contentMediaType': string | undefined;
  'description': string | undefined;
  'disjointWith': string | undefined;
  'dynamicRef': string | undefined;
  'equivalentTo': string | undefined;
  'exclusiveMaximum': number | undefined;
  'exclusiveMinimum': number | undefined;
  'format': string | undefined;
  'inverseOf': string | undefined;
  'maxContains': number | undefined;
  'maximum': number | undefined;
  'maxItems': number | undefined;
  'maxLength': number | undefined;
  'maxProperties': number | undefined;
  'minContains': number | undefined;
  'minimum': number | undefined;
  'minItems': number | undefined;
  'minLength': number | undefined;
  'minProperties': number | undefined;
  'multipleOf': number | undefined;
  'pattern': string | undefined;
  'recursiveRef': string | undefined;
  'schemaAnchor': string | undefined;
  'schemaDialect': string | undefined;
  'schemaId': string | undefined;
  'schemaVocabulary': unknown;
  'title': string | undefined;
}
