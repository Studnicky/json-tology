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

    return parentPointer === '' ? parts.base : `${parts.base}#${parentPointer}`;
  }
}
