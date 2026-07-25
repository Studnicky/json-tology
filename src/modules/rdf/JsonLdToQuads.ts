/**
 * JsonLdToQuads — synchronous compact JSON-LD to QuadInterface[] converter.
 *
 * Handles the specific compact JSON-LD format that OwlProjection + OntologyBuilder
 * emit: a document with a prefix map (`context`) and a flat node array (`graph`).
 * Each node has an `id`, a `type` (plain string or string[]), and predicate-value
 * entries where predicates are CURIE strings and values are IRI references,
 * list structures, or literals.
 *
 * This is NOT a general-purpose JSON-LD processor. It is designed specifically
 * to invert the output of JsonLdFormatter.fromQuads (which is what toTbox() produces).
 * For arbitrary JSON-LD documents use importAsync() with the optional jsonld peer.
 */

import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { TokenParseResultType } from '../../types/TokenParseResultType.js';
import type { NQuadLineResultType } from '../../types/NQuadLineResultType.js';
import type { ParsedLiteralType } from '../../types/ParsedLiteralType.js';
import type { ConversionContextType } from '../../types/ConversionContextType.js';
import {
  RDF, XSD
} from '../../constants/IRI.js';
import {
  NQUAD_DATATYPE_PREFIX_LENGTH, NQUAD_MINIMUM_TOKENS
} from '../../constants/NUMERIC.js';
import { Lists } from '../quads/Lists.js';
import { Terms } from '../quads/Terms.js';
import { IdentifierIssuer } from '../quads/IdentifierIssuer.js';
import { Curie } from '../quads/Curie.js';

/**
 * JsonLdToQuads — converts compact JSON-LD (and jsonld.js N-Quads output) to quads.
 */
export class JsonLdToQuads {
  private static advancePastLiteralQuotes(line: string, startPos: number): number {
    let end = startPos + 1;

    while (end < line.length) {
      if (line[end] === '\\') {
        end += 2;
        continue;
      }
      if (line[end] === '"') {
        end++;
        break;
      }
      end++;
    }

    return end;
  }

  private static advancePastLiteralSuffix(line: string, endPos: number): number {
    if (endPos < line.length && line[endPos] === '^') {
      const afterCaret = endPos + 2;
      const dtEnd = line.indexOf('>', afterCaret);

      return dtEnd === -1 ? line.length : dtEnd + 1;
    }
    if (endPos < line.length && line[endPos] === '@') {
      const langEnd = line.indexOf(' ', endPos);

      return langEnd === -1 ? line.length : langEnd;
    }

    return endPos;
  }

  private static consumeBnodeToken(line: string, pos: number, tokens: string[]): number {
    const [
      token,
      nextPos
    ] = JsonLdToQuads.tokenizeBnodeAt(line, pos);

    tokens.push(token);

    return nextPos;
  }

  private static consumeIriToken(line: string, pos: number, tokens: string[]): number {
    const [
      token,
      nextPos
    ] = JsonLdToQuads.tokenizeIriAt(line, pos);

    if (token === '') {
      // No closing bracket — malformed, stop tokenizing this line.
      return line.length;
    }
    tokens.push(token);

    return nextPos;
  }

  private static consumeLiteralToken(line: string, pos: number, tokens: string[]): number {
    const [
      token,
      nextPos
    ] = JsonLdToQuads.tokenizeLiteralAt(line, pos);

    tokens.push(token);

    return nextPos;
  }

  private static convertIdObject(
    object: Record<string, unknown>,
    iriValue: string,
    conversionContext: ConversionContextType
  ): QuadObjectType {
    if (iriValue.startsWith('_:')) {
      return Terms.blank(iriValue.slice(2));
    }

    // Inlined blank node (has keys beyond @id)
    if (Object.keys(object).length > 1) {
      const bnodeId = JsonLdToQuads.convertInlinedBnode(object, conversionContext);

      return Terms.blank(bnodeId.slice(2));
    }

    return Terms.iri(Curie.expandWithContext(iriValue, conversionContext.context));
  }

