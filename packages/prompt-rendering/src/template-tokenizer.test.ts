import { describe, expect, it } from "vitest";
import { tokenizeTemplateString } from "./template-tokenizer.js";

describe("tokenizeTemplateString", () => {
  it("splits plain variables and text", () => {
    const result = tokenizeTemplateString("Hello {{name}}!");

    expect(result.segments).toEqual([
      { kind: "text", content: "Hello " },
      { kind: "variable", content: "{{name}}" },
      { kind: "text", content: "!" },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it("detects block start, else, and end", () => {
    const template = "{{#if condition}}Yes{{#else}}No{{#endif}}";
    const result = tokenizeTemplateString(template);

    expect(result.segments).toEqual([
      { kind: "blockStart", content: "{{#if condition}}", expression: "condition" },
      { kind: "text", content: "Yes" },
      { kind: "blockElse", content: "{{#else}}" },
      { kind: "text", content: "No" },
      { kind: "blockEnd", content: "{{#endif}}" },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it("treats unknown directives as variables", () => {
    const result = tokenizeTemplateString("{{#each items}}");

    expect(result.segments).toEqual([{ kind: "variable", content: "{{#each items}}" }]);
  });

  it("handles unterminated tags gracefully", () => {
    const result = tokenizeTemplateString("Start {{name");

    expect(result.segments).toEqual([
      { kind: "text", content: "Start " },
      { kind: "text", content: "{{name" },
    ]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("reports parser errors without losing segments", () => {
    const result = tokenizeTemplateString("{{#if true}} open");

    expect(result.segments).toEqual([
      { kind: "blockStart", content: "{{#if true}}", expression: "true" },
      { kind: "text", content: " open" },
    ]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].toLowerCase()).toContain("endif");
  });
});
