import { describe, expect, it } from "vitest";
import { compileTemplate } from "./compiler.js";
import { AuthoringValidationError, TemplateStructureError } from "./errors.js";
import type { CompiledMessageBlock, CompiledSlotFrameNode } from "./types.js";

describe("compileTemplate", () => {
  const isCompiledFrameMessage = (node: CompiledSlotFrameNode): node is CompiledMessageBlock =>
    !("kind" in node && node.kind === "anchor");

  const sampleTemplate = {
    id: "test_template",
    name: "Test Template",
    task: "turn_generation",
    version: 1,
    layout: [
      { kind: "message", role: "system", content: "Hello {{name}}" },
      { kind: "slot", name: "content" },
    ],
    slots: {
      content: {
        meta: {},
        priority: 0,
        plan: [
          { kind: "message", role: "user", content: "User: {{user.message}}" },
          {
            kind: "forEach",
            source: { source: "items" },
            map: [
              {
                kind: "message",
                role: "assistant",
                content: "Item: {{item.name}}",
              },
            ],
          },
          {
            kind: "if",
            when: { type: "exists", ref: { source: "condition" } },
            then: [
              {
                kind: "message",
                role: "user",
                content: "Then: {{then.value}}",
              },
            ],
            else: [
              {
                kind: "message",
                role: "user",
                content: "Else: {{fallback.value}}",
              },
            ],
          },
        ],
      },
    },
  };

  describe("basic compilation", () => {
    it("should compile a valid template successfully", () => {
      const compiled = compileTemplate(sampleTemplate);

      expect(compiled.id).toBe("test_template");
      expect(compiled.task).toBe("turn_generation");
      expect(compiled.name).toBe("Test Template");
      expect(compiled.version).toBe(1);
    });

    it("should parse JSON input", () => {
      const compiled = compileTemplate(structuredClone(sampleTemplate));
      expect(compiled.id).toBe("test_template");
    });

    it("should compile leaf strings to functions", () => {
      const compiled = compileTemplate(sampleTemplate);

      // Check layout message content is compiled
      const systemMessage = compiled.layout[0];
      expect(systemMessage.kind).toBe("message");
      if (systemMessage.kind === "message") {
        expect(typeof systemMessage.content).toBe("function");
        expect(systemMessage.content!({ name: "Alice" })).toBe("Hello Alice");
      }
    });

    it("should compile plan node content", () => {
      const compiled = compileTemplate(sampleTemplate);
      const slot = compiled.slots.content;

      // Check message plan node
      const messageNode = slot.plan[0];
      expect(messageNode.kind).toBe("message");
      if (messageNode.kind === "message") {
        expect(typeof messageNode.content).toBe("function");
        expect(messageNode.content!({ user: { message: "Hello" } })).toBe("User: Hello");
      }

      // Check forEach map content
      const forEachNode = slot.plan[1];
      expect(forEachNode.kind).toBe("forEach");
      if (forEachNode.kind === "forEach") {
        const mapNode = forEachNode.map[0];
        if (mapNode.kind === "message") {
          expect(typeof mapNode.content).toBe("function");
          expect(mapNode.content!({ item: { name: "Test" } })).toBe("Item: Test");
        }
      }

      // Check if node content
      const ifNode = slot.plan[2];
      expect(ifNode.kind).toBe("if");
      if (ifNode.kind === "if") {
        const thenNode = ifNode.then[0];
        if (thenNode.kind === "message") {
          expect(typeof thenNode.content).toBe("function");
          expect(thenNode.content!({ then: { value: "yes" } })).toBe("Then: yes");
        }

        const elseNode = ifNode.else![0];
        if (elseNode.kind === "message") {
          expect(typeof elseNode.content).toBe("function");
          expect(elseNode.content!({ fallback: { value: "no" } })).toBe("Else: no");
        }
      }
    });
  });

  describe("immutability", () => {
    it("should make the compiled template deeply frozen", () => {
      const compiled = compileTemplate(sampleTemplate);

      // Test top-level immutability
      expect(Object.isFrozen(compiled)).toBe(true);
      expect(Object.isFrozen(compiled.layout)).toBe(true);
      expect(Object.isFrozen(compiled.slots)).toBe(true);

      // Test nested immutability
      expect(Object.isFrozen(compiled.layout[0])).toBe(true);
      expect(Object.isFrozen(compiled.slots.content)).toBe(true);
      expect(Object.isFrozen(compiled.slots.content.plan)).toBe(true);
      expect(Object.isFrozen(compiled.slots.content.plan[0])).toBe(true);

      // Test mutation attempts
      expect(() => {
        // @ts-expect-error: Testing immutability
        compiled.id = "changed";
      }).toThrow();

      expect(() => {
        // @ts-expect-error: Testing immutability
        compiled.layout.push({} as any);
      }).toThrow();

      expect(() => {
        // @ts-expect-error: Testing immutability
        compiled.slots.content.priority = 999;
      }).toThrow();
    });
  });

  describe("validation", () => {
    it("should throw for invalid template structure", () => {
      const invalidTemplate: unknown = {
        ...sampleTemplate,
        layout: [{ kind: "slot", name: "nonexistent_slot" }],
      };

      expect(() => compileTemplate(invalidTemplate)).toThrow(TemplateStructureError);
    });

    it("should throw for unknown source names when allowedSources provided", () => {
      const options = {
        allowedSources: ["items"], // Only allow "items", not "condition"
      };

      expect(() => compileTemplate(sampleTemplate, options)).toThrow(AuthoringValidationError);
      expect(() => compileTemplate(sampleTemplate, options)).toThrow(
        "Unknown source names found: condition"
      );
    });

    it("should pass when all sources are allowed", () => {
      const options = {
        allowedSources: ["items", "condition"],
      };

      const simpleTemplate = {
        id: "simple",
        name: "Simple",
        task: "turn_generation",
        version: 1,
        layout: [],
        slots: {
          test: {
            meta: {},
            priority: 0,
            plan: [
              {
                kind: "forEach",
                source: { source: "items" },
                map: [{ kind: "message", role: "user", content: "test" }],
              },
            ],
          },
        },
      };

      expect(() => compileTemplate(simpleTemplate, options)).not.toThrow();
    });

    it("should use task-specific source validation", () => {
      const options = {
        kind: "turn_generation",
        allowedSources: ["items", "condition"],
      };

      const simpleTemplate = {
        id: "simple",
        name: "Simple",
        task: "turn_generation",
        version: 1,
        layout: [],
        slots: {
          test: {
            meta: {},
            priority: 0,
            plan: [
              {
                kind: "forEach",
                source: { source: "items" },
                map: [{ kind: "message", role: "user", content: "test" }],
              },
            ],
          },
        },
      };

      expect(() => compileTemplate(simpleTemplate, options)).not.toThrow();

      // Should fail if using wrong source for task
      const invalidTemplate = {
        ...simpleTemplate,
        slots: {
          test: {
            meta: {},
            priority: 0,
            plan: [
              {
                kind: "forEach",
                source: { source: "chapters" }, // Wrong for turn_generation
                map: [{ kind: "message", role: "user", content: "test" }],
              },
            ],
          },
        },
      };

      expect(() => compileTemplate(invalidTemplate, options)).toThrow(AuthoringValidationError);
    });
  });

  describe("edge cases", () => {
    it("should handle templates with no content strings", () => {
      const noContentTemplate = {
        id: "no_content",
        name: "No Content",
        task: "turn_generation",
        version: 1,
        layout: [{ kind: "message", role: "system", from: { source: "systemPrompt" } }],
        slots: {
          test: {
            meta: {},
            priority: 0,
            plan: [{ kind: "message", role: "user", from: { source: "userInput" } }],
          },
        },
      };

      const compiled = compileTemplate(noContentTemplate);

      const systemMessage = compiled.layout[0];
      if (systemMessage.kind === "message") {
        expect(systemMessage.content).toBeUndefined();
      }
    });

    it("should handle message blocks in headers/footers", () => {
      const headerFooterTemplate = {
        id: "header_footer",
        name: "Header Footer",
        task: "turn_generation",
        version: 1,
        layout: [
          {
            kind: "slot",
            name: "content",
            header: [{ role: "system", content: "Header: {{title}}" }],
            footer: [
              { role: "user", content: "Footer 1: {{footer1}}" },
              { role: "user", content: "Footer 2: {{footer2}}" },
            ],
          },
        ],
        slots: {
          content: {
            meta: {},
            priority: 0,
            plan: [{ kind: "message", role: "user", content: "Content" }],
          },
        },
      };

      const compiled = compileTemplate(headerFooterTemplate);
      const slot = compiled.layout[0];

      if (slot.kind === "slot") {
        // Check single header, which will compile to an array with one item
        const header = slot.header;
        if (header) {
          expect(Array.isArray(header)).toBe(true);
          expect(header).toHaveLength(1);
          const headerMessage = header.find(isCompiledFrameMessage);
          expect(headerMessage).toBeDefined();
          expect(typeof headerMessage?.content).toBe("function");
          expect(headerMessage?.content?.({ title: "Test" })).toBe("Header: Test");
        }

        // Check footer array
        const footer = slot.footer;
        if (footer && Array.isArray(footer)) {
          const footerMessages = footer.filter(isCompiledFrameMessage);
          expect(footerMessages).toHaveLength(2);
          expect(typeof footerMessages[0].content).toBe("function");
          expect(footerMessages[0].content!({ footer1: "F1" })).toBe("Footer 1: F1");
          expect(typeof footerMessages[1].content).toBe("function");
          expect(footerMessages[1].content!({ footer2: "F2" })).toBe("Footer 2: F2");
        }
      }
    });

    it("should handle templates without optional fields", () => {
      const minimalTemplate = {
        id: "minimal",
        name: "Minimal",
        task: "turn_generation",
        version: 1,
        layout: [{ kind: "message", role: "system", content: "Hello" }],
        slots: {},
      };

      const compiled = compileTemplate(minimalTemplate);
      expect(Object.keys(compiled.slots)).toHaveLength(0);
    });
  });
});