  private static convertInlinedBnode(
    object: Record<string, unknown>,
    conversionContext: ConversionContextType
  ): string {
    const existingId = conversionContext.bnodeMap.get(object);
    const bnodeId = existingId ?? conversionContext.counter.getId();

    if (existingId === undefined) {
      conversionContext.bnodeMap.set(object, bnodeId);
      JsonLdToQuads.emitNodeQuads(bnodeId, object, conversionContext);
    }

    return bnodeId;
  }

  /**
   * Convert a JSON-LD object value (`@list` / `@id` / `@value` / inlined bnode) to a quad object term.
   */
  private static convertObjectValue(
    object: Record<string, unknown>,
    originalValue: unknown,
    conversionContext: ConversionContextType
  ): null | QuadObjectType {
    if ('@list' in object && Array.isArray(object['@list'])) {
      return JsonLdToQuads.convertRdfList(object['@list'] as unknown[], conversionContext);
    }

    if ('@id' in object && typeof object['@id'] === 'string') {
      return JsonLdToQuads.convertIdObject(object, object['@id'], conversionContext);
    }

    if ('@value' in object) {
      return Terms.literal(object['@value']);
    }

    if (Object.keys(object).length > 0) {
      return Terms.blank(JsonLdToQuads.convertInlinedBnode(object, conversionContext).slice(2));
    }

    return Terms.literal(originalValue);
  }

  private static convertRdfList(
    rawList: unknown[],
    conversionContext: ConversionContextType
  ): QuadObjectType {
    const items: QuadObjectType[] = [];

    for (const rawItem of rawList) {
      const term = JsonLdToQuads.jsonLdValueToTerm(rawItem, conversionContext);

      if (term !== null) {
        items.push(term);
      }
    }

    const {
      head, triples
    } = Lists.build(items, conversionContext.counter);

    for (const triple of triples) {
      conversionContext.allQuads.push(triple);
    }

    return head;
  }

  private static convertStringValue(value: string, conversionContext: ConversionContextType): QuadObjectType {
    if (JsonLdToQuads.isLiteralString(value, conversionContext.context)) {
      return Terms.literal(value);
    }

    return Terms.iri(Curie.expandWithContext(value, conversionContext.context));
  }

