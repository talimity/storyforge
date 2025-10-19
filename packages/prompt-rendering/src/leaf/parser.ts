// Supports:
//   - Text outside tags
//   - Interpolations: {{ some.path[0].name }}
//   - Conditionals:  {{#if expr}} ... {{#else}} ... {{#endif}}
//   - Expressions: identifiers/paths, numbers, strings, true/false/null,
//                  !, &&, ||, ==, !=, <, <=, >, >=, parentheses

import {
  createToken,
  EmbeddedActionsParser,
  type IToken,
  Lexer,
  type TokenType,
  tokenMatcher,
} from "chevrotain";
import { resolvePath } from "../path-resolver.js";
import type { CompiledLeafFunction } from "../types.js";

/* ---------------------------------- TOKENS --------------------------------- */

// Delimiters & modes
const OpenTag = createToken({
  name: "OpenTag",
  pattern: /{{/,
  push_mode: "tag",
});
const CloseTag = createToken({
  name: "CloseTag",
  pattern: /}}/,
  pop_mode: true,
});

// Greedy TEXT: everything until the next '{{' (or EOF)
const Text = createToken({
  name: "Text",
  line_breaks: true,
  pattern: (text: string, startOffset: number) => {
    const next = text.indexOf("{{", startOffset);
    if (next === startOffset) return null; // let OpenTag match
    if (next === -1) {
      if (startOffset >= text.length) return null;
      return [text.slice(startOffset)];
    }
    return [text.slice(startOffset, next)];
  },
});

// Tag content keywords
const Hash = createToken({ name: "Hash", pattern: /#/ });
const If = createToken({ name: "If", pattern: /if\b/ });
const Else = createToken({ name: "Else", pattern: /else\b/ });
const EndIf = createToken({ name: "EndIf", pattern: /endif\b/ });

// Operators (order matters: longer first)
const And = createToken({ name: "And", pattern: /&&/ });
const Or = createToken({ name: "Or", pattern: /\|\|/ });
const Gte = createToken({ name: "Gte", pattern: />=/ });
const Lte = createToken({ name: "Lte", pattern: /<=/ });
const Eq = createToken({ name: "Eq", pattern: /==/ });
const Neq = createToken({ name: "Neq", pattern: /!=/ });
const Gt = createToken({ name: "Gt", pattern: />/ });
const Lt = createToken({ name: "Lt", pattern: /</ });
const Not = createToken({ name: "Not", pattern: /!/ });

// Punctuation
const LParen = createToken({ name: "LParen", pattern: /\(/ });
const RParen = createToken({ name: "RParen", pattern: /\)/ });
const Dot = createToken({ name: "Dot", pattern: /\./ });
const LBracket = createToken({ name: "LBracket", pattern: /\[/ });
const RBracket = createToken({ name: "RBracket", pattern: /]/ });

// Literals
const True = createToken({ name: "True", pattern: /true\b/ });
const False = createToken({ name: "False", pattern: /false\b/ });
const Null = createToken({ name: "Null", pattern: /null\b/ });
const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /-?(?:\d+(?:\.\d+)?)\b/,
});
// String literals (support both "..." and '...') using a category token.
const StringLiteral = createToken({ name: "StringLiteral", pattern: Lexer.NA });
const DQString = createToken({
  name: "DQString",
  pattern: /"(?:\\.|[^"\\])*"/,
  line_breaks: true,
  start_chars_hint: ['"'],
  categories: [StringLiteral],
});
const SQString = createToken({
  name: "SQString",
  pattern: /'(?:\\.|[^'\\])*'/,
  line_breaks: true,
  start_chars_hint: ["'"],
  categories: [StringLiteral],
});

// Idents (after keywords so they win precedence)
const Identifier = createToken({
  name: "Identifier",
  pattern: /[a-zA-Z_$][\w$]*/,
});

