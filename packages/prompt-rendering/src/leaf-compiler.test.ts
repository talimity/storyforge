import { describe, expect, it } from "vitest";
import { compileLeaf } from "./leaf-compiler.js";

describe("compileLeaf", () => {
  describe("basic functionality", () => {
    it("should return static strings unchanged", () => {
      const compiled = compileLeaf("Hello world");
      expect(compiled({})).toBe("Hello world");
    });

    it("should handle empty strings", () => {
      const compiled = compileLeaf("");
      expect(compiled({})).toBe("");
    });

    it("should substitute simple variables", () => {
      const compiled = compileLeaf("Hello {{name}}");
      const scope = { name: "Alice" };
      expect(compiled(scope)).toBe("Hello Alice");
    });

    it("should substitute multiple variables", () => {
      const compiled = compileLeaf("{{greeting}} {{name}}, you have {{count}} messages");
      const scope = { greeting: "Hello", name: "Bob", count: 5 };
      expect(compiled(scope)).toBe("Hello Bob, you have 5 messages");
    });
  });

  describe("dotted path resolution", () => {
    it("should resolve nested object properties", () => {
      const compiled = compileLeaf("Author: {{item.author.name}}");
      const scope = {
        item: {
          author: {
            name: "Jane Doe",
          },
        },
      };
      expect(compiled(scope)).toBe("Author: Jane Doe");
    });

    it("should resolve multiple nested paths", () => {
      const compiled = compileLeaf("{{user.name}} said: {{message.content}}");
      const scope = {
        user: { name: "Alice" },
        message: { content: "Hello there!" },
      };
      expect(compiled(scope)).toBe("Alice said: Hello there!");
    });

    it("should handle deep nesting", () => {
      const compiled = compileLeaf("{{input.intent.action.type}}");
      const scope = {
        input: {
          intent: {
            action: {
              type: "speak",
            },
          },
        },
      };
      expect(compiled(scope)).toBe("speak");
    });
  });

  describe("nested / recursive expansion", () => {
    it("expands a nested variable inside a resolved string", () => {
      const compiled = compileLeaf("{{chara1}} says '{{messages[0]}}'");
      const scope = {
        chara1: "Alice",
        chara2: "Bob",
        messages: ["Hello {{chara2}}, my name is {{chara1}}"],
      };
      expect(compiled(scope)).toBe("Alice says 'Hello Bob, my name is Alice'");
    });

    it("expands multiple nested levels (A -> B -> C)", () => {
      const compiled = compileLeaf("Result: {{A}}");
      const scope = { A: "{{B}}", B: "{{C}}", C: "done" };
      expect(compiled(scope)).toBe("Result: done");
    });

    it("handles mixed literal + nested content in a single value", () => {
      const compiled = compileLeaf("Say: {{greeting}}");
      const scope = { greeting: "Hello {{name}}!", name: "Zoe" };
      expect(compiled(scope)).toBe("Say: Hello Zoe!");
    });

    it("expands nested with bracketed array index", () => {
      const compiled = compileLeaf("Msg: {{messages[0]}}");
      const scope = { name: "Kai", messages: ["Hi {{name}}"] };
      expect(compiled(scope)).toBe("Msg: Hi Kai");
    });

    it("expands nested variables alongside non-nested ones", () => {
      const compiled = compileLeaf("{{a}} and {{b}}");
      const scope = { a: "Hi {{name}}", b: "ok", name: "Bob" };
      expect(compiled(scope)).toBe("Hi Bob and ok");
    });

    it("does not expand mustaches inside arrays/objects (stringified only)", () => {
      const compiled = compileLeaf("Array: {{arr}} | Object: {{obj}}");
      const scope = {
        arr: ["Yay {{name}}"],
        obj: { t: "{{name}}" },
        name: "Nia",
      };
      // Arrays/objects are JSON stringified; nested mustaches are preserved
      expect(compiled(scope)).toBe('Array: ["Yay {{name}}"] | Object: {"t":"{{name}}"}');
    });

    it("is safe on direct self-reference (depth-limited, does not hang)", () => {
      const compiled = compileLeaf("Loop: {{loop}}");
      const scope = { loop: "{{loop}}" };
      const out = compiled(scope);
      expect(out).toBe("Loop: {{loop}}");
    });

    it("is safe on mutual recursion (depth-limited, does not hang)", () => {
      const compiled = compileLeaf("{{a}}");
      const scope = { a: "{{b}}", b: "{{a}}" };
      const out = compiled(scope);
      // Output should still be a single unresolved token due to depth cap
      expect(out).toBe("{{a}}");
    });

    it("handles deep but finite chains within the nesting limit", () => {
      const compiled = compileLeaf("Deep: {{v1}}");
      const scope: Record<string, string> = {
        v1: "{{v2}}",
        v2: "{{v3}}",
        v3: "{{v4}}",
        v4: "END",
      };
      expect(compiled(scope)).toBe("Deep: END");
    });

    it("caps very deep chains (does not hang; leaves some mustache unresolved)", () => {
      // Build a long chain: v1 -> v2 -> ... -> v20 -> "OK"
      const compiled = compileLeaf("{{v1}}");
      const scope: Record<string, string> = {};
      for (let i = 1; i < 20; i++) scope[`v${i}`] = `{{v${i + 1}}}`;
      scope.v20 = "OK";
      const out = compiled(scope);
      expect(out).toBe("{{v7}}"); // stops expanding after 5 recursions
    });

    it("propagates malformed inner braces without crashing", () => {
      const compiled = compileLeaf("{{outer}}");
      const scope = { inner: "{{incomplete", outer: "X {{inner}} Y" };
      // The inner value is malformed; it should pass through as-is
      expect(compiled(scope)).toBe("X {{incomplete Y");
    });

    it("does not mutate the provided scope during expansion", () => {
      const compiled = compileLeaf("{{greeting}} {{name}}");
      const scope = { greeting: "Hi {{name}}", name: "Lisa" };
      const before = JSON.parse(JSON.stringify(scope));
      const out = compiled(scope);
      expect(out).toBe("Hi Lisa Lisa"); // greeting expands using same scope
      expect(scope).toEqual(before); // scope unchanged
    });

    it("supports nested references mixed with dotted paths", () => {
      const compiled = compileLeaf("{{card.title}} — {{card.body}}");
      const scope = {
        card: {
          title: "Note to {{user.name}}",
          body: "Remember: {{reminder.text}}",
        },
        user: { name: "Sam" },
        reminder: { text: "buy milk" },
      };
      expect(compiled(scope)).toBe("Note to Sam — Remember: buy milk");
    });
  });

  describe("missing values", () => {
    it("should return empty string for undefined variables", () => {
      const compiled = compileLeaf("Hello {{missing}}");
      expect(compiled({})).toBe("Hello ");
    });

    it("should return empty string for null variables", () => {
      const compiled = compileLeaf("Hello {{name}}");
      const scope = { name: null };
      expect(compiled(scope)).toBe("Hello ");
    });

    it("should return empty string for undefined nested paths", () => {
      const compiled = compileLeaf("{{item.missing.path}}");
      const scope = { item: {} };
      expect(compiled(scope)).toBe("");
    });

    it("should handle partially missing paths", () => {
      const compiled = compileLeaf("{{user.profile.name}}");
      const scope = { user: {} };
      expect(compiled(scope)).toBe("");
    });

    it("should handle null in path resolution", () => {
      const compiled = compileLeaf("{{user.profile.name}}");
      const scope = { user: { profile: null } };
      expect(compiled(scope)).toBe("");
    });
  });

  describe("edge cases", () => {
    it("should handle variables with whitespace", () => {
      const compiled = compileLeaf("{{ name }} and {{ age }}");
      const scope = { name: "Alice", age: 30 };
      expect(compiled(scope)).toBe("Alice and 30");
    });

    it("should handle numbers and booleans", () => {
      const compiled = compileLeaf("Count: {{count}}, Active: {{active}}");
      const scope = { count: 42, active: true };
      expect(compiled(scope)).toBe("Count: 42, Active: true");
    });

    it("should handle zero values correctly", () => {
      const compiled = compileLeaf("Value: {{value}}");
      const scope = { value: 0 };
      expect(compiled(scope)).toBe("Value: 0");
    });

    it("should handle false values correctly", () => {
      const compiled = compileLeaf("Active: {{active}}");
      const scope = { active: false };
      expect(compiled(scope)).toBe("Active: false");
    });

    it("should handle empty string values", () => {
      const compiled = compileLeaf("Name: {{name}}");
      const scope = { name: "" };
      expect(compiled(scope)).toBe("Name: ");
    });

    it("should handle objects that aren't plain objects", () => {
      const compiled = compileLeaf("{{arr.length}}");
      const scope = { arr: [1, 2, 3] };
      expect(compiled(scope)).toBe("3");
    });

    it("should handle objects with toStringSafe", () => {
      const compiled = compileLeaf("{{obj}}");
      const scope = { obj: { name: "test", value: 42 } };
      expect(compiled(scope)).toBe('{"name":"test","value":42}');
    });

    it("should handle arrays with toStringSafe", () => {
      const compiled = compileLeaf("{{arr}}");
      const scope = { arr: [1, 2, 3] };
      expect(compiled(scope)).toBe("[1,2,3]");
    });

    it("should handle circular references gracefully", () => {
      const compiled = compileLeaf("{{circular}}");
      const circular: any = { name: "test" };
      circular.self = circular;
      const scope = { circular };
      expect(compiled(scope)).toBe("");
    });

    it("should handle primitive scope values gracefully", () => {
      const compiled = compileLeaf("{{missing}}");
      expect(compiled("not an object")).toBe("");
      expect(compiled(42)).toBe("");
      expect(compiled(null)).toBe("");
      expect(compiled(undefined)).toBe("");
    });
  });

  describe("bracketed path resolution", () => {
    it("should resolve simple array access", () => {
      const compiled = compileLeaf("{{items[0]}}");
      const scope = { items: ["first", "second", "third"] };
      expect(compiled(scope)).toBe("first");
    });

    it("should resolve multiple array indices", () => {
      const compiled = compileLeaf("{{items[0]}}, {{items[1]}}, {{items[2]}}");
      const scope = { items: ["a", "b", "c"] };
      expect(compiled(scope)).toBe("a, b, c");
    });

    it("should resolve nested array access", () => {
      const compiled = compileLeaf("{{matrix[0][1]}}");
      const scope = {
        matrix: [
          ["a", "b"],
          ["c", "d"],
        ],
      };
      expect(compiled(scope)).toBe("b");
    });

    it("should handle mixed dot and bracket notation", () => {
      const compiled = compileLeaf("{{data.items[0].name}}");
      const scope = {
        data: {
          items: [
            { name: "Item 1", id: 1 },
            { name: "Item 2", id: 2 },
          ],
        },
      };
      expect(compiled(scope)).toBe("Item 1");
    });

    it("should handle numeric string indices", () => {
      const compiled = compileLeaf("{{arr[2]}}");
      const scope = { arr: { "0": "zero", "1": "one", "2": "two" } };
      expect(compiled(scope)).toBe("two");
    });

    it("should return empty string for out-of-bounds array access", () => {
      const compiled = compileLeaf("{{items[10]}}");
      const scope = { items: ["a", "b", "c"] };
      expect(compiled(scope)).toBe("");
    });

    it("should handle malformed brackets gracefully", () => {
      const compiled = compileLeaf("{{items[missing}}");
      const scope = { items: ["a", "b", "c"] };
      expect(compiled(scope)).toBe("{{items[missing}}");
    });

    it("should handle complex paths with brackets", () => {
      const compiled = compileLeaf("{{examples[0].content}} by {{examples[0].author.name}}");
      const scope = {
        examples: [
          {
            content: "Hello world",
            author: { name: "Alice", id: 1 },
          },
          {
            content: "Goodbye",
            author: { name: "Bob", id: 2 },
          },
        ],
      };
      expect(compiled(scope)).toBe("Hello world by Alice");
    });
  });

  describe("template patterns", () => {
    it("should handle adjacent variables", () => {
      const compiled = compileLeaf("{{first}}{{second}}");
      const scope = { first: "Hello", second: "World" };
      expect(compiled(scope)).toBe("HelloWorld");
    });

    it("should handle variables at start and end", () => {
      const compiled = compileLeaf("{{start}} middle {{end}}");
      const scope = { start: "Begin", end: "Finish" };
      expect(compiled(scope)).toBe("Begin middle Finish");
    });

    it("should handle same variable used multiple times", () => {
      const compiled = compileLeaf("{{name}} loves {{name}}");
      const scope = { name: "Alice" };
      expect(compiled(scope)).toBe("Alice loves Alice");
    });

    it("should preserve braces that don't match pattern", () => {
      const compiled = compileLeaf("{ not a variable } and {{name}}");
      const scope = { name: "Alice" };
      expect(compiled(scope)).toBe("{ not a variable } and Alice");
    });

    it("should handle malformed braces gracefully", () => {
      const compiled = compileLeaf("{{incomplete and {{name}}");
      const scope = { name: "Alice" };
      expect(compiled(scope)).toBe("{{incomplete and {{name}}");
    });
  });
});
