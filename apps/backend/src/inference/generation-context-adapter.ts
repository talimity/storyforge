import type {
  ChatCompletionRequest,
  ChatMessage,
  GenerationContext,
  GenerationContextSectionRole,
} from "./providers/base-provider";

export const generationContextAdapter = {
  toChatCompletionRequest(context: GenerationContext): ChatCompletionRequest {
    return {
      messages: generationContextAdapter.renderMessages(context),
      parameters: context.parameters,
      model: context.model,
    };
  },

  renderMessages(context: GenerationContext): ChatMessage[] {
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
      const role = generationContextAdapter.mapSectionRole(
        section.metadata?.role
      );
      messages.push({
        role,
        content: section.content,
      });
    }

    // Ensure we have at least one user message for the API
    messages.push({
      role: "user",
      content: "Please respond.",
    });

    return messages;
  },

  mapSectionRole(
    role?: "system" | "reference" | "history" | "task"
  ): "system" | "user" | "assistant" {
    switch (role) {
      case "system":
        return "system";
      default:
        return "user";
    }
  },
};