// Whitespace inside tags is skipped
const WS = createToken({
  name: "WS",
  pattern: /[ \t\r\n]+/,
  group: Lexer.SKIPPED,
});

const modes = {
  text: [OpenTag, Text], // OpenTag must be tried before Text
  tag: [
    WS,
    Hash,
    If,
    Else,
    EndIf,
    And,
    Or,
    Neq,
    Not,
    Eq,
    Gte,
    Lte,
    Gt,
    Lt,
    LParen,
    RParen,
    Dot,
    LBracket,
    RBracket,
    True,
    False,
    Null,
    NumberLiteral,
    StringLiteral,
    SQString,
    DQString,
    Identifier,
    CloseTag,
  ],
} satisfies Record<string, TokenType[]>;

const TemplateLexer = new Lexer({ modes, defaultMode: "text" });

const MAX_NESTED_EXPANSIONS = 5;

function findUnclosedIf(tokens: readonly IToken[]): IToken | undefined {
  const stack: IToken[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const current = tokens[i];
    if (!tokenMatcher(current, OpenTag)) {
      continue;
    }
    const next = tokens[i + 1];
    const third = tokens[i + 2];
    if (!next || !third || !tokenMatcher(next, Hash)) {
      continue;
    }
    if (tokenMatcher(third, If)) {
      stack.push(current);
      continue;
    }
    if (tokenMatcher(third, EndIf) && stack.length > 0) {
      stack.pop();
    }
  }

  // unmatched if
  return stack[0];
}

/* ----------------------------------- AST ----------------------------------- */

type Node = TextNode | InterpNode | IfNode;

type TextNode = { kind: "Text"; value: string };
type InterpNode = { kind: "Interp"; expr: Expr };
type IfNode = { kind: "If"; test: Expr; then: Node[]; else?: Node[] };

type Expr =
  | { kind: "Literal"; value: unknown }
  | { kind: "Path"; path: string }
  | { kind: "Unary"; op: "!"; arg: Expr }
  | {
      kind: "Binary";
      op: "&&" | "||" | "==" | "!=" | "<" | "<=" | ">" | ">=";
      left: Expr;
      right: Expr;
    };

/* ---------------------------------- PARSER --------------------------------- */

class TemplParser extends EmbeddedActionsParser {
  private isTag3(t0: TokenType, t1: TokenType, t2: TokenType): boolean {
    return (
      tokenMatcher(this.LA(1), t0) && tokenMatcher(this.LA(2), t1) && tokenMatcher(this.LA(3), t2)
    );
  }

  public template!: () => Node[];
  private item!: () => Node;
  private interpolation!: () => InterpNode;
  private ifBlock!: () => IfNode;

  private expr!: () => Expr;
  private orExpr!: () => Expr;
  private andExpr!: () => Expr;
  private eqExpr!: () => Expr;
  private relExpr!: () => Expr;
  private unaryExpr!: () => Expr;
  private primary!: () => Expr;
  private path!: () => string;

