/**
 * SchemaIri — IRI encoding, parsing, and classification for schema subjects.
 *
 * Consolidates all schema IRI operations: URI segment encoding,
 * property IRI construction, subject splitting, fragment analysis,
 * and structural navigation.
 */

// ---------------------------------------------------------------------------
// URI encoding
// ---------------------------------------------------------------------------

/**
 * Encodes a string for use as a URI path segment, preserving forward slashes.
 *
 * @param value - The raw string to escape.
 * @returns The percent-encoded string with `/` characters preserved.
 */
export function escapeSegment(value: string): string {
  return encodeURIComponent(value).replaceAll('%2F', '/');
}

/**
 * Generate a property IRI by appending a fragment to a class IRI.
 *
 * @param classId - The class `$id` (e.g. `https://example.io/User`).
 * @param propertyName - The property name (e.g. `email`).
 * @returns The property IRI (e.g. `https://example.io/User#email`).
 */
export function propertyIri(classId: string, propertyName: string): string {
  return `${classId}#${propertyName}`;
}

// ---------------------------------------------------------------------------
// Subject parsing
// ---------------------------------------------------------------------------

/**
 * Split a subject IRI into base and fragment parts at the `#` boundary.
 *
 * @param subject - The full subject IRI.
 * @returns An object with `base` (before `#`) and `fragment` (after `#`, or `null`).
 */
export function splitSubject(subject: string): { 'base': string;
  'fragment': null | string } {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return {
      'base': subject,
      'fragment': null
    };
  }

  return {
    'base': subject.slice(0, hashIdx),
    'fragment': subject.slice(hashIdx + 1)
  };
}

// ---------------------------------------------------------------------------
// Subject classification
// ---------------------------------------------------------------------------

/**
 * Check whether a subject IRI refers to a property (contains `/properties/` in fragment).
 *
 * @param subject - The subject IRI to test.
 * @returns `true` if the fragment contains `/properties/`.
 */
export function isPropertySubject(subject: string): boolean {
  const parts = splitSubject(subject);

  if (parts.fragment === null) {
    return false;
  }

  return parts.fragment.includes('/properties/');
}

/**
 * Check whether the fragment of a subject IRI contains a given substring.
 *
 * @param subject - The subject IRI.
 * @param segment - The substring to search for in the fragment.
 * @returns `true` if the fragment contains `segment`.
 */
export function fragmentContains(subject: string, segment: string): boolean {
  const parts = splitSubject(subject);

  if (parts.fragment === null) {
    return false;
  }

  return parts.fragment.includes(segment);
}

// ---------------------------------------------------------------------------
// Structural navigation
// ---------------------------------------------------------------------------

/**
 * Derive the structural parent of a subject by removing the last `/properties/...` segment.
 *
 * @param subject - The subject IRI.
 * @returns The parent IRI, or the subject itself if no parent exists.
 */
export function structuralParent(subject: string): string {
  const parts = splitSubject(subject);

  if (parts.fragment === null) {
    return subject;
  }

  const propsIdx = parts.fragment.lastIndexOf('/properties/');

  if (propsIdx === -1) {
    return parts.base;
  }

  const parentPointer = parts.fragment.slice(0, propsIdx);

  return parentPointer === '' ? parts.base : `${parts.base}#${parentPointer}`;
}

/**
 * Extract the last path segment after `#` in a subject IRI.
 *
 * @param subject - The subject IRI.
 * @returns The final `/`-delimited segment, or the full subject if no `#` exists.
 */
export function lastSegment(subject: string): string {
  const hashIdx = subject.indexOf('#');

  if (hashIdx === -1) {
    return subject;
  }

  const segments = subject.slice(hashIdx + 1).split('/');

  return segments.at(-1) ?? '';
}
