import { parseTemplateString } from "./leaf/parser.js";

export type TemplateSegment =
  | { kind: "text"; content: string }
  | { kind: "variable"; content: string }
  | { kind: "blockStart"; content: string; expression: string }
  | { kind: "blockElse"; content: string }
  | { kind: "blockEnd"; content: string };

export type TemplateTokenizeResult = {
  segments: TemplateSegment[];
  errors: string[];
};

export function tokenizeTemplateString(template: string): TemplateTokenizeResult {
  const segments: TemplateSegment[] = [];
  let cursor = 0;

  while (cursor < template.length) {
    const openIndex = template.indexOf("{{", cursor);

    if (openIndex === -1) {
      const remaining = template.slice(cursor);
      if (remaining.length > 0) {
        segments.push({ kind: "text", content: remaining });
      }
      break;
    }

    if (openIndex > cursor) {
      segments.push({ kind: "text", content: template.slice(cursor, openIndex) });
    }

    const closeIndex = template.indexOf("}}", openIndex + 2);
    if (closeIndex === -1) {
      const remainder = template.slice(openIndex);
      segments.push({ kind: "text", content: remainder });
      cursor = template.length;
      break;
    }

    const raw = template.slice(openIndex, closeIndex + 2);
    const inner = template.slice(openIndex + 2, closeIndex);
    segments.push(classifyMustache(raw, inner));
    cursor = closeIndex + 2;
  }

  const parseResult = parseTemplateString(template);
  const errors = parseResult.ok ? [] : parseResult.errors;

  return { segments, errors };
}

function classifyMustache(raw: string, inner: string): TemplateSegment {
  const trimmed = inner.trim();
  if (!trimmed.startsWith("#")) {
    return { kind: "variable", content: raw };
  }

  const directive = trimmed.slice(1);
  const { head, tail } = splitHead(directive);

  if (head === "if") {
    return { kind: "blockStart", content: raw, expression: tail };
  }

  if (head === "else" && tail.length === 0) {
    return { kind: "blockElse", content: raw };
  }

  if (head === "endif" && tail.length === 0) {
    return { kind: "blockEnd", content: raw };
  }

  return { kind: "variable", content: raw };
}

function splitHead(value: string): { head: string; tail: string } {
  let index = 0;
  while (index < value.length && !isWhitespace(value[index])) {
    index += 1;
  }
  const head = value.slice(0, index);
  const tail = value.slice(index).trim();
  return { head, tail };
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\n" || char === "\r" || char === "\t";
}