  constructor(tokens: TokenType[]) {
    super(tokens, { recoveryEnabled: true });

    /* ---- top-level template: (text | {{expr}} | {{#if..}} )* ---- */
    this.template = this.RULE("template", () => {
      const nodes: Node[] = [];
      this.MANY(() => {
        nodes.push(this.SUBRULE(this.item));
      });
      return nodes;
    });

    this.item = this.RULE("item", () => {
      return this.OR([
        {
          // {{#if ...}}
          GATE: () => this.isTag3(OpenTag, Hash, If),
          ALT: () => this.SUBRULE(this.ifBlock),
        },
        {
          // {{ expr }} (must not be a {{#...}} control tag)
          GATE: () => tokenMatcher(this.LA(1), OpenTag) && !tokenMatcher(this.LA(2), Hash),
          ALT: () => this.SUBRULE(this.interpolation),
        },
        {
          ALT: () => {
            const t = this.CONSUME(Text);
            return { kind: "Text", value: t.image };
          },
        },
      ]);
    });

    /* ---- {{ expr }} ---- */
    this.interpolation = this.RULE("interpolation", () => {
      this.CONSUME(OpenTag);
      const expr = this.SUBRULE(this.expr);
      this.CONSUME(CloseTag);
      return { kind: "Interp", expr } as const;
    });

    /* ---- {{#if expr}} ... ({{#else}} ...)? {{#endif}} ---- */
    this.ifBlock = this.RULE("ifBlock", () => {
      this.CONSUME(OpenTag);
      this.CONSUME(Hash);
      this.CONSUME(If);
      const test = this.SUBRULE(this.expr);
      this.CONSUME(CloseTag);

      const thenNodes: Node[] = [];
      this.MANY({
        // Stop when we see {{#else}} or {{#endif}}
        GATE: () => !this.isTag3(OpenTag, Hash, Else) && !this.isTag3(OpenTag, Hash, EndIf),
        DEF: () => {
          thenNodes.push(this.SUBRULE(this.item));
        },
      });

      let elseNodes: Node[] | undefined;
      this.OPTION({
        GATE: () => this.isTag3(OpenTag, Hash, Else),
        DEF: () => {
          this.CONSUME1(OpenTag);
          this.CONSUME1(Hash);
          this.CONSUME(Else);
          this.CONSUME1(CloseTag);
          elseNodes = [];
          this.MANY2({
            GATE: () => !this.isTag3(OpenTag, Hash, EndIf),
            DEF: () => {
              elseNodes?.push(this.SUBRULE2(this.item));
            },
          });
        },
      });

      this.CONSUME2(OpenTag);
      this.CONSUME2(Hash);
      this.CONSUME(EndIf);
      this.CONSUME2(CloseTag);

      return { kind: "If", test, then: thenNodes, else: elseNodes } as const;
    });

    /* ------------------- expression precedence ------------------- */

    this.expr = this.RULE("expr", () => this.SUBRULE(this.orExpr));

    this.orExpr = this.RULE("orExpr", () => {
      let left = this.SUBRULE(this.andExpr);
      this.MANY(() => {
        this.CONSUME(Or);
        const right = this.SUBRULE2(this.andExpr);
        left = { kind: "Binary", op: "||", left, right };
      });
      return left;
    });

    this.andExpr = this.RULE("andExpr", () => {
      let left = this.SUBRULE(this.eqExpr);
      this.MANY(() => {
        this.CONSUME(And);
        const right = this.SUBRULE2(this.eqExpr);
        left = { kind: "Binary", op: "&&", left, right };
      });
      return left;
    });

    this.eqExpr = this.RULE("eqExpr", () => {
      let left = this.SUBRULE(this.relExpr);
      this.MANY(() => {
        const op = this.OR([{ ALT: () => this.CONSUME(Eq) }, { ALT: () => this.CONSUME(Neq) }])
          .image as "==" | "!=";
        const right = this.SUBRULE2(this.relExpr);
        left = { kind: "Binary", op, left, right };
      });
      return left;
    });

    this.relExpr = this.RULE("relExpr", () => {
      let left = this.SUBRULE(this.unaryExpr);
      this.MANY(() => {
        const opTok = this.OR([
          { ALT: () => this.CONSUME(Lte) },
          { ALT: () => this.CONSUME(Gte) },
          { ALT: () => this.CONSUME(Lt) },
          { ALT: () => this.CONSUME(Gt) },
        ]);
        const right = this.SUBRULE2(this.unaryExpr);
        const op = opTok.image as "<=" | ">=" | "<" | ">";
        left = { kind: "Binary", op, left, right };
      });
      return left;
    });

    this.unaryExpr = this.RULE("unaryExpr", () => {
      return this.OR([
        {
          GATE: () => tokenMatcher(this.LA(1), Not),
          ALT: () => {
            this.CONSUME(Not);
            const arg = this.SUBRULE(this.unaryExpr);
            return { kind: "Unary", op: "!", arg };
          },
        },
        { ALT: () => this.SUBRULE(this.primary) },
      ]);
    });

    this.primary = this.RULE("primary", () => {
      return this.OR([
        {
          ALT: () => {
            this.CONSUME(LParen);
            const e = this.SUBRULE(this.expr);
            this.CONSUME(RParen);
            return e;
          },
        },
        {
          ALT: () => {
            const t = this.CONSUME(StringLiteral);
            return { kind: "Literal", value: unescapeString(t.image) };
          },
        },
        {
          ALT: () => {
            const t = this.CONSUME(NumberLiteral);
            return { kind: "Literal", value: +t.image };
          },
        },
        {
          ALT: () => {
            this.CONSUME(True);
            return { kind: "Literal", value: true };
          },
        },
        {
          ALT: () => {
            this.CONSUME(False);
            return { kind: "Literal", value: false };
          },
        },
        {
          ALT: () => {
            this.CONSUME(Null);
            return { kind: "Literal", value: null };
          },
        },
        {
          ALT: () => ({ kind: "Path", path: this.SUBRULE(this.path) }),
        },
      ]);
    });

    // path := Identifier (("." Identifier) | ("[" Number "]"))*
    this.path = this.RULE("path", () => {
      let p = this.CONSUME(Identifier).image;
      this.MANY(() => {
        this.OR([
          {
            ALT: () => {
              this.CONSUME(Dot);
              p += `.${this.CONSUME2(Identifier).image}`;
            },
          },
          {
            ALT: () => {
              this.CONSUME(LBracket);
              p += `[${this.CONSUME(NumberLiteral).image}]`;
              this.CONSUME(RBracket);
            },
          },
        ]);
      });
      return p;
    });

    this.performSelfAnalysis();
  }
}

