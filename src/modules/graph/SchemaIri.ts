export class SchemaIri {
  static escapeSegment(value: string): string {
    return encodeURIComponent(value).replaceAll('%2F', '/');
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
    const hashIdx = subject.indexOf('#');

    if (hashIdx === -1) {
      return subject;
    }

    const segments = subject.slice(hashIdx + 1).split('/');

    return segments.at(-1) ?? '';
  }

  static parseRef(ref: string): { 'fragment': string;
    'id': string } {
    const hashIndex = ref.indexOf('#');
    const id = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);

    return {
      fragment,
      id
    };
  }

  static propertyIri(classId: string, propertyName: string): string {
    return `${classId}#${propertyName}`;
  }

  static splitSubject(subject: string): { 'base': string;
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

  static structuralParent(subject: string): string {
    const parts = SchemaIri.splitSubject(subject);

    if (parts.fragment === null) {
      return subject;
    }

    const propsIdx = parts.fragment.lastIndexOf('/properties/');

    if (propsIdx === -1) {
      return parts.base;
    }

    const parentPointer = parts.fragment.slice(0, propsIdx);

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
    const strippedPointer = /^(?:\/allOf\/\d+)+$/u.test(parentPointer)
      ? parentPointer.replace(/^(?:\/allOf\/\d+)+/u, '')
      : parentPointer;

    return strippedPointer === '' ? parts.base : `${parts.base}#${strippedPointer}`;
  }
}
