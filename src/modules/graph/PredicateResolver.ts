import type { JsonSchemaType } from '../../types/Schema.js';
import type { PredicateForType } from '../../types/PredicateFor.js';
import type { PredicateResolverFnType } from '../../types/PredicateResolverFn.js';
import { isRecord } from '../data/DataTypes.js';
import { GraphError } from '../../errors/GraphError.js';
import { SchemaIri } from './SchemaIri.js';

/**
 * Validate a predicate IRI for control characters or spaces.
 * Uses a codepoint scan instead of a regex to avoid RegExp injection risks.
 */
function assertPredicateIriSafe(iri: string): void {
  for (const char of iri) {
    const code = char.codePointAt(0);

    if (code === undefined) {
      continue;
    }

    if (code <= 0x20 || (code >= 0x7F && code <= 0x9F)) {
      throw new GraphError(
        'INVALID_PREDICATE_IRI',
        `Predicate IRI contains a control character or space (codepoint 0x${code.toString(16)}): ${JSON.stringify(iri)}`
      );
    }
  }
}

export const PredicateResolver = {
  /**
   * Returns a closure that captures `baseIRI`, `enableCanonicalPredicates`, and
   * `predicateFor`, so call-sites only need to pass `classId`, `propertyName`,
   * and `propertySchema`.
   */
  forConfig(config: {
    'baseIRI': string;
    'enableCanonicalPredicates': boolean | undefined;
    'predicateFor': PredicateForType | undefined;
  }): PredicateResolverFnType {
    return (ctx) => {
      return PredicateResolver.resolve({
        ...ctx,
        ...config
      });
    };
  },

  /**
   * Derives the RDF predicate IRI for a property. Precedence (first match wins):
   *
   * 1. Explicit per-property `x-jt-predicate` string annotation (non-empty).
   * 2. Property `$id` that is an absolute IRI (contains `://` after a non-empty scheme).
   * 3. Resolver: `predicateFor` callback — if it returns a string, that wins.
   * 4. Default — canonical flat: `baseIRI + propertyName` when `enableCanonicalPredicates !== false`.
   * 5. Class-scoped (DTO opt-out, `enableCanonicalPredicates: false`): `classId#propertyName`.
   *
   * All explicit predicates from steps 1 and 2 are validated for control
   * characters and spaces (throws `GraphError` with code `INVALID_PREDICATE_IRI`).
   */
  resolve(args: {
    'baseIRI': string;
    'classId': string;
    'enableCanonicalPredicates': boolean | undefined;
    'predicateFor': PredicateForType | undefined;
    'propertyName': string;
    'propertySchema': JsonSchemaType;
  }): string {
    const {
      baseIRI,
      classId,
      enableCanonicalPredicates,
      predicateFor,
      propertyName,
      propertySchema
    } = args;

    // 1. Explicit per-property binding via x-jt-predicate (must be non-empty string)
    if (isRecord(propertySchema)) {
      const explicitPredicate = propertySchema['x-jt-predicate'];

      if (typeof explicitPredicate === 'string' && explicitPredicate !== '') {
        assertPredicateIriSafe(explicitPredicate);

        return explicitPredicate;
      }

      // 2. Absolute $id on the property schema — scheme must precede `://`
      // (rejects leading `://garbage` where indexOf returns 0)
      const propertyId = propertySchema.$id;

      if (typeof propertyId === 'string' && propertyId.indexOf('://') > 0) {
        assertPredicateIriSafe(propertyId);

        return propertyId;
      }
    }

    // 3. predicateFor callback — wrap in try/catch and rethrow as GraphError
    if (predicateFor !== undefined) {
      let resolved: string | undefined;

      try {
        resolved = predicateFor({
          classId,
          propertyName
        });
      } catch (error) {
        throw new GraphError(
          'INVALID_PREDICATE_IRI',
          `predicateFor callback threw for property "${propertyName}" on class "${classId}"`,
          { 'cause': error instanceof Error ? error : new Error(String(error)) }
        );
      }

      if (typeof resolved === 'string') {
        return resolved;
      }
    }

    // 4. Default — canonical flat. `baseIRI` is normalized (trailing slashes
    // stripped) by JsonTology, so insert a `/` separator unless the caller
    // supplied a base that already ends in a delimiter — `/` or `#` for HTTP(S)
    // IRIs, `:` for URN namespaces (e.g. `urn:bookstore:` + `title`).
    if (enableCanonicalPredicates !== false) {
      const endsWithDelimiter = baseIRI.endsWith('/') || baseIRI.endsWith('#') || baseIRI.endsWith(':');
      const separator = endsWithDelimiter ? '' : '/';

      return `${baseIRI}${separator}${propertyName}`;
    }

    // 5. Class-scoped (DTO opt-out, enableCanonicalPredicates: false)
    return SchemaIri.propertyIri(classId, propertyName);
  }
} as const;
