import { describe, expect, it } from "vitest";
import { compileLeafRich, parseTemplateString } from "./parser.js";

// Small helper to run and return both output + contentfulness
function run(tpl: string, scope: any = {}) {
  const fn = compileLeafRich(tpl);
  const out = fn(scope);
  return { out, hasVars: fn.hasVariables, contentful: fn.wasLastRenderContentful() };
}

describe("chevrotain-templating – parse errors", () => {
  it("reports unclosed if-blocks", () => {
    const r = parseTemplateString("Hello {{#if true}} world");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/endif/i);
  });

  it("handles stray endif as error", () => {
    const r = parseTemplateString("Text {{#endif}} tail");
    expect(r.ok).toBe(false);
  });
});

describe("interpolation", () => {
  it("basic var", () => {
    const { out, hasVars, contentful } = run("Hello {{name}}!", { name: "Avery" });
    expect(out).toBe("Hello Avery!");
    expect(hasVars).toBe(true);
    expect(contentful).toBe(true);
  });

  it("path with bracket index", () => {
    const { out } = run("{{arr[1]}}", { arr: [10, 20, 30] });
    expect(out).toBe("20");
  });

  it("unknown path renders empty", () => {
    const { out, contentful } = run("{{does.not.exist}}");
    expect(out).toBe("");
    expect(contentful).toBe(false);
  });

  it("globals fallback (via resolvePath rules) – still interpolates if present", () => {
    const { out } = run("G: {{globalsKey}}", { globals: { globalsKey: "OK" } });
    expect(out).toBe("G: OK");
  });
});

describe("if / else blocks", () => {
  it("then branch", () => {
    const { out } = run("{{#if true}}YES{{#else}}NO{{#endif}}");
    expect(out).toBe("YES");
  });

  it("else branch", () => {
    const { out } = run("{{#if false}}YES{{#else}}NO{{#endif}}");
    expect(out).toBe("NO");
  });

  it("no else and condition false yields empty", () => {
    const { out, contentful } = run("{{#if false}}X{{#endif}}");
    expect(out).toBe("");
    expect(contentful).toBe(false);
  });

  it("nested if with else", () => {
    const { out } = run("A{{#if true}}B{{#if false}}X{{#else}}C{{#endif}}D{{#endif}}E");
    expect(out).toBe("ABCDE");
  });

  it("interpolation inside branches", () => {
    const tpl = `{{#if actorType == 'character'}}Write for {{char}}{{#else}}Describe the scene{{#endif}}`;
    const { out } = run(tpl, { actorType: "character", char: "Avery" });
    expect(out).toBe("Write for Avery");
  });
});

describe("operators and precedence", () => {
  it("logical not", () => {
    const { out } = run("{{#if !false}}Y{{#else}}N{{#endif}}");
    expect(out).toBe("Y");
  });

  it("numeric comparisons", () => {
    expect(run("{{#if 3 < 10}}Y{{#endif}}").out).toBe("Y");
    expect(run("{{#if 3 >= 10}}Y{{#else}}N{{#endif}}").out).toBe("N");
  });

  it("equality / inequality on strings", () => {
    expect(run(`{{#if "a" == "a"}}Y{{#endif}}`).out).toBe("Y");
    expect(run(`{{#if 'a' != "a"}}Y{{#else}}N{{#endif}}`).out).toBe("N");
  });

  it("boolean precedence: && binds tighter than ||", () => {
    expect(run("{{#if false || true && false}}Y{{#else}}N{{#endif}}").out).toBe("N");
    expect(run("{{#if true || false && false}}Y{{#else}}N{{#endif}}").out).toBe("Y");
    expect(run("{{#if (false || true) && false}}Y{{#else}}N{{#endif}}").out).toBe("N");
  });

  it("unary + parens combo", () => {
    expect(run("{{#if !(false || false)}}Y{{#else}}N{{#endif}}").out).toBe("Y");
  });
});

describe("string literal escaping", () => {
  it("double-quoted with escapes", () => {
    const tpl = `{{#if "It\\"s \\"ok\\"" == "It\\"s \\"ok\\"" }}Y{{#endif}}`;
    expect(run(tpl).out).toBe("Y");
  });

  it("single-quoted with escaped single quote", () => {
    const tpl = `{{#if 'It\\'s ok' == "It's ok"}}Y{{#endif}}`;
    expect(run(tpl).out).toBe("Y");
  });
});

describe("flags: hasVariables / wasLastRenderContentful", () => {
  it("plain text hasVariables = false", () => {
    const { hasVars, contentful } = run("just text");
    expect(hasVars).toBe(false);
    expect(contentful).toBe(true); // "just text".trim() !== ""
  });

  it("only whitespace => not contentful", () => {
    const { contentful } = run("   \n  \t ");
    expect(contentful).toBe(false);
  });

  it("interpolation missing -> empty -> not contentful", () => {
    const { contentful } = run("{{missing}}");
    expect(contentful).toBe(false);
  });

  it("if false with else empty -> empty -> not contentful", () => {
    const { contentful } = run("{{#if false}}{{#endif}}");
    expect(contentful).toBe(false);
  });

  it("if true text -> contentful", () => {
    const { contentful } = run("{{#if true}}x{{#endif}}");
    expect(contentful).toBe(true);
  });
});

describe("numbers: negative and decimals", () => {
  it("negative numbers", () => {
    const { out } = run("{{#if -5 < 0}}Y{{#endif}}");
    expect(out).toBe("Y");
  });

  it("decimals", () => {
    const { out } = run("{{#if 3.14 > 3}}Y{{#endif}}");
    expect(out).toBe("Y");
  });
});

describe("realistic snippet", () => {
  it("actorType gate with name + array index", () => {
    const tpl = `
Title
{{#if actorType == 'character'}}
- Write for {{char}} (guest: {{guests[0]}})
{{#else}}
- Narrate
{{#endif}}
`;
    const scope = { actorType: "character", char: "Nova", guests: ["Kai"] };
    const { out } = run(tpl, scope);
    expect(out).toContain("Write for Nova (guest: Kai)");
    expect(out).not.toContain("- Narrate");
  });
});
