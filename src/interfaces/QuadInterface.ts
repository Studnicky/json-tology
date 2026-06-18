/**
 * `QuadInterface` is the canonical rdf/js spec quad — re-exported from
 * `@rdfjs/types#Quad` as the project's public quad surface.
 *
 * Quads produced by `toQuads`, `toTbox`, and `toShacl` are directly compatible
 * with the broader Node.js RDF ecosystem (n3, rdf-ext, jsonld, @graphy,
 * rdf-store-stream) — no cast required.
 *
 * Literal values are typed as `string` per the rdf/js spec, with the JS type
 * tag carried in `.datatype.value` (e.g. `xsd:integer`, `xsd:boolean`,
 * `xsd:dateTime`). To decode back to a typed JS value, use `Terms.decodeLiteral`
 * from `src/modules/quads/Terms.ts` — `fromQuads` does this automatically.
 *
 * @see {@link https://rdf.js.org/data-model-spec/#quad-interface rdf/js Quad spec}
 */
export type { Quad as QuadInterface } from '@rdfjs/types';
