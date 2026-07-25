import {
  ALLOF_PATH_ONLY_RE, ALLOF_PATH_PREFIX_RE
} from '../../constants/GRAPH_REGEXES.js';

export class SchemaIri {
  static escapeSegment(value: string): string {
    const result = encodeURIComponent(value).replaceAll('%2F', '/');

    return result;
  }

  static fragmentContains(subject: string, segment: string): boolean {
    const parts = SchemaIri.splitSubject(subject);

    if (parts.fragment === null) {
      return false;
    }

    return parts.fragment.includes(segment);
  }

  static isPropertySubject(subject: string): boolean {
    const parts = SchemaIri.splitSubject(subject);

    if (parts.fragment === null) {
      return false;
    }

    return parts.fragment.includes('/properties/');
  }

  static lastSegment(subject: string): string {
    const hashIndex = subject.indexOf('#');

    if (hashIndex === -1) {
      return subject;
    }

    const segments = subject.slice(hashIndex + 1).split('/');

    return segments.at(-1) ?? '';
  }

  /**
   * Strip trailing slashes from a base IRI.
   *
   * @param iri - A base IRI string, possibly with one or more trailing slashes.
   * @returns The IRI with all trailing slashes removed.
   *
   * @example
   * ```ts
   * SchemaIri.normalizeBase('https://example.com/') // 'https://example.com'
   * SchemaIri.normalizeBase('https://example.com')  // 'https://example.com'
   * ```
   */
  static normalizeBase(iri: string): string {
    let base = iri;

    while (base.endsWith('/')) {
      base = base.slice(0, -1);
    }

    return base;
  }

  static parseReference(reference: string): { 'fragment': string;
    'id': string } {
    const hashIndex = reference.indexOf('#');
    const id = hashIndex === -1 ? reference : reference.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? '' : reference.slice(hashIndex + 1);

    return {
      fragment,
      id
    };
  }

  static propertyIri(classId: string, propertyName: string): string {
    const result = `${classId}#${propertyName}`;

    return result;
  }

  /**
   * Extract the JSON property key name from a property IRI.
   *
   * Resolution priority:
   *   1. `<base>#/properties/<name>[/<deeper>]` — JSON-pointer form: returns `<name>`
   *      (the segment immediately after `/properties/`; any further nesting is ignored).
   *   2. `<base>#<fragment>` — bare fragment: returns the last `/`-separated segment
   *      of the fragment (e.g. `ClassName#propName` → `propName`).
   *   3. No `#` — returns the last `/`-separated segment of the whole IRI.
   *
   * @param iri - A full property IRI (with or without a `#` fragment).
   * @returns The short property key name, or `''` when the IRI is malformed.
   *
   * @example
   * ```ts
   * SchemaIri.propertyName('https://ex.com/User#/properties/email') // 'email'
   * SchemaIri.propertyName('https://ex.com/User#email')             // 'email'
   * SchemaIri.propertyName('https://ex.com/User#propName')          // 'propName'
   * SchemaIri.propertyName('https://ex.com/User#/properties/address/properties/city') // 'address'
   * SchemaIri.propertyName('https://ex.com/vocab/email')            // 'email'
   * ```
   */
  static propertyName(iri: string): string {
    const hashIndex = iri.indexOf('#');

    if (hashIndex !== -1) {
      const fragment = iri.slice(hashIndex + 1);
      const propertiesIndex = fragment.indexOf('/properties/');

      if (propertiesIndex !== -1) {
        // JSON-pointer form: take the segment right after '/properties/'
        const afterProps = fragment.slice(propertiesIndex + '/properties/'.length);
        const slashIndex = afterProps.indexOf('/');

        return slashIndex === -1 ? afterProps : afterProps.slice(0, slashIndex);
      }

      // Bare fragment — last segment after '/'
      const slashIndex = fragment.lastIndexOf('/');

      return slashIndex === -1 ? fragment : fragment.slice(slashIndex + 1);
    }

    // No fragment — last path segment
    const slashIndex = iri.lastIndexOf('/');

    return slashIndex === -1 ? iri : iri.slice(slashIndex + 1);
  }

