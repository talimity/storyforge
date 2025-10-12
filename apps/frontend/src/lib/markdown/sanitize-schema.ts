import type { Schema } from "hast-util-sanitize";
import { defaultSchema } from "hast-util-sanitize";

type AttributesMap = NonNullable<Schema["attributes"]>;
type AttributeEntry = AttributesMap[string][number];
type ProtocolsMap = NonNullable<Schema["protocols"]>;

function cloneAttributes(source: Schema["attributes"]): AttributesMap {
  if (!source) {
    return {};
  }
  const copy: AttributesMap = {};
  for (const key of Object.keys(source)) {
    const values = source[key];
    if (values) {
      copy[key] = [...values];
    }
  }
  return copy;
}

function appendAttributes(
  target: AttributesMap,
  key: string,
  additions: ReadonlyArray<AttributeEntry>
) {
  const current = target[key] ?? [];
  const next: AttributeEntry[] = [...current];
  for (const addition of additions) {
    if (typeof addition === "string") {
      const exists = next.some((entry) => typeof entry === "string" && entry === addition);
      if (!exists) {
        next.push(addition);
      }
      continue;
    }

    let found = false;
    for (const entry of next) {
      if (!Array.isArray(entry) || !Array.isArray(addition)) {
        continue;
      }
      if (entry.length !== addition.length) {
        continue;
      }
      let identical = true;
      for (let index = 0; index < entry.length; index += 1) {
        if (entry[index] !== addition[index]) {
          identical = false;
          break;
        }
      }
      if (identical) {
        found = true;
        break;
      }
    }

    if (!found) {
      next.push(addition);
    }
  }
  target[key] = next;
}

function cloneProtocols(source: Schema["protocols"]): ProtocolsMap {
  if (!source) {
    return {};
  }
  const copy: ProtocolsMap = {};
  for (const key of Object.keys(source)) {
    const values = source[key];
    if (values) {
      copy[key] = [...values];
    }
  }
  return copy;
}

function appendProtocols(target: ProtocolsMap, key: string, additions: ReadonlyArray<string>) {
  const current = target[key] ?? [];
  const next = [...current];
  for (const addition of additions) {
    if (!next.includes(addition)) {
      next.push(addition);
    }
  }
  target[key] = next;
}

const tagNames = defaultSchema.tagNames ? Array.from(defaultSchema.tagNames) : [];
const extraTagNames = ["div", "span", "figure", "figcaption", "q", "picture"];
for (const tagName of extraTagNames) {
  if (!tagNames.includes(tagName)) {
    tagNames.push(tagName);
  }
}

const attributes = cloneAttributes(defaultSchema.attributes ?? undefined);
appendAttributes(attributes, "*", ["className", "data*"]);
appendAttributes(attributes, "img", [
  "alt",
  "src",
  "title",
  "loading",
  "decoding",
  "width",
  "height",
  "referrerPolicy",
]);
appendAttributes(attributes, "a", ["href", "title", "target", "rel"]);

const protocols = cloneProtocols(defaultSchema.protocols ?? undefined);
appendProtocols(protocols, "href", ["http", "https"]);
appendProtocols(protocols, "src", ["http", "https"]);

export const richTextSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames,
  attributes,
  protocols,
};
