import { describe, expect, it } from "vitest";
import { renderTextTemplate } from "./jinja.js";

describe("renderTextTemplate", () => {
  const baseMessages = [
    { role: "system" as const, content: "System priming" },
    { role: "user" as const, content: "Tell me a story" },
  ];

  it("renders simple interpolations with messages", async () => {
    const template = "{{ messages[0]['content'] }} -> {{ 'prefill' if prefix else 'new' }}";

    const result = await renderTextTemplate(template, {
      messages: baseMessages,
      prefix: false,
    });

    expect(result.trim()).toBe("System priming -> new");
  });

  it("disables add_generation_prompt when prefix is true", async () => {
    const template = "{% if add_generation_prompt %}fresh{% else %}prefill{% endif %}";

    const fresh = await renderTextTemplate(template, {
      messages: baseMessages,
      prefix: false,
    });
    const prefilled = await renderTextTemplate(template, {
      messages: baseMessages,
      prefix: true,
    });

    expect(fresh).toBe("fresh");
    expect(prefilled).toBe("prefill");
  });

  it("handles a transformers-compatible chat template", async () => {
    const template = `{%- for message in messages -%}\n  {%- if loop.first and messages[0]['role'] != 'system' -%}\n    <|im_system|>system<|im_middle|>You are an assistant.<|im_end|>\n  {%- endif -%}\n  <|im_{{ message['role'] }}|>{{ message.get('name') or message['role'] }}<|im_middle|>{{ message['content'] }}<|im_end|>\n{%- endfor -%}{%- if add_generation_prompt -%}\n  <|im_assistant|>assistant<|im_middle|>\n{%- endif -%}`;

    const rendered = await renderTextTemplate(template, {
      messages: baseMessages,
      prefix: false,
    });

    expect(rendered).toContain("<|im_user|>user<|im_middle|>Tell me a story");
    expect(rendered).toContain("<|im_assistant|>assistant<|im_middle|>");
  });
});
