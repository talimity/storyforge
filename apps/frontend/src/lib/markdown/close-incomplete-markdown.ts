export function closeIncompleteMarkdown(input: string): string {
  if (input.length === 0) {
    return input;
  }

  let result = input;

  // Trim dangling link or image markers without a closing bracket.
  const lastImageMarker = result.lastIndexOf("![");
  const lastLinkMarker = result.lastIndexOf("[");
  const lastClosingBracket = result.lastIndexOf("]");
  const lastMarker = Math.max(lastImageMarker, lastLinkMarker);
  if (lastMarker > lastClosingBracket) {
    result = result.slice(0, lastMarker);
  }

  // Close unfinished code fences first so that inline markers do not mis-detect.
  const fenceToken = "```";
  const fenceCount = countOccurrences(result, fenceToken);
  if (fenceCount % 2 === 1) {
    if (!result.endsWith("\n")) {
      result += "\n";
    }
    result += fenceToken;
  }

  // Balance paired emphasis markers like **, __, ~~.
  const pairedTokens = ["**", "__", "~~"];
  for (const token of pairedTokens) {
    if (countOccurrences(result, token) % 2 === 1) {
      result += token;
    }
  }

  // Balance single-character emphasis markers that are not part of pairs.
  const singleTokens: { marker: string; detector: (value: string, index: number) => boolean }[] = [
    {
      marker: "*",
      detector: (value, index) => {
        const prev = index > 0 ? value[index - 1] : "";
        const next = index + 1 < value.length ? value[index + 1] : "";
        return prev !== "*" && next !== "*";
      },
    },
    {
      marker: "_",
      detector: (value, index) => {
        const prev = index > 0 ? value[index - 1] : "";
        const next = index + 1 < value.length ? value[index + 1] : "";
        return prev !== "_" && next !== "_";
      },
    },
  ];

  for (const token of singleTokens) {
    if (countIsolatedMarkers(result, token.marker, token.detector) % 2 === 1) {
      result += token.marker;
    }
  }

  // Balance inline code markers (`) while ignoring fences (```).
  if (countSingleBackticks(result) % 2 === 1) {
    result += "`";
  }

  return result;
}

function countOccurrences(value: string, token: string): number {
  let count = 0;
  let index = value.indexOf(token);
  while (index !== -1) {
    count += 1;
    index = value.indexOf(token, index + token.length);
  }
  return count;
}

function countIsolatedMarkers(
  value: string,
  marker: string,
  detector: (text: string, index: number) => boolean
): number {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === marker && detector(value, index)) {
      count += 1;
    }
  }
  return count;
}

function countSingleBackticks(value: string): number {
  let count = 0;
  let index = 0;
  const length = value.length;

  while (index < length) {
    if (value[index] !== "`") {
      index += 1;
      continue;
    }

    let runLength = 1;
    let pointer = index + 1;
    while (pointer < length && value[pointer] === "`") {
      runLength += 1;
      pointer += 1;
    }

    if (runLength === 1) {
      count += 1;
    }

    index = pointer;
  }

  return count;
}