const allTokens: TokenType[] = [
  // both modes
  OpenTag,
  CloseTag,
  Text,
  WS,
  Hash,
  If,
  Else,
  EndIf,
  And,
  Or,
  Not,
  Eq,
  Neq,
  Gte,
  Lte,
  Gt,
  Lt,
  LParen,
  RParen,
  Dot,
  LBracket,
  RBracket,
  True,
  False,
  Null,
  NumberLiteral,
  StringLiteral,
  SQString,
  DQString,
  Identifier,
];

const parserInstance = new TemplParser(allTokens);

/* -------------------------------- EVALUATOR -------------------------------- */

const nestedTemplateCache = new Map<string, Node[]>();

function deepEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a === "object" || typeof b === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function evalExpr(expr: Expr, scope: unknown): unknown {
  switch (expr.kind) {
    case "Literal":
      return expr.value;
    case "Path":
      return resolvePath(scope, expr.path);
    case "Unary": {
      const v = evalExpr(expr.arg, scope);
      return expr.op === "!" ? !truthy(v) : v;
    }
    case "Binary": {
      const l = evalExpr(expr.left, scope);
      const r = evalExpr(expr.right, scope);
      switch (expr.op) {
        case "&&":
          return truthy(l) && truthy(r);
        case "||":
          return truthy(l) || truthy(r);
        case "==":
          return deepEq(l, r);
        case "!=":
          return !deepEq(l, r);
        case "<":
          return typeof l === "number" && typeof r === "number" ? l < r : false;
        case "<=":
          return typeof l === "number" && typeof r === "number" ? l <= r : false;
        case ">":
          return typeof l === "number" && typeof r === "number" ? l > r : false;
        case ">=":
          return typeof l === "number" && typeof r === "number" ? l >= r : false;
      }
    }
  }
}

function truthy(v: unknown): boolean {
  return !!v;
}

