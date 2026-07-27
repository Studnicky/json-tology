import type { JsonSchemaType } from '../../types/Schema.js';
import type { PredicateForInterface } from '../../interfaces/PredicateForInterface.js';
import type { PredicateResolverInterface } from '../../interfaces/PredicateResolverInterface.js';
import { DataType } from '../data/DataType.js';
import { BaseError } from '../../errors/BaseError.js';
import { GraphError } from '../../errors/GraphError.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import { SchemaIri } from './SchemaIri.js';
import {
  C1_CONTROL_MAXIMUM, CONTROL_CHAR_MAXIMUM, DEL_CODEPOINT, HEX_RADIX
} from '../../constants/NUMERIC.js';

/**
 * PredicateIriAssertions — control-character and fragment-count validation
 * shared by every explicit-IRI resolution step.
 */
class PredicateIriAssertions {
  /**
   * Validate a predicate IRI for control characters or spaces.
   * Uses a codepoint scan instead of a regex to avoid RegExp injection risks.
   */
  static assertSafe(iri: string): void {
    for (const char of iri) {
      const code = char.codePointAt(0);

      if (code === undefined) {
        continue;
      }

      if (code <= CONTROL_CHAR_MAXIMUM || (code >= DEL_CODEPOINT && code <= C1_CONTROL_MAXIMUM)) {
        throw new GraphError(
          `Predicate IRI contains a control character or space (codepoint 0x${code.toString(HEX_RADIX)}): ${JSON.stringify(iri)}`,
          { 'code': GRAPH_ERROR_CODE.INVALID_PREDICATE_IRI }
        );
      }
    }
  }

  /**
   * Validate that a predicate IRI contains at most one '#' fragment delimiter.
   * Per RFC 3987, a URI may carry at most one fragment component; a second '#'
   * produces an invalid IRI that strict triplestores reject.
   */
  static assertSingleFragment(iri: string): void {
    // A second '#' exists iff the first and last '#' differ in position. This
    // holds for 0 or 1 '#' (positions equal, including both -1) and fails only
    // when two or more are present.
    if (iri.indexOf('#') !== iri.lastIndexOf('#')) {
      throw new GraphError(
        `Predicate IRI has more than one '#' fragment (invalid per RFC 3987): ${JSON.stringify(iri)}`,
        { 'code': GRAPH_ERROR_CODE.INVALID_PREDICATE_IRI }
      );
    }
  }
}

/**
 * PredicateResolutionStep — the individual resolution steps of the predicate
 * IRI derivation precedence, grouped as a single domain object since they are
 * cohesive sub-steps of the same algorithm (see `PredicateResolver.resolve`).
 */
class PredicateResolutionStep {
  /**
   * Step 4: build the canonical flat predicate IRI from `baseIri` and
   * `propertyName`, inserting a `/` separator unless the base already ends with
   * a delimiter (`/`, `#`, or `:` for URN namespaces).
   */
  static canonicalFlat(baseIri: string, propertyName: string): string {
    const endsWithDelimiter = baseIri.endsWith('/') || baseIri.endsWith('#') || baseIri.endsWith(':');
    const separator = endsWithDelimiter ? '' : '/';

    return `${baseIri}${separator}${propertyName}`;
  }

  /**
   * Steps 1 + 2: resolve an explicit `x-jt-predicate` annotation or absolute
   * `$id` from the property schema. Returns the validated IRI or `undefined`.
   */
  static schemaAnnotation(propertySchema: JsonSchemaType): string | undefined {
    if (!DataType.isRecord(propertySchema)) {
      return undefined;
    }

    // 1. Explicit per-property binding via x-jt-predicate (must be non-empty string)
    const explicitPredicate = propertySchema['x-jt-predicate'];

    if (typeof explicitPredicate === 'string' && explicitPredicate !== '') {
      PredicateIriAssertions.assertSafe(explicitPredicate);

      return explicitPredicate;
    }

    // 2. Absolute $id on the property schema — scheme must precede `://`
    // (rejects leading `://garbage` where indexOf returns 0)
    const propertyId = propertySchema.$id;

    if (typeof propertyId === 'string' && propertyId.indexOf('://') > 0) {
      PredicateIriAssertions.assertSafe(propertyId);

      return propertyId;
    }

    return undefined;
  }

