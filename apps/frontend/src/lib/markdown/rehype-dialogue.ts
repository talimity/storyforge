import type { Element, ElementContent, Properties, Root, Text } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export interface DialogueOptions {
  authorId?: string | null;
}

function textNode(value: string): Text {
  return { type: "text", value };
}

function quoteEl(children: ElementContent[], authorId: string | null): Element {
  const properties: Properties = authorId ? { "data-author": authorId } : {};
  return { type: "element", tagName: "q", properties, children };
}

const OPENERS = new Set<string>(['"', "“"]);
const CLOSER_FOR: Record<string, string> = { '"': '"', "“": "”" };

export const rehypeDialogue: Plugin<[DialogueOptions?], Root> = (options) => {
  const authorId = options?.authorId ?? null;

  return (tree) => {
    visit(tree, "element", (node, _index, parent) => {
      if (!parent || node.tagName !== "p") return;

      const out: ElementContent[] = [];

      // Quote-collection state
      let buffer: ElementContent[] | null = null;
      let expectedClose: string | null = null;

      const push = (n: ElementContent) => {
        if (buffer) buffer.push(n);
        else out.push(n);
      };

      const startQuote = (mark: string) => {
        buffer = [];
        expectedClose = CLOSER_FOR[mark] ?? '"';
        // Keep the literal opening mark inside the <q>
        buffer.push(textNode(mark));
      };

      const endQuote = (mark: string) => {
        if (!buffer || !expectedClose) return;
        // Keep the literal closing mark inside the <q>
        buffer.push(textNode(mark));
        out.push(quoteEl(buffer, authorId));
        buffer = null;
        expectedClose = null;
      };

      const flushUnclosed = () => {
        if (buffer) {
          // If the line ended without a closer, just emit what we collected as normal content.
          out.push(...buffer);
          buffer = null;
          expectedClose = null;
        }
      };

      const findNext = (s: string, from: number, chars: Set<string>): number => {
        for (let i = from; i < s.length; i += 1) {
          if (chars.has(s[i])) return i;
        }
        return -1;
      };

      const handleText = (value: string) => {
        let i = 0;
        while (i < value.length) {
          if (!buffer) {
            // Not currently inside a quote: look for an opener
            const pos = findNext(value, i, OPENERS);
            if (pos === -1) {
              push(textNode(value.slice(i)));
              break;
            }
            if (pos > i) push(textNode(value.slice(i, pos)));
            startQuote(value[pos]);
            i = pos + 1;
          } else if (expectedClose) {
            // Inside a quote: look for the matching closer
            const closeChar = expectedClose;
            const pos = value.indexOf(closeChar, i);
            if (pos === -1) {
              buffer.push(textNode(value.slice(i)));
              break;
            }
            if (pos > i) buffer.push(textNode(value.slice(i, pos)));
            endQuote(value[pos]);
            i = pos + 1;
          }
        }
      };

      for (const child of node.children) {
        if (child.type === "text") {
          handleText(child.value);
        } else {
          // Keep inline elements (e.g., <em>) inside the quote if we're in one
          push(child);
        }
      }

      flushUnclosed();
      node.children = out;
    });
  };
};