function renderNodes(nodes: Node[], scope: unknown, depth: number): string {
  let out = "";
  for (const n of nodes) {
    switch (n.kind) {
      case "Text":
        out += n.value;
        break;
      case "Interp": {
        const v = evalExpr(n.expr, scope);
        if (v == null) break;
        if (typeof v === "string") {
          out += renderNestedString(v, scope, depth);
        } else {
          out += toStringSafe(v);
        }
        break;
      }
      case "If": {
        const t = evalExpr(n.test, scope);
        const branch = truthy(t) ? n.then : (n.else ?? []);
        out += renderNodes(branch, scope, depth);
        break;
      }
    }
  }
  return out;
}

function renderNestedString(value: string, scope: unknown, depth: number): string {
  if (!value.includes("{{")) {
    return value;
  }
  if (depth >= MAX_NESTED_EXPANSIONS) {
    return value;
  }
  return renderTemplateString(value, scope, depth + 1);
}

function renderTemplateString(template: string, scope: unknown, depth: number): string {
  const cached = nestedTemplateCache.get(template);
  let ast: Node[] | undefined = cached;
  if (!ast) {
    const parsed = parseTemplateString(template);
    if (!parsed.ok) {
      return template;
    }
    ast = parsed.ast;
    nestedTemplateCache.set(template, ast);
  }
  return renderNodes(ast, scope, depth);
}

function toStringSafe(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function unescapeString(lit: string): string {
  const q = lit[0];
  if ((q !== '"' && q !== "'") || lit[lit.length - 1] !== q) return lit;
  const body = lit.slice(1, -1);
  return body.replace(
    /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\\'"bfnrtv0]))/g,
    (_, uBrace, u4, x2, simple) => {
      if (uBrace) return String.fromCodePoint(parseInt(uBrace, 16));
      if (u4) return String.fromCharCode(parseInt(u4, 16));
      if (x2) return String.fromCharCode(parseInt(x2, 16));
      switch (simple) {
        case "\\":
          return "\\";
        case "'":
          return "'";
        case '"':
          return '"';
        case "b":
          return "\b";
        case "f":
          return "\f";
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        case "v":
          return "\v";
        case "0":
          return "\0";
        default:
          return simple;
      }
    }
  );
}

/* ------------------------ PUBLIC ENTRY POINTS ------------------------------ */

export type ParseResult = { ok: true; ast: Node[] } | { ok: false; errors: string[] };

export function parseTemplateString(input: string): ParseResult {
  const { tokens, errors: lexErrors } = TemplateLexer.tokenize(input);
  if (lexErrors.length) {
    return { ok: false, errors: lexErrors.map((e) => e.message) };
  }
  parserInstance.input = tokens;
  const ast = parserInstance.template();

  if (parserInstance.errors.length) {
    const unmatchedIf = findUnclosedIf(tokens);
    const mismatchMessage = unmatchedIf
      ? `Missing {{#endif}} for {{#if}} opened at line ${unmatchedIf.startLine ?? "?"}, column ${unmatchedIf.startColumn ?? "?"}`
      : undefined;
    const parseErrors = parserInstance.errors.map((e) => e.message);
    const messages = mismatchMessage ? [mismatchMessage, ...parseErrors] : parseErrors;
    return { ok: false, errors: messages };
  }
  return { ok: true, ast };
}

export function compileLeafRich(template: string): CompiledLeafFunction {
  const parsed = parseTemplateString(template);
  if (!parsed.ok) {
    return Object.assign((_scope: unknown) => template, {
      hasVariables: false,
      wasLastRenderContentful: () => true,
    });
  }

  const ast = parsed.ast;
  const hasVars = ast.some(
    (n) => n.kind !== "Text" // any {{..}} or {{#if..}}
  );

  let lastContentful = false;
  const fn = (scope: unknown) => {
    const s = renderNodes(ast, scope, 0);
    lastContentful = s.trim().length > 0;
    return s;
  };

  return Object.assign(fn, {
    hasVariables: hasVars,
    wasLastRenderContentful: () => lastContentful,
  });
}
