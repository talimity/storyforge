import type { ChatCompletionMessage } from "./types.js";

/**
 * Merge consecutive messages with the same role into a single message,
 * joining their content with the specified delimiter (default: newline).
 */
export function mergeConsecutiveRoles(
  messages: ChatCompletionMessage[],
  delimiter = "\n"
): ChatCompletionMessage[] {
  if (messages.length === 0) return [];

  const merged: ChatCompletionMessage[] = [];
  let currentMessage = messages[0];

  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === currentMessage.role) {
      currentMessage = {
        role: currentMessage.role,
        content: currentMessage.content + delimiter + msg.content,
      };
    } else {
      merged.push(currentMessage);
      currentMessage = msg;
    }
  }
  merged.push(currentMessage);

  return merged;
}
