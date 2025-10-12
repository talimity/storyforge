import type { Element, ElementContent, Properties, Root, Text } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export interface DialogueOptions {
  authorId?: string | null;
}

function createText(value: string): Text {
  return { type: "text", value };
}

function createQuote(value: string, authorId: string | null): Element {
  const properties: Properties = authorId ? { "data-author": authorId } : {};
  return {
    type: "element",
    tagName: "q",
    properties,
    children: [createText(value)],
  };
}

const pattern = /“([^”\r\n]+)”|"([^"\r\n]+)"/g;

export const rehypeDialogue: Plugin<[DialogueOptions?], Root> = (options) => {
  const authorId = options?.authorId ?? null;

  return (tree) => {
    visit(tree, "element", (node, _index, parent) => {
      if (!parent) {
        return;
      }
      if (node.tagName !== "p") {
        return;
      }

      const newChildren: ElementContent[] = [];
      for (const child of node.children) {
        if (child.type !== "text") {
          newChildren.push(child);
          continue;
        }

        const value = child.value;
        if (value.length === 0) {
          newChildren.push(child);
          continue;
        }

        pattern.lastIndex = 0;
        let lastIndex = 0;
        let match = pattern.exec(value);
        while (match) {
          const start = match.index;
          if (start > lastIndex) {
            newChildren.push(createText(value.slice(lastIndex, start)));
          }

          // FULL MATCH includes the quote characters
          const withMarks = match[0];
          newChildren.push(createQuote(withMarks, authorId));

          lastIndex = pattern.lastIndex;
          match = pattern.exec(value);
        }

        if (lastIndex < value.length) {
          const remainder = value.slice(lastIndex);
          newChildren.push(createText(remainder));
        }
      }

      node.children = newChildren;
    });
  };
};