  private static emitNodeQuads(
    subjectId: string,
    node: Record<string, unknown>,
    conversionContext: ConversionContextType
  ): void {
    const subjectTerm = subjectId.startsWith('_:')
      ? Terms.blank(subjectId.slice(2))
      : Terms.iri(subjectId);

    for (const [
      key,
      rawValue
    ] of Object.entries(node)) {
      if (key === '@id') {
        continue;
      }
      if (key === '@type') {
        const types = Array.isArray(rawValue) ? rawValue : [rawValue];

        JsonLdToQuads.emitTypeQuads(subjectTerm, types, conversionContext);
        continue;
      }

      const predicateIri = Curie.expandWithContext(key, conversionContext.context);
      const predicateTerm = Terms.iri(predicateIri);
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];

      for (const itemValue of values) {
        const objectTerm = JsonLdToQuads.jsonLdValueToTerm(itemValue, conversionContext);

        if (objectTerm === null) {
          continue;
        }
        conversionContext.allQuads.push(Terms.quad(
          subjectTerm,
          predicateTerm,
          objectTerm,
          Terms.defaultGraph()
        ));
      }
    }
  }

  private static emitTypeQuads(
    subjectTerm: ReturnType<typeof Terms.blank> | ReturnType<typeof Terms.iri>,
    types: unknown[],
    conversionContext: ConversionContextType
  ): void {
    for (const typeValue of types) {
      if (typeof typeValue !== 'string') {
        continue;
      }
      conversionContext.allQuads.push(Terms.quad(
        subjectTerm,
        Terms.iri(RDF.type),
        Terms.iri(Curie.expandWithContext(typeValue, conversionContext.context)),
        Terms.defaultGraph()
      ));
    }
  }

  /**
   * Convert a compact JSON-LD node array to a flat array of RDF quads.
   *
   * @remarks
   * Accepts the format that OntologyBuilder + JsonLdFormatter produce: a prefix
   * map (`context`) and a flat node array (`graph`). Each node must carry an
   * `id` (subject IRI or blank node ID), an optional `type` (class IRI string
   * or string[]), and predicate keys that are CURIE strings mapping to IRI
   * references, list structures, or literal values.
   *
   * @example
   * ```ts
   * const quads = JsonLdToQuads.fromNodes(doc.graph, doc.prefixMap);
   * ```
   *
   * @param nodes - Array of JSON-LD node objects from the graph array.
   * @param prefixMap - Prefix expansion map from the document (e.g. `{ owl: 'http://www.w3.org/2002/07/owl#' }`).
   * @returns Flat array of QuadInterface objects.
   *
   * @category RDF
   * @since 0.18.0
   * @see {@link JsonLdToQuads.fromNQuads}
   * @group JsonLdToQuads
   */
  public static fromNodes(
    nodes: Array<Record<string, unknown>>,
    prefixMap: Record<string, string>
  ): QuadInterface[] {
    const conversionContext = JsonLdToQuads.makeConversionContext(prefixMap);

    for (const node of nodes) {
      const subjectRaw = node['@id'];

      if (typeof subjectRaw !== 'string') {
        continue;
      }
      const subjectId = Curie.expandWithContext(subjectRaw, conversionContext.context);

      JsonLdToQuads.emitNodeQuads(subjectId, node, conversionContext);
    }

    return conversionContext.allQuads;
  }

  /**
   * Parse N-Quads produced by jsonld.js v8.
   *
   * @remarks
   * Handles lines of the form: `<subject> <predicate> <object> [<graph>] .`
   * Comment lines (starting with `#`) and blank lines are ignored.
   * Blank node subjects are recognized by the `_:` prefix. Literal objects
   * with optional `^^<datatype>` or `@lang` suffixes are fully supported.
   *
   * @example
   * ```ts
   * const quads = JsonLdToQuads.fromNQuads(nquadsString);
   * ```
   *
   * @param nquads - N-Quads document as a plain string.
   * @returns Flat array of QuadInterface objects.
   *
   * @category RDF
   * @since 0.18.0
   * @see {@link JsonLdToQuads.fromNodes}
   * @group JsonLdToQuads
   */
  public static fromNQuads(nquads: string): QuadInterface[] {
    const quads: QuadInterface[] = [];
    const lines = nquads.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }
      const body = trimmed.endsWith(' .') ? trimmed.slice(0, -2).trimEnd() : trimmed;
      const quad = JsonLdToQuads.parseNQuadLine(body);

      if (quad !== undefined) {
        quads.push(quad);
      }
    }

    return quads;
  }

  /**
   * Return true when a plain JSON string value should be treated as a literal
   * rather than an IRI reference. A string is a literal when it cannot be a
   * valid IRI or CURIE: no colon, not starting with `_:` / `http:` / `https:`
   * / `urn:`. Covers JSON Schema format values (`email`, `date-time`, `uri`,
   * `uuid`, `int32`) and other plain-string annotations produced by
   * JsonLdFormatter.
   */
  private static isLiteralString(value: string, context: Record<string, string>): boolean {
    if (
      value.startsWith('_:')
      || value.startsWith('http://')
      || value.startsWith('https://')
      || value.startsWith('urn:')
    ) {
      return false;
    }

    const colonIndex = value.indexOf(':');

    if (colonIndex === -1) {
      return true;
    }

    const prefix = value.slice(0, colonIndex);

    return !(prefix in context);
  }

  private static jsonLdValueToTerm(
    value: unknown,
    conversionContext: ConversionContextType
  ): null | QuadObjectType {
    if (typeof value === 'string') {
      return JsonLdToQuads.convertStringValue(value, conversionContext);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return Terms.literal(value);
    }

    if (typeof value !== 'object' || value === null) {
      return null;
    }

    return JsonLdToQuads.convertObjectValue(value as Record<string, unknown>, value, conversionContext);
  }

  /** Groups per-call mutable state to avoid passing 4-5 arguments through every recursive call. */
  private static makeConversionContext(context: Record<string, string>): ConversionContextType {
    return {
      'allQuads': [],
      'bnodeMap': new Map(),
      'context': context,
      'counter': new IdentifierIssuer({ 'prefix': '_:jld' })
    };
  }

  private static parseLiteralToken(token: string): ParsedLiteralType {
    const closingQuote = token.lastIndexOf('"');

    if (closingQuote <= 0) {
      return {
        'datatype': XSD.string,
        'language': '',
        'value': token.slice(1, -1)
      };
    }
    const value = token.slice(1, closingQuote)
      .replaceAll('\\"', '"')
      .replaceAll('\\n', '\n')
      .replaceAll('\\t', '\t');
    const suffix = token.slice(closingQuote + 1);

    if (suffix.startsWith('^^<')) {
      return {
        'datatype': suffix.slice(NQUAD_DATATYPE_PREFIX_LENGTH, -1),
        'language': '',
        value
      };
    }
    if (suffix.startsWith('@')) {
      return {
        'datatype': RDF.langString,
        'language': suffix.slice(1),
        value
      };
    }

    return {
      'datatype': XSD.string,
      'language': '',
      value
    };
  }

  private static parseNQuadLine(body: string): NQuadLineResultType {
    const tokens = JsonLdToQuads.tokenizeNQuadLine(body);

    if (tokens.length < NQUAD_MINIMUM_TOKENS) {
      return undefined;
    }

    const subjectToken = tokens.at(0);
    const predicateToken = tokens.at(1);
    const objectToken = tokens.at(2);

    if (subjectToken === undefined || predicateToken === undefined || objectToken === undefined) {
      return undefined;
    }

    const subjectTerm = subjectToken.startsWith('_:')
      ? Terms.blank(subjectToken.slice(2))
      : Terms.iri(subjectToken.slice(1, -1));
    const predicateTerm = Terms.iri(predicateToken.slice(1, -1));
    const objectTerm = JsonLdToQuads.parseNQuadObjectTerm(objectToken);

    return Terms.quad(subjectTerm, predicateTerm, objectTerm, Terms.defaultGraph());
  }

  private static parseNQuadObjectTerm(objectToken: string): QuadObjectType {
    if (objectToken.startsWith('"')) {
      const {
        datatype, language, value
      } = JsonLdToQuads.parseLiteralToken(objectToken);

      return Terms.literal(value, {
        'datatype': Terms.iri(datatype),
        'language': language
      });
    }

    if (objectToken.startsWith('_:')) {
      return Terms.blank(objectToken.slice(2));
    }

    return Terms.iri(objectToken.slice(1, -1));
  }

  private static tokenizeBnodeAt(line: string, pos: number): TokenParseResultType {
    const end = line.indexOf(' ', pos);
    const token = end === -1 ? line.slice(pos) : line.slice(pos, end);

    return [
      token,
      end === -1 ? line.length : end
    ];
  }

  private static tokenizeIriAt(line: string, pos: number): TokenParseResultType {
    const end = line.indexOf('>', pos);

    if (end === -1) {
      return [
        '',
        line.length
      ];
    }

    return [
      line.slice(pos, end + 1),
      end + 1
    ];
  }

  private static tokenizeLiteralAt(line: string, pos: number): TokenParseResultType {
    const afterQuotes = JsonLdToQuads.advancePastLiteralQuotes(line, pos);
    const end = JsonLdToQuads.advancePastLiteralSuffix(line, afterQuotes);

    return [
      line.slice(pos, end),
      end
    ];
  }

  private static tokenizeNQuadLine(line: string): string[] {
    const tokens: string[] = [];
    let pos = 0;

    while (pos < line.length) {
      // Skip whitespace
      while (pos < line.length && line[pos] === ' ') {
        pos++;
      }
      if (pos >= line.length) {
        break;
      }
      const ch = line[pos];

      switch (ch) {
        case '"':
          pos = JsonLdToQuads.consumeLiteralToken(line, pos, tokens);
          break;
        case '<':
          pos = JsonLdToQuads.consumeIriToken(line, pos, tokens);
          break;
        case '_':
          pos = JsonLdToQuads.consumeBnodeToken(line, pos, tokens);
          break;
        case undefined:
          break;
        default:
          // Unknown token character — skip
          pos++;
      }
    }

    return tokens;
  }
}
