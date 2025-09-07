import { describe, expect, it } from "vitest";
import { applyTransforms, type ResponseTransform } from "./response-transformer.js";

describe("Response Transformer", () => {
  describe("applyTransforms", () => {
    it("should return text unchanged when no transforms provided", () => {
      const text = "Hello world";
      expect(applyTransforms(text, [])).toBe(text);
      expect(applyTransforms(text, undefined)).toBe(text);
    });

    it("should handle empty text", () => {
      const transforms: ResponseTransform[] = [
        { type: "regexReplace", pattern: "test", replace: "replaced" },
      ];
      expect(applyTransforms("", transforms)).toBe("");
    });

    it("should apply multiple transforms in sequence", () => {
      const text = "The answer is: 42. That's the answer.";
      const transforms: ResponseTransform[] = [
        { type: "regexExtract", pattern: "answer is: (\\d+)", group: 1 }, // Extract "42"
        { type: "regexReplace", pattern: "4", replace: "four", flags: "g" }, // "four2"
      ];
      expect(applyTransforms(text, transforms)).toBe("four2");
    });

    it("should handle unknown transform types gracefully", () => {
      const text = "Hello world";
      const badTransform = { type: "unknown", pattern: "test" } as any;
      expect(applyTransforms(text, [badTransform])).toBe(text);
    });
  });

  describe("regexExtract transform", () => {
    it("should extract entire match by default (group 0)", () => {
      const text = "The result is: SUCCESS";
      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "result is: (\\w+)",
      };
      expect(applyTransforms(text, [transform])).toBe("result is: SUCCESS");
    });

    it("should extract specific capture group", () => {
      const text = "The result is: SUCCESS";
      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "result is: (\\w+)",
        group: 1,
      };
      expect(applyTransforms(text, [transform])).toBe("SUCCESS");
    });

    it("should handle multiple capture groups", () => {
      const text = "User: john, Age: 25, Role: admin";
      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "User: (\\w+), Age: (\\d+), Role: (\\w+)",
        group: 2, // Age
      };
      expect(applyTransforms(text, [transform])).toBe("25");
    });

    it("should use flags properly", () => {
      const text = "Hello WORLD";
      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "hello (\\w+)",
        flags: "i", // Case insensitive
        group: 1,
      };
      expect(applyTransforms(text, [transform])).toBe("WORLD");
    });

    it("should handle multiline text with 'm' flag", () => {
      const text = "Line 1\nResult: SUCCESS\nLine 3";
      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "^Result: (\\w+)$",
        flags: "m",
        group: 1,
      };
      expect(applyTransforms(text, [transform])).toBe("SUCCESS");
    });

    it("should return unchanged text when no match found", () => {
      const text = "Nothing matches here";
      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "nonexistent",
      };
      expect(applyTransforms(text, [transform])).toBe(text);
    });

    it("should return unchanged text when group doesn't exist", () => {
      const text = "Match this";
      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "(\\w+) (\\w+)",
        group: 5, // Group 5 doesn't exist
      };
      expect(applyTransforms(text, [transform])).toBe(text);
    });

    it("should handle invalid regex gracefully", () => {
      const text = "Test text";
      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "[invalid regex",
      };
      expect(applyTransforms(text, [transform])).toBe(text);
    });

    it("should extract JSON from mixed text", () => {
      const text = 'Here is the result: {"name": "test", "value": 42} and more text.';
      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "\\{[^{}]*\\}",
      };
      expect(applyTransforms(text, [transform])).toBe('{"name": "test", "value": 42}');
    });

    it("should handle Unicode characters", () => {
      const text = "Message: 你好世界 (Hello World)";
      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "Message: ([\\u4e00-\\u9fff]+)",
        group: 1,
      };
      expect(applyTransforms(text, [transform])).toBe("你好世界");
    });
  });

  describe("regexReplace transform", () => {
    it("should perform simple replacement", () => {
      const text = "Hello world";
      const transform: ResponseTransform = {
        type: "regexReplace",
        pattern: "world",
        replace: "universe",
      };
      expect(applyTransforms(text, [transform])).toBe("Hello universe");
    });

    it("should perform global replacement with 'g' flag", () => {
      const text = "foo bar foo baz";
      const transform: ResponseTransform = {
        type: "regexReplace",
        pattern: "foo",
        replace: "qux",
        flags: "g",
      };
      expect(applyTransforms(text, [transform])).toBe("qux bar qux baz");
    });

    it("should perform case-insensitive replacement with 'i' flag", () => {
      const text = "Hello HELLO hello";
      const transform: ResponseTransform = {
        type: "regexReplace",
        pattern: "hello",
        replace: "hi",
        flags: "gi",
      };
      expect(applyTransforms(text, [transform])).toBe("hi hi hi");
    });

    it("should handle backreferences in replacement", () => {
      const text = "John Doe";
      const transform: ResponseTransform = {
        type: "regexReplace",
        pattern: "(\\w+) (\\w+)",
        replace: "$2, $1",
      };
      expect(applyTransforms(text, [transform])).toBe("Doe, John");
    });

    it("should handle multiple backreferences", () => {
      const text = "The year is 2024 and month is 12";
      const transform: ResponseTransform = {
        type: "regexReplace",
        pattern: "year is (\\d+) and month is (\\d+)",
        replace: "date: $1-$2",
      };
      expect(applyTransforms(text, [transform])).toBe("The date: 2024-12");
    });

    it("should return unchanged text when no match found", () => {
      const text = "Nothing matches here";
      const transform: ResponseTransform = {
        type: "regexReplace",
        pattern: "nonexistent",
        replace: "replaced",
      };
      expect(applyTransforms(text, [transform])).toBe(text);
    });

    it("should handle invalid regex gracefully", () => {
      const text = "Test text";
      const transform: ResponseTransform = {
        type: "regexReplace",
        pattern: "[invalid regex",
        replace: "replacement",
      };
      expect(applyTransforms(text, [transform])).toBe(text);
    });

    it("should handle special replacement characters", () => {
      const text = "Hello world";
      const transform: ResponseTransform = {
        type: "regexReplace",
        pattern: "world",
        replace: "$& $&", // $& is the matched text
      };
      expect(applyTransforms(text, [transform])).toBe("Hello world world");
    });

    it("should handle empty replacement string", () => {
      const text = "Remove this text completely";
      const transform: ResponseTransform = {
        type: "regexReplace",
        pattern: " text",
        replace: "",
        flags: "g",
      };
      expect(applyTransforms(text, [transform])).toBe("Remove this completely");
    });

    it("should handle multiline replacement with 'm' flag", () => {
      const text = "Line 1\nLine 2\nLine 3";
      const transform: ResponseTransform = {
        type: "regexReplace",
        pattern: "^Line",
        replace: "Row",
        flags: "gm",
      };
      expect(applyTransforms(text, [transform])).toBe("Row 1\nRow 2\nRow 3");
    });
  });

  describe("complex scenarios", () => {
    it("should chain extract then replace transforms", () => {
      const text = 'Response: {"status": "success", "data": "important info"}';
      const transforms: ResponseTransform[] = [
        {
          type: "regexExtract",
          pattern: "\\{[\\s\\S]*\\}",
        },
        {
          type: "regexReplace",
          pattern: '"([^"]+)":\\s*"([^"]+)"',
          replace: "$1=$2",
          flags: "g",
        },
      ];
      expect(applyTransforms(text, transforms)).toBe("{status=success, data=important info}");
    });

    it("should handle transforms on empty extracted result", () => {
      const text = "No JSON here";
      const transforms: ResponseTransform[] = [
        {
          type: "regexExtract",
          pattern: "\\{[\\s\\S]*\\}",
        },
        {
          type: "regexReplace",
          pattern: "test",
          replace: "replaced",
        },
      ];
      expect(applyTransforms(text, transforms)).toBe("No JSON here");
    });

    it("should handle error in middle of transform chain", () => {
      const text = "Start text";
      const transforms: ResponseTransform[] = [
        {
          type: "regexReplace",
          pattern: "Start",
          replace: "Modified",
        },
        {
          type: "regexExtract",
          pattern: "[invalid regex",
        },
        {
          type: "regexReplace",
          pattern: "Modified",
          replace: "Final",
        },
      ];
      // Should apply first transform, fail on second (return unchanged), then apply third
      expect(applyTransforms(text, transforms)).toBe("Final text");
    });

    it("should handle complex nested JSON extraction", () => {
      const text = `Here's the response:
        {
          "result": {
            "plan": ["step1", "step2"],
            "confidence": 0.95
          }
        }
        End of response.`;

      const transform: ResponseTransform = {
        type: "regexExtract",
        pattern: "\\{[\\s\\S]*\\}",
        flags: "m",
      };

      const result = applyTransforms(text, [transform]);
      expect(result).toContain('"plan"');
      expect(result).toContain('"confidence"');
      expect(result).not.toContain("Here's the response");
      expect(result).not.toContain("End of response");
    });

    it("should validate transform chaining preserves determinism", () => {
      const text = "Test input for determinism";
      const transforms: ResponseTransform[] = [
        {
          type: "regexReplace",
          pattern: "input",
          replace: "data",
        },
        {
          type: "regexExtract",
          pattern: "Test (\\w+) for",
          group: 1,
        },
      ];

      const result1 = applyTransforms(text, transforms);
      const result2 = applyTransforms(text, transforms);
      expect(result1).toBe(result2);
      expect(result1).toBe("data");
    });
  });
});
