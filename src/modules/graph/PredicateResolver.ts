import type { JsonSchemaType } from '../../types/Schema.js';
import type { PredicateForType } from '../../types/PredicateFor.js';
import type { PredicateResolverFnType } from '../../types/PredicateResolverFn.js';
import { isRecord } from '../data/DataTypes.js';
import { GraphError } from '../../errors/GraphError.js';
import { SchemaIri } from './SchemaIri.js';

/** Highest ASCII control character codepoint (inclusive). */
const CONTROL_CHAR_MAX = 0x20;
/** DEL codepoint. */
const DEL_CODEPOINT = 0x7F;
/** Highest C1 control character codepoint (inclusive). */
const C1_CONTROL_MAX = 0x9F;
/** Radix used when formatting a codepoint as hex in error messages. */
const HEX_RADIX = 16;

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

    if (code <= CONTROL_CHAR_MAX || (code >= DEL_CODEPOINT && code <= C1_CONTROL_MAX)) {
      throw new GraphError(
        'INVALID_PREDICATE_IRI',
        `Predicate IRI contains a control character or space (codepoint 0x${code.toString(HEX_RADIX)}): ${JSON.stringify(iri)}`
      );
    }
  }
}

/**
 * Steps 1 + 2: resolve an explicit `x-jt-predicate` annotation or absolute
 * `$id` from the property schema. Returns the validated IRI or `undefined`.
 */
function resolveSchemaAnnotation(propertySchema: JsonSchemaType): string | undefined {
  if (!isRecord(propertySchema)) {
    return undefined;
  }

  // 1. Explicit per-property binding via x-jt-predicate (must be non-empty string)
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

  return undefined;
}

/**
 * Step 3: invoke the `predicateFor` callback and return the result, or
 * `undefined` if the callback is absent or returns a non-string value.
 * Wraps callback errors as `GraphError` with code `INVALID_PREDICATE_IRI`.
 */
function resolveViaCallback(
  predicateFor: PredicateForType | undefined,
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
      'INVALID_PREDICATE_IRI',
      `predicateFor callback threw for property "${propertyName}" on class "${classId}"`,
      { 'cause': error instanceof Error ? error : new Error(String(error)) }
    );
  }

  return typeof resolved === 'string' ? resolved : undefined;
}

/**
 * Step 4: build the canonical flat predicate IRI from `baseIRI` and
 * `propertyName`, inserting a `/` separator unless the base already ends with
 * a delimiter (`/`, `#`, or `:` for URN namespaces).
 */
function resolveCanonicalFlat(baseIRI: string, propertyName: string): string {
  const endsWithDelimiter = baseIRI.endsWith('/') || baseIRI.endsWith('#') || baseIRI.endsWith(':');
  const separator = endsWithDelimiter ? '' : '/';

  return `${baseIRI}${separator}${propertyName}`;
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
 * const resolve = PredicateResolver.forConfig({ baseIRI: 'https://example.com', enableCanonicalPredicates: true, predicateFor: undefined });
 * const iri = resolve({ classId: 'https://example.com/Book', propertyName: 'title', propertySchema: {} });
 * ```
 *
 * @category Graph
 * @since 0.1.0
 * @see {@link PredicateResolverFnType}
 * @group Graph
 */
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
    return (ctx: { readonly 'classId': string;
      readonly 'propertyName': string;
      readonly 'propertySchema': JsonSchemaType }): string => {
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

    // 1 + 2. Explicit annotation or absolute $id on the property schema.
    const schemaIri = resolveSchemaAnnotation(propertySchema);

    if (schemaIri !== undefined) {
      return schemaIri;
    }

    // 3. predicateFor callback.
    const callbackIri = resolveViaCallback(predicateFor, classId, propertyName);

    if (callbackIri !== undefined) {
      return callbackIri;
    }

    // 4. Default — canonical flat.
    if (enableCanonicalPredicates !== false) {
      return resolveCanonicalFlat(baseIRI, propertyName);
    }

    // 5. Class-scoped (DTO opt-out, enableCanonicalPredicates: false)
    return SchemaIri.propertyIri(classId, propertyName);
  }
} as const;