  /**
   * Step 3: invoke the `predicateFor` callback and return the result, or
   * `undefined` if the callback is absent or returns a non-string value.
   * Wraps callback errors as `GraphError` with code `INVALID_PREDICATE_IRI`.
   */
  static viaCallback(
    predicateFor: PredicateForInterface | undefined,
    classId: string,
    propertyName: string
  ): string | undefined {
    if (predicateFor === undefined) {
      return undefined;
    }

    let resolved: string | undefined;

    try {
      resolved = predicateFor({
        classId,
        propertyName
      });
    } catch (error) {
      throw new GraphError(
        `predicateFor callback threw for property "${propertyName}" on class "${classId}"`,
        {
          'cause': BaseError.toCause(error),
          'code': GRAPH_ERROR_CODE.INVALID_PREDICATE_IRI
        }
      );
    }

    return typeof resolved === 'string' ? resolved : undefined;
  }
}

/**
 * PredicateResolver — derives RDF predicate IRIs from authored JSON Schema properties.
 *
 * @remarks
 * Implements the five-step resolution precedence: explicit `x-jt-predicate` annotation,
 * absolute property `$id`, `predicateFor` callback, canonical flat IRI, and class-scoped
 * fallback. All explicit IRIs are validated for control characters and spaces.
 *
 * @example
 * ```ts
 * const resolve = PredicateResolver.forConfig({ baseIri: 'https://example.com', enableCanonicalPredicates: true, predicateFor: undefined });
 * const iri = resolve({ classId: 'https://example.com/Book', propertyName: 'title', propertySchema: {} });
 * ```
 *
 * @category Graph
 * @since 0.1.0
 * @see {@link PredicateResolverInterface}
 * @group Graph
 */
export const PredicateResolver = {
  /**
   * Returns a closure that captures `baseIri`, `enableCanonicalPredicates`, and
   * `predicateFor`, so call-sites only need to pass `classId`, `propertyName`,
   * and `propertySchema`.
   */
  forConfig(config: {
    'baseIri': string;
    'enableCanonicalPredicates': boolean | undefined;
    'predicateFor': PredicateForInterface | undefined;
  }): PredicateResolverInterface {
    return (context: { readonly 'classId': string;
      readonly 'propertyName': string;
      readonly 'propertySchema': JsonSchemaType }): string => {
      const result = PredicateResolver.resolve({
        ...context,
        ...config
      });

      return result;
    };
  },

  /**
   * Derives the RDF predicate IRI for a property. Precedence (first match wins):
   *
   * 1. Explicit per-property `x-jt-predicate` string annotation (non-empty).
   * 2. Property `$id` that is an absolute IRI (contains `://` after a non-empty scheme).
   * 3. Resolver: `predicateFor` callback — if it returns a string, that wins.
   * 4. Default — canonical flat: `baseIri + propertyName` when `enableCanonicalPredicates !== false`.
   * 5. Class-scoped (DTO opt-out, `enableCanonicalPredicates: false`): `classId#propertyName`.
   *
   * All explicit predicates from steps 1 and 2 are validated for control
   * characters and spaces (throws `GraphError` with code `INVALID_PREDICATE_IRI`).
   */
  resolve(argumentList: {
    'baseIri': string;
    'classId': string;
    'enableCanonicalPredicates': boolean | undefined;
    'predicateFor': PredicateForInterface | undefined;
    'propertyName': string;
    'propertySchema': JsonSchemaType;
  }): string {
    const {
      baseIri,
      classId,
      enableCanonicalPredicates,
      predicateFor,
      propertyName,
      propertySchema
    } = argumentList;

    // 1 + 2. Explicit annotation or absolute $id on the property schema.
    const schemaIri = PredicateResolutionStep.schemaAnnotation(propertySchema);

    if (schemaIri !== undefined) {
      PredicateIriAssertions.assertSingleFragment(schemaIri);

      return schemaIri;
    }

    // 3. predicateFor callback.
    const callbackIri = PredicateResolutionStep.viaCallback(predicateFor, classId, propertyName);

    if (callbackIri !== undefined) {
      PredicateIriAssertions.assertSingleFragment(callbackIri);

      return callbackIri;
    }

    // 4. Default — canonical flat.
    if (enableCanonicalPredicates !== false) {
      const canonicalIri = PredicateResolutionStep.canonicalFlat(baseIri, propertyName);

      PredicateIriAssertions.assertSingleFragment(canonicalIri);

      return canonicalIri;
    }

    // 5. Class-scoped (DTO opt-out, enableCanonicalPredicates: false)
    const classScoped = SchemaIri.propertyIri(classId, propertyName);

    PredicateIriAssertions.assertSingleFragment(classScoped);

    return classScoped;
  }
} as const;
