/**
 * CURIE Expander
 *
 * Expands CURIE-like terms to full IRIs using a context map.
 * Converts compact URIs (prefix:localName) to full IRI format.
 */

const CURIE_PATTERN = /^([A-Za-z][\w-]*):(.+)$/u;
const FULL_IRI_PREFIX = /^https?:\/\//u;
const NUMERIC_LITERAL = /^-?\d/u;
const TOKEN_BOUNDARY = /[\s(),;[\]{}]/u;
const DECIMAL_DIGIT = /\d/u;

/**
 * CURIE Expander
 *
 * Expands compact URIs (CURIEs) to full IRIs using a provided context.
 */
export class CurieExpander {
  /**
   * Create a new CurieExpander with a prefix context.
   *
   * @param context - Map of prefix to base IRI (e.g., { myns: 'https://example.io/ns#' })
   */
  public constructor(private readonly context: Record<string, string>) {}

  /**
   * Expand a CURIE or value to a full IRI.
   *
   * @param value - CURIE (e.g., 'myns:Thing') or literal value
   * @returns Expanded IRI or original value if not a CURIE
   */
  public expand(value: string): string {
    if (!value) {
      return value;
    }
    if (value.startsWith('<') || FULL_IRI_PREFIX.test(value)) {
      return value;
    }

    if (NUMERIC_LITERAL.test(value)) {
      return value;
    }

    const curieMatch = CURIE_PATTERN.exec(value);

    if (curieMatch) {
      const prefix = curieMatch[1];
      const suffix = curieMatch[2];

      if (prefix && suffix) {
        const base = this.context[prefix];

        if (base) {
          return `<${base}${suffix}>`;
        }
      }
    }

    const vocab = this.context['@vocab'];

    if (vocab) {
      return `<${vocab}${value}>`;
    }

    return value;
  }

  /**
   * Expand CURIE tokens in an N3 string.
   *
   * @param n3 - N3 formatted text
   * @returns N3 text with expanded CURIEs
   */
  public expandTokens(n3: string): string {
    const lines = n3.split('\n');
    const expandedLines = lines.map((line) => {
      const trimmed = line.trim();

      if (
        trimmed.startsWith('@prefix')
        || trimmed.startsWith('@base')
        || trimmed.startsWith('PREFIX')
        || trimmed.startsWith('BASE')
      ) {
        return line;
      }

      let buffer = '';
      let index = 0;
      let inString = false;
      let output = '';

      const flushBuffer = (): void => {
        if (!buffer) {
          return;
        }
        const expanded = this.expand(buffer);

        output += expanded;
        buffer = '';
      };

      while (index < line.length) {
        const character = line[index];

        if (!character) {
          continue;
        }

        if (character === '"') {
          flushBuffer();
          output += character;
          inString = !inString;
          index += 1;
          continue;
        }

        if (inString) {
          output += character;
          index += 1;
          continue;
        }

        if (character === '<') {
          flushBuffer();
          const end = line.indexOf('>', index + 1);

          if (end !== -1) {
            output += line.slice(index, end + 1);
            index = end + 1;
            continue;
          }
        }

        /*
         * Handle '.' specially: only treat as token boundary if it's a statement terminator
         * (not part of a decimal number)
         */
        if (character === '.') {
          const nextCharacter = line[index + 1];
          const lastCharacterInBuffer = buffer.at(-1);
          const isDecimalPoint
            = buffer.length > 0
            && lastCharacterInBuffer !== undefined
            && DECIMAL_DIGIT.test(lastCharacterInBuffer)
            && nextCharacter !== ''
            && DECIMAL_DIGIT.test(nextCharacter);

          if (isDecimalPoint) {
            buffer += character;
            index += 1;
            continue;
          }

          flushBuffer();
          output += character;
          index += 1;
          continue;
        }

        if (TOKEN_BOUNDARY.test(character)) {
          flushBuffer();
          output += character;
          index += 1;
          continue;
        }

        buffer += character;
        index += 1;
      }

      flushBuffer();

      return output;
    });

    return expandedLines.join('\n');
  }
}
