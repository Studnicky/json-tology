/**
 * HTML character encoding used in generated visualization output.
 *
 * @remarks
 * Applied to `<meta charset>` in generated HTML visualization files.
 *
 * @example
 * ```ts
 * `<meta charset="${HTML_CHARSET}">`
 * ```
 *
 * @category Visualization
 * @since 0.1.0
 * @see {@link https://www.iana.org/assignments/character-sets/character-sets.xhtml IANA charset registry}
 * @defaultValue `'utf8'`
 * @group Constants
 */
export const HTML_CHARSET = 'utf8';

/**
 * Initial viewport scale for generated visualization HTML.
 *
 * @remarks
 * Used in the `<meta name="viewport">` initial-scale property of generated HTML files.
 *
 * @example
 * ```ts
 * `initial-scale=${VIEWPORT_SCALE}`
 * ```
 *
 * @category Visualization
 * @since 0.1.0
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag MDN Viewport meta tag}
 * @defaultValue `'1.0'`
 * @group Constants
 */
export const VIEWPORT_SCALE = '1.0';

/**
 * Dark foreground color used in visualization styles.
 *
 * @remarks
 * Applied to primary text and borders in generated visualization CSS.
 *
 * @example
 * ```ts
 * `color: ${CSS_COLOR_DARK}`
 * ```
 *
 * @category Visualization
 * @since 0.1.0
 * @see CSS_COLOR_MID
 * @defaultValue `'#333'`
 * @group Constants
 */
export const CSS_COLOR_DARK = '#333';

/**
 * Semi-bold font weight used in visualization typography.
 *
 * @remarks
 * Applied to section headings and emphasized labels in generated CSS.
 *
 * @example
 * ```ts
 * `font-weight: ${CSS_FONT_WEIGHT_SEMIBOLD}`
 * ```
 *
 * @category Visualization
 * @since 0.1.0
 * @see CSS_FONT_WEIGHT_MEDIUM
 * @defaultValue `600`
 * @group Constants
 */
export const CSS_FONT_WEIGHT_SEMIBOLD = 600;

/**
 * CSS transition duration in seconds for visualization interactive elements.
 *
 * @remarks
 * Used as the `transition-duration` value in visualization hover and toggle effects.
 *
 * @example
 * ```ts
 * `transition: all ${CSS_TRANSITION_DURATION}s ease`
 * ```
 *
 * @category Visualization
 * @since 0.1.0
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/transition-duration MDN transition-duration}
 * @defaultValue `'0.2'`
 * @group Constants
 */
export const CSS_TRANSITION_DURATION = '0.2';

/**
 * Medium font weight used in visualization typography.
 *
 * @remarks
 * Applied to body labels and secondary text in generated visualization CSS.
 *
 * @example
 * ```ts
 * `font-weight: ${CSS_FONT_WEIGHT_MEDIUM}`
 * ```
 *
 * @category Visualization
 * @since 0.1.0
 * @see CSS_FONT_WEIGHT_SEMIBOLD
 * @defaultValue `500`
 * @group Constants
 */
export const CSS_FONT_WEIGHT_MEDIUM = 500;

/**
 * Reduced opacity value for muted visualization elements.
 *
 * @remarks
 * Applied to secondary or de-emphasized elements in generated visualization CSS.
 *
 * @example
 * ```ts
 * `opacity: ${CSS_OPACITY_MUTED}`
 * ```
 *
 * @category Visualization
 * @since 0.1.0
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/opacity MDN opacity}
 * @defaultValue `0.8`
 * @group Constants
 */
export const CSS_OPACITY_MUTED = 0.8;

/**
 * Mid-tone foreground color used in visualization styles.
 *
 * @remarks
 * Applied to secondary text and subtle borders in generated visualization CSS.
 *
 * @example
 * ```ts
 * `color: ${CSS_COLOR_MID}`
 * ```
 *
 * @category Visualization
 * @since 0.1.0
 * @see CSS_COLOR_DARK
 * @defaultValue `'#666'`
 * @group Constants
 */
export const CSS_COLOR_MID = '#666';

/**
 * Light foreground color used in visualization styles.
 *
 * @remarks
 * Applied to tertiary text and disabled state indicators in generated visualization CSS.
 *
 * @example
 * ```ts
 * `color: ${CSS_COLOR_LIGHT}`
 * ```
 *
 * @category Visualization
 * @since 0.1.0
 * @see CSS_COLOR_MID
 * @defaultValue `'#999'`
 * @group Constants
 */
export const CSS_COLOR_LIGHT = '#999';
