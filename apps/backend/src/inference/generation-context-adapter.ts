import {
  GenerationContext,
  GenerationContextSectionRole,
  ChatCompletionRequest,
  ChatMessage,
} from "./providers/base-provider";

export class GenerationContextAdapter {
  static toChatCompletionRequest(context: GenerationContext): ChatCompletionRequest {
    return {
      messages: this.renderMessages(context),
      parameters: context.parameters,
      model: context.model,
    };
  }

  private static renderMessages(context: GenerationContext): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Sort sections by role priority: system -> reference -> history -> task
    const rolePriority: Record<GenerationContextSectionRole, number> = {
      system: 0,
      reference: 1,
      history: 2,
      task: 3,
    };
    const sortedSections = [...context.sections].sort((a, b) => {
      const aPriority = a.metadata?.role ? rolePriority[a.metadata.role] : 999;
      const bPriority = b.metadata?.role ? rolePriority[b.metadata.role] : 999;
      return aPriority - bPriority;
    });

    for (const section of sortedSections) {
      const role = this.mapSectionRole(section.metadata?.role);
      messages.push({
        role,
        content: section.content,
      });
    }

    // Ensure we have at least one user message for the API
    if (messages.length === 0 || !messages.some((m) => m.role === "user")) {
      messages.push({
        role: "user",
        content: "Please respond.",
      });
    }

    return messages;
  }

  private static mapSectionRole(
    role?: "system" | "reference" | "history" | "task"
  ): "system" | "user" | "assistant" {
    switch (role) {
      case "system":
        return "system";
      case "reference":
      case "history":
      case "task":
      default:
        return "user";
    }
  }
}