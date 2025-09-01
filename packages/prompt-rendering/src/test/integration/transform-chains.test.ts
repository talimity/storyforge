import { describe, expect, it } from "vitest";
import {
  applyTransforms,
  type ResponseTransform,
} from "../../response-transformer.js";

describe("Response Transform Chains", () => {
  it("should apply regexExtract followed by regexReplace in order", () => {
    const transforms: ResponseTransform[] = [
      // First: extract JSON from mixed content
      {
        type: "regexExtract",
        pattern: "\\{[^{}]*\\}",
        flags: "g",
        group: 0,
      },
      // Second: replace quotes with smart quotes
      {
        type: "regexReplace",
        pattern: '"([^"]*)"',
        flags: "g",
        replace: "\u201c$1\u201d",
      },
    ];

    const input = `Here's some text before {"key": "value", "other": "data"} and after`;
    const result = applyTransforms(input, transforms);

    // Should first extract the JSON, then apply smart quotes
    expect(result).toBe(
      "{\u201ckey\u201d: \u201cvalue\u201d, \u201cother\u201d: \u201cdata\u201d}"
    );
  });

  it("should handle multiple regexExtract transforms", () => {
    const transforms: ResponseTransform[] = [
      // Extract content inside brackets
      {
        type: "regexExtract",
        pattern: "\\[([^\\]]+)\\]",
        group: 1,
      },
      // Then extract just the number from that content
      {
        type: "regexExtract",
        pattern: "(\\d+)",
        group: 1,
      },
    ];

    const input = "Some text [Turn 42 details] more text";
    const result = applyTransforms(input, transforms);

    // Should extract "Turn 42 details", then "42"
    expect(result).toBe("42");
  });

  it("should handle multiple regexReplace transforms", () => {
    const transforms: ResponseTransform[] = [
      // Replace straight quotes with curly
      {
        type: "regexReplace",
        pattern: '"',
        flags: "g",
        replace: "\u201c",
      },
      // Replace dashes with em dashes
      {
        type: "regexReplace",
        pattern: " - ",
        flags: "g",
        replace: " — ",
      },
      // Replace ellipsis
      {
        type: "regexReplace",
        pattern: "\\.\\.\\.",
        flags: "g",
        replace: "…",
      },
    ];

    const input = 'She said "Hello" - and then... silence.';
    const result = applyTransforms(input, transforms);

    expect(result).toBe("She said \u201cHello\u201c — and then… silence.");
  });

  it("should be robust to non-matching patterns", () => {
    const transforms: ResponseTransform[] = [
      // This won't match
      {
        type: "regexExtract",
        pattern: "NOMATCH",
        group: 0,
      },
      // This should still apply to the unchanged input
      {
        type: "regexReplace",
        pattern: "hello",
        flags: "gi",
        replace: "HELLO",
      },
    ];

    const input = "Hello world, hello there!";
    const result = applyTransforms(input, transforms);

    // First transform fails (no match), input unchanged
    // Second transform succeeds
    expect(result).toBe("HELLO world, HELLO there!");
  });

  it("should handle empty and edge case inputs", () => {
    const transforms: ResponseTransform[] = [
      {
        type: "regexExtract",
        pattern: "\\w+",
        group: 0,
      },
      {
        type: "regexReplace",
        pattern: "test",
        replace: "TEST",
      },
    ];

    // Empty string
    expect(applyTransforms("", transforms)).toBe("");

    // String with no matches
    expect(applyTransforms("!@#$%", transforms)).toBe("!@#$%");

    // String that matches first but not second transform
    expect(applyTransforms("hello", transforms)).toBe("hello");

    // String that matches both
    expect(applyTransforms("test", transforms)).toBe("TEST");
  });

  it("should handle complex JSON extraction and formatting", () => {
    // Simulate planner output that needs cleaning
    const transforms: ResponseTransform[] = [
      // Extract complete JSON object
      {
        type: "regexExtract",
        pattern: "\\{[\\s\\S]*\\}",
        flags: "m",
        group: 0,
      },
      // Clean up extra whitespace
      {
        type: "regexReplace",
        pattern: "\\s+",
        flags: "g",
        replace: " ",
      },
      // Fix trailing commas (common LLM issue)
      {
        type: "regexReplace",
        pattern: ",\\s*}",
        flags: "g",
        replace: "}",
      },
      {
        type: "regexReplace",
        pattern: ",\\s*]",
        flags: "g",
        replace: "]",
      },
    ];

    const messy_json = `
    Here's my analysis:
    
    {
      "goals": ["goal1", "goal2",],
      "beats": [
        "beat1",
        "beat2",
      ],
      "risks": ["risk1",]
    }
    
    That's the plan.`;

    const result = applyTransforms(messy_json, transforms);

    // Should extract and clean the JSON
    expect(result).toBe(
      '{ "goals": ["goal1", "goal2"], "beats": [ "beat1", "beat2"], "risks": ["risk1"] }'
    );

    // Result should be valid JSON
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.goals).toEqual(["goal1", "goal2"]);
    expect(parsed.beats).toEqual(["beat1", "beat2"]);
    expect(parsed.risks).toEqual(["risk1"]);
  });

  it("should handle capture groups in regexExtract", () => {
    const transforms: ResponseTransform[] = [
      // Extract content from markdown code block
      {
        type: "regexExtract",
        pattern: "```\\w*\\n([\\s\\S]*?)```",
        group: 1,
      },
      // Remove leading whitespace from each line
      {
        type: "regexReplace",
        pattern: "^\\s+",
        flags: "gm",
        replace: "",
      },
    ];

    const input = `Here's some code:

\`\`\`javascript
    function hello() {
        console.log("world");
    }
\`\`\`

Hope that helps!`;

    const result = applyTransforms(input, transforms);

    expect(result).toBe(`function hello() {
console.log("world");
}
`);
  });

  it("should handle invalid regex patterns gracefully", () => {
    const transforms: ResponseTransform[] = [
      // Invalid regex pattern
      {
        type: "regexExtract",
        pattern: "[invalid",
        group: 0,
      },
      // Valid transform that should still work
      {
        type: "regexReplace",
        pattern: "test",
        replace: "TEST",
      },
    ];

    const input = "This is a test string";

    // Should not throw, invalid regex should be ignored
    const result = applyTransforms(input, transforms);

    // Second transform should still apply
    expect(result).toBe("This is a TEST string");
  });

  it("should preserve original input on all transform failures", () => {
    const transforms: ResponseTransform[] = [
      {
        type: "regexExtract",
        pattern: "NOMATCH",
        group: 0,
      },
      {
        type: "regexReplace",
        pattern: "ALSONOMATCH",
        replace: "replacement",
      },
    ];

    const input = "Original input text";
    const result = applyTransforms(input, transforms);

    expect(result).toBe(input);
  });

  it("should work with the spec planner template transforms", () => {
    // Use the actual transforms from tpl_turn_planner_v1
    const transforms: ResponseTransform[] = [
      {
        type: "regexExtract",
        pattern: "\\{[\\s\\S]*\\}$",
        flags: "m",
        group: 0,
      },
    ];

    // Simulate typical LLM response for planning
    const plannerResponse = `I'll create a plan for this scene.

{
  "goals": ["Develop character relationships", "Advance the mystery plot"],
  "beats": ["Alice notices something unusual", "Bob shares his knowledge", "Charlie makes their presence known"],
  "risks": ["Revealing too much too soon", "Breaking the atmospheric tension"]
}

This plan should work well for the scene.`;

    const result = applyTransforms(plannerResponse, transforms);

    // Should extract just the JSON part
    const expectedJson = `{
  "goals": ["Develop character relationships", "Advance the mystery plot"],
  "beats": ["Alice notices something unusual", "Bob shares his knowledge", "Charlie makes their presence known"],
  "risks": ["Revealing too much too soon", "Breaking the atmospheric tension"]
}`;

    expect(result).toBe(expectedJson);

    // Should be valid JSON
    const parsed = JSON.parse(result);
    expect(parsed.goals).toHaveLength(2);
    expect(parsed.beats).toHaveLength(3);
    expect(parsed.risks).toHaveLength(2);
  });

  it("should handle transform chains with empty array", () => {
    const input = "Test input";
    const result = applyTransforms(input, []);

    expect(result).toBe(input);
  });
});