  /**
   * Split a JSON Pointer fragment at the last `/properties/` boundary.
   *
   * Returns the parent pointer (everything before the last `/properties/`) and
   * the property name (the segment immediately after `/properties/`). Returns
   * `undefined` when no `/properties/` segment exists in the fragment.
   *
   * Operates on a bare fragment string (the part after `#`), not a full IRI.
   * Use `splitSubject` first to extract the fragment from a full IRI.
   *
   * @param fragment - A JSON Pointer fragment string (e.g. `/properties/name`
   *   or `/properties/address/properties/city`).
   * @returns `{ parent, property }` where `parent` is the pointer prefix before
   *   the last `/properties/` segment and `property` is the property key name,
   *   or `undefined` when `/properties/` is not found.
   *
   * @example
   * ```ts
   * SchemaIri.splitAtProperties('/properties/name')
   * // → { parent: '', property: 'name' }
   *
   * SchemaIri.splitAtProperties('/properties/address/properties/city')
   * // → { parent: '/properties/address', property: 'city' }
   *
   * SchemaIri.splitAtProperties('/allOf/0')
   * // → undefined
   * ```
   */
  static splitAtProperties(fragment: string): undefined | { 'parent': string;
    'property': string } {
    const propertiesIndex = fragment.lastIndexOf('/properties/');

    if (propertiesIndex === -1) {
      return undefined;
    }

    const parent = fragment.slice(0, propertiesIndex);
    const afterProps = fragment.slice(propertiesIndex + '/properties/'.length);
    const slashIndex = afterProps.indexOf('/');
    const property = slashIndex === -1 ? afterProps : afterProps.slice(0, slashIndex);

    return {
      parent,
      property
    };
  }

  static splitSubject(subject: string): { 'base': string;
    'fragment': null | string } {
    // Split at the LAST `#` so a hash-namespace `$id` (e.g.
    // `http://www.w3.org/2004/02/skos/core#Concept`) is preserved in `base`
    // and only the JSON-pointer/anchor fragment that follows the final `#`
    // (e.g. `/properties/skos:prefLabel`) is returned as `fragment`. For
    // single-hash subjects this is identical to splitting at the first `#`.
    const hashIndex = subject.lastIndexOf('#');

    if (hashIndex === -1) {
      return {
        'base': subject,
        'fragment': null
      };
    }

    return {
      'base': subject.slice(0, hashIndex),
      'fragment': subject.slice(hashIndex + 1)
    };
  }

  static structuralParent(subject: string): string {
    const parts = SchemaIri.splitSubject(subject);

    if (parts.fragment === null) {
      return subject;
    }

    const propertiesIndex = parts.fragment.lastIndexOf('/properties/');

    if (propertiesIndex === -1) {
      return parts.base;
    }

    const parentPointer = parts.fragment.slice(0, propertiesIndex);

    if (parentPointer === '') {
      return parts.base;
    }

    // Properties declared directly inside an `allOf/N` member (e.g. those
    // produced by `Compose.subClassOf`) belong to the parent class, not to the
    // anonymous allOf member node. When the parent pointer is purely `/allOf/N`
    // segments, strip them so the domain emitted in the TBox is the named class
    // IRI (`<ClassId>`) rather than the internal fragment `<ClassId>#/allOf/N`.
    // A pointer that descends into a nested object (`/allOf/N/properties/x`) is
    // left intact — its structural parent is that nested object, not the class.
    // Kept consistent with the domain logic in SchemaGraphRelations.
    const strippedPointer = ALLOF_PATH_ONLY_RE.test(parentPointer)
      ? parentPointer.replace(ALLOF_PATH_PREFIX_RE, '')
      : parentPointer;

    return strippedPointer === '' ? parts.base : `${parts.base}#${strippedPointer}`;
  }
}
