/**
 * SchemaIriInterface — static contract for SchemaIri.
 *
 * Captures the public static surface of SchemaIri as a named type so that
 * consumers can depend on the interface rather than the concrete class.
 */

export interface SchemaIriInterface {
  /** Encodes a string for use as a URI path segment, preserving forward slashes. */
  escapeSegment(value: string): string;

  /** Check whether the fragment of a subject IRI contains a given substring. */
  fragmentContains(subject: string, segment: string): boolean;

  /** Check whether a subject IRI refers to a property (contains `/properties/` in fragment). */
  isPropertySubject(subject: string): boolean;

  /** Extract the last path segment after `#` in a subject IRI. */
  lastSegment(subject: string): string;

  /** Generate a property IRI by appending a fragment to a class IRI. */
  propertyIri(classId: string, propertyName: string): string;

  /** Split a subject IRI into base and fragment parts at the `#` boundary. */
  splitSubject(subject: string): {
    'base': string;
    'fragment': null | string;
  };

  /** Derive the structural parent of a subject by removing the last `/properties/...` segment. */
  structuralParent(subject: string): string;
}
