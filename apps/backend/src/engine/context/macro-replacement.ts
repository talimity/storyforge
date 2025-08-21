/**
 * Macro replacement utility for handling SillyTavern-style macros
 * in character descriptions and content.
 */

export interface MacroContext {
  /** Name of the character marked as user proxy */
  userProxyName?: string;
  /** Character currently being processed */
  currentCharacterName?: string;
}

/**
 * Replaces common macros in text with their contextual values.
 *
 * Supported macros:
 * - {{user}} - Replaced with the name of the user proxy character
 * - {{char}} - Replaced with the name of the current character
 *
 * @param text The text containing macros to replace
 * @param context The context providing replacement values
 * @returns The text with macros replaced
 */
export function replaceMacros(text: string, context: MacroContext): string {
  let result = text;

  // Replace {{user}} with user proxy name
  if (context.userProxyName) {
    result = result.replace(/\{\{user\}\}/gi, context.userProxyName);
  }

  // Replace {{char}} with current character name
  if (context.currentCharacterName) {
    result = result.replace(/\{\{char\}\}/gi, context.currentCharacterName);
  }

  // Additional common SillyTavern macros can be added here in the future:
  // - {{time}} - Current time
  // - {{date}} - Current date
  // - {{random}} - Random number
  // - {{roll}} - Dice roll
  // etc.

  return result;
}

/**
 * Checks if a text contains any macros that need replacement.
 * Useful for warning users when no user proxy is set.
 */
export function containsMacros(text: string): boolean {
  const macroPattern = /\{\{(user|char|time|date|random|roll)\}\}/i;
  return macroPattern.test(text);
}

/**
 * Gets a list of all macro names found in the text.
 */
export function findMacros(text: string): string[] {
  const macroPattern = /\{\{(\w+)\}\}/g;
  const matches = text.matchAll(macroPattern);
  const macros = new Set<string>();

  for (const match of matches) {
    macros.add(match[1].toLowerCase());
  }

  return Array.from(macros);
}
