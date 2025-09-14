/**
 * Given an array of character names, returns a default scenario name in the
 * form of "Character 1, Character 2, & Character 3".
 */
export function makeScenarioName(characters: string[]): string | null {
  const count = characters.length;
  if (count === 0) {
    return null;
  }
  if (count === 1) {
    return characters[0];
  } else if (count === 2) {
    return `${characters[0]} & ${characters[1]}`;
  } else if (count === 3) {
    return `${characters[0]}, ${characters[1]}, & ${characters[2]}`;
  } else {
    return `${characters[0]}, ${characters[1]}, & others`;
  }
}
