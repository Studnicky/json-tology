import type {
  BnodeTermType, DefaultGraphTermType, IriTermType, QuadObjectType
} from '../types/Quad.js';

/**
 * The project's canonical quad shape.
 *
 * `QuadInterface` is structurally aligned with `@rdfjs/types#Quad`
 * (https://rdf.js.org/data-model-spec/#quad-interface) in the subject,
 * predicate, and graph positions:
 * - `IriTermType` is structurally identical to `@rdfjs/types#NamedNode`.
 * - `BnodeTermType` is structurally identical to `@rdfjs/types#BlankNode`.
 * - `DefaultGraphTermType` is structurally identical to `@rdfjs/types#DefaultGraph`.
 *
 * The `object` position carries two project-specific extensions:
 * - `LiteralTermType.value` is `unknown` (project widening for raw JS values
 *   stored without pre-serialisation; coerce with `String(literal.value)`).
 * - `ListTermType` is a project extension for RDF list shorthand with no rdf/js equivalent.
 *
 * `@rdfjs/types` is in `dependencies` so consumers can import `Quad`, `NamedNode`,
 * etc. from that package and use them alongside this one without extra installation.
 *
 * Quads produced by `toQuads`, `toTbox`, and `toShacl` are directly compatible
 * with the broader Node.js RDF ecosystem (n3, rdf-ext, jsonld, @graphy,
 * rdf-store-stream). Consumers piping into `n3.Writer.addQuads()` can cast:
 * ```ts
 * import type { Quad } from '@rdfjs/types';
 * writer.addQuads(jt.toQuads(schema, data) as unknown as Quad[]);
 * ```
 *
 * - subject   IriTermType | BnodeTermType   (NamedNode | BlankNode)
 * - predicate IriTermType                   (NamedNode)
 * - object    QuadObjectType                (NamedNode | BlankNode | Literal† | List‡)
 * - graph     IriTermType | BnodeTermType | DefaultGraphTermType (always present)
 *
 * † LiteralTermType widens `value` to `unknown` vs `@rdfjs/types#Literal.value: string`.
 * ‡ ListTermType is a project extension; not part of the rdf/js spec.
 */
export interface QuadInterface {
  /** Graph: NamedNode, BlankNode, or DefaultGraph. */
  'graph': BnodeTermType | DefaultGraphTermType | IriTermType;
  /**
   * Object term. In the common ABox case: NamedNode, BlankNode, or LiteralTermType.
   * For OWL/SHACL list-valued predicates: ListTermType.
   */
  'object': QuadObjectType;
  /** Predicate: NamedNode (IriTermType). */
  'predicate': IriTermType;
  /** Subject: NamedNode (IriTermType) or BlankNode (BnodeTermType). */
  'subject': BnodeTermType | IriTermType;
}
