import type { Element, ElementContent, Properties, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

function isBreak(node: ElementContent): node is Element {
  return node.type === "element" && node.tagName === "br";
}

function hasMeaningfulContent(nodes: ElementContent[]): boolean {
  for (const node of nodes) {
    if (node.type === "text") {
      if (node.value.trim().length > 0) {
        return true;
      }
      continue;
    }

    if (node.type === "element" && node.tagName === "br") {
      continue;
    }

    return true;
  }

  return false;
}

function trimSegment(nodes: ElementContent[]): ElementContent[] {
  trimLeadingWhitespace(nodes);
  trimTrailingWhitespace(nodes);
  return nodes;
}

function trimLeadingWhitespace(nodes: ElementContent[]): void {
  while (nodes.length > 0) {
    const first = nodes[0];
    if (first.type !== "text") {
      return;
    }

    const trimmed = first.value.replace(/^\s+/, "");
    if (trimmed.length === 0) {
      nodes.shift();
      continue;
    }

    first.value = trimmed;
    return;
  }
}

function trimTrailingWhitespace(nodes: ElementContent[]): void {
  while (nodes.length > 0) {
    const lastIndex = nodes.length - 1;
    const last = nodes[lastIndex];
    if (last.type !== "text") {
      return;
    }

    const trimmed = last.value.replace(/\s+$/, "");
    if (trimmed.length === 0) {
      nodes.pop();
      continue;
    }

    last.value = trimmed;
    return;
  }
}

function cloneProperties(properties: Properties | undefined): Properties {
  const clone: Properties = {};
  if (!properties) {
    return clone;
  }

  for (const key of Object.keys(properties)) {
    clone[key] = properties[key];
  }
  return clone;
}

export const rehypeSoftBreakParagraphs: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (!parent) {
        return;
      }

      if (node.tagName !== "p") {
        return;
      }

      if (typeof index !== "number") {
        return;
      }

      const segments: ElementContent[][] = [];
      let current: ElementContent[] = [];

      for (const child of node.children) {
        if (isBreak(child)) {
          segments.push(current);
          current = [];
          continue;
        }

        current.push(child);
      }

      segments.push(current);

      const trimmedSegments = segments
        .map((segment) => trimSegment(segment))
        .filter((segment) => hasMeaningfulContent(segment));

      if (trimmedSegments.length <= 1) {
        return;
      }

      node.children = trimmedSegments[0];

      const additional: Element[] = [];
      for (let segmentIndex = 1; segmentIndex < trimmedSegments.length; segmentIndex += 1) {
        const newNode: Element = {
          type: "element",
          tagName: "p",
          children: trimmedSegments[segmentIndex],
          properties: cloneProperties(node.properties),
        };
        additional.push(newNode);
      }

      parent.children.splice(index + 1, 0, ...additional);
    });
  };
};
