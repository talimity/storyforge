import { compileLeafRich } from "./leaf/parser.js";

// replaced old regex mustache string interpolation with chevrotain-based
// parser that supports expressions and {{#if}}...{{/if}} blocks

export const compileLeaf = compileLeafRich;
