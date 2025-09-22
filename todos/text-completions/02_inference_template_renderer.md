# 02 — Jinja Template Renderer (Inference)

Goal: provide an isomorphic helper for rendering text‑completion prompts from chat messages using Jinja, so both adapters and the UI preview can rely on the same implementation.

## API

- Package: `@storyforge/inference`
- File (new): `packages/inference/src/template/jinja.ts`

```ts
import type { ChatCompletionMessage } from "../types.js";

export type TextTemplateInput = {
  messages: ChatCompletionMessage[];
  prefix?: boolean; // true when assistant continuation is desired
};

export async function renderTextTemplate(
  template: string,
  input: TextTemplateInput
): Promise<string>;
```

- Re‑export from `packages/inference/src/index.ts`.

## Implementation Notes

- Use `@huggingface/jinja` to compile and render. It’s isomorphic and already used widely for LLM prompt templating.
- Keep this helper minimal: no schema enforcement, no message mutation. The template receives the messages exactly as produced by the runner, plus a boolean `prefix`.
- Errors from the Jinja engine should be wrapped as `InferenceProviderError` by the calling adapter; the helper can throw native errors.

### Sketch

```ts
import { Jinja } from "@huggingface/jinja";

export async function renderTextTemplate(tpl: string, input: TextTemplateInput): Promise<string> {
  const j = new Jinja();
  const compiled = j.compile(tpl);
  // Keep the surface small and transparent for UI preview parity
  return compiled.render({
    messages: input.messages,
    prefix: Boolean(input.prefix),
  });
}
```

## Fixture template
Test against this template, sourced from https://huggingface.co/moonshotai/Kimi-K2-Instruct-0905/blob/main/chat_template.jinja.
```jinja2
{%- if tools -%}
  <|im_system|>tool_declare<|im_middle|>
  # Tools
  {{ tools | tojson }}<|im_end|>
{%- endif -%}
{%- for message in messages -%}
  {%- if loop.first and messages[0]['role'] != 'system' -%}
    <|im_system|>system<|im_middle|>You are Kimi, an AI assistant created by Moonshot AI.<|im_end|>
  {%- endif -%}
  
  {%- set role_name =  message.get('name') or  message['role'] -%}
  {%- if message['role'] == 'user' -%}
    <|im_user|>{{role_name}}<|im_middle|>
  {%- elif message['role'] == 'assistant' -%}
    <|im_assistant|>{{role_name}}<|im_middle|>
  {%- else -%}
    <|im_system|>{{role_name}}<|im_middle|>
  {%- endif -%}

  {%- if message['role'] == 'assistant' and message.get('tool_calls') -%}
    {%- if message['content'] -%}{{ message['content'] }}{%- endif -%}
    <|tool_calls_section_begin|>
    {%- for tool_call in message['tool_calls'] -%}
      {%- set formatted_id = tool_call['id'] -%}
      <|tool_call_begin|>{{ formatted_id }}<|tool_call_argument_begin|>{% if tool_call['function']['arguments'] is string %}{{ tool_call['function']['arguments'] }}{% else %}{{ tool_call['function']['arguments'] | tojson }}{% endif %}<|tool_call_end|>
    {%- endfor -%}
    <|tool_calls_section_end|>
  {%- elif message['role'] == 'tool' -%}
    ## Return of {{ message.tool_call_id }}
    {{ message['content'] }}
  {%- elif message['content'] is string -%}
    {{ message['content'] }}
  {%- elif message['content'] is not none -%}
    {% for content in message['content'] -%}
      {% if content['type'] == 'image' or 'image' in content or 'image_url' in content -%}
        <|media_start|>image<|media_content|><|media_pad|><|media_end|>
      {% else -%}
        {{ content['text'] }}
      {%- endif -%}
    {%- endfor -%}
  {%- endif -%}
  {% if (loop.last and add_generation_prompt) or not loop.last %}<|im_end|>{% endif %}
{%- endfor -%}
{%- if add_generation_prompt -%}
  <|im_assistant|>assistant<|im_middle|>
{%- endif -%}
```

The idea is that users should be able to paste standard @huggingface/transformers-compatbile templates distributed with popular open source models without having to write their own.

`add_generation_prompt` is how we control prefills. If the request needs to prefill/prefix the assistant's response, we want to set `add_generation_prompt` to `false` so that the template does not start a new message, instead allowing the model to continue the last message.  Otherwise, `add_generation_prompt` should default to true.


## Acceptance Checklist

- New helper compiles in both browser and node builds.
- Exported from `@storyforge/inference` entry point.
- Unit tests cover basic interpolation and the `prefix` toggle.

