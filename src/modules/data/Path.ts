import { VALID_IDENTIFIER } from '../../constants/PATH.js';

export class Path {
  /**
   * Convert a JSON Pointer (`/items/0/quantity`) to access form (`items[0].quantity`).
   *
   * Root pointer (`""` or `"/"`) returns an empty string.
   */
  public static toAccess(jsonPointer: string): string {
    if (jsonPointer === '' || jsonPointer === '/') {
      return '';
    }

    const segments = jsonPointer
      .split('/')
      .slice(1)
      .map((seg) => {
        return seg.replaceAll('~1', '/').replaceAll('~0', '~');
      });

    let result = '';

    for (const segment of segments) {
      if (/^\d+$/u.test(segment)) {
        result += `[${segment}]`;
      } else if (VALID_IDENTIFIER.test(segment)) {
        result += result === '' ? segment : `.${segment}`;
      } else {
        result += `["${segment}"]`;
      }
    }

    return result;
  }
}
