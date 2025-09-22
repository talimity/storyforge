import { Template } from "@huggingface/jinja";
import type { ChatCompletionMessage } from "../types.js";

export type TextTemplateInput = {
  messages: ChatCompletionMessage[];
  /**
   * When true, the template should treat the last assistant message as
   * prefetched content rather than starting a new turn.
   */
  prefix?: boolean;
};

export async function renderTextTemplate(
  template: string,
  input: TextTemplateInput
): Promise<string> {
  const compiled = new Template(template);
  return compiled.render({
    messages: input.messages,
    prefix: Boolean(input.prefix),
    add_generation_prompt: !input.prefix,
  });
}
