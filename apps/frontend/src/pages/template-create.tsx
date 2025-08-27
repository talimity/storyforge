import { Container } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/prompt-renderer";
import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TemplateForm } from "@/components/features/templates/template-form";
import type {
  LayoutNodeDraft,
  SlotDraft,
} from "@/components/features/templates/types";
import { compileDraft } from "@/components/features/templates/utils/compile-draft";
import { createBlankTemplate } from "@/components/features/templates/utils/template-conversion";
import { trpc } from "@/lib/trpc";
import { showErrorToast, showSuccessToast } from "@/lib/utils/error-handling";

const validTaskTypes: TaskKind[] = [
  "turn_generation",
  "chapter_summarization",
  "writing_assistant",
];

export function TemplateCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskType = searchParams.get("type") as TaskKind | null;
  const utils = trpc.useUtils();

  // Redirect if no task type or invalid task type
  useEffect(() => {
    if (!taskType || !validTaskTypes.includes(taskType)) {
      navigate("/templates/select-task", { replace: true });
    }
  }, [taskType, navigate]);

  const createMutation = trpc.templates.create.useMutation({
    onSuccess: async ({ name }) => {
      showSuccessToast({
        title: "Template created",
        description: `New template "${name}" created.`,
      });
      await utils.templates.invalidate();
      navigate(`/templates`);
    },
  });

  const handleTemplateSubmit = (data: {
    metadata: {
      name: string;
      task: TaskKind;
      description?: string;
      responseFormat?:
        | "text"
        | "json"
        | { type: "json_schema"; schema: { [x: string]: unknown } }
        | undefined;
    };
    layoutDraft: LayoutNodeDraft[];
    slotsDraft: Record<string, SlotDraft>;
  }) => {
    if (!taskType) return;

    try {
      const draft = {
        id: `template_${Date.now()}`, // Temporary ID
        name: data.metadata.name,
        task: taskType,
        layoutDraft: data.layoutDraft,
        slotsDraft: data.slotsDraft,
      };

      const compiledTemplate = compileDraft(draft);

      createMutation.mutate({
        ...compiledTemplate,
        task: taskType,
        responseFormat: data.metadata.responseFormat,
        responseTransforms: [],
      });
    } catch (error) {
      showErrorToast({
        title: "Failed to create template",
        fallbackMessage: "An unknown error occurred.",
        error,
      });
    }
  };

  const handleCancel = () => {
    navigate("/templates");
  };

  // Generate initial draft based on task type - memoized to prevent recreation on every render
  const initialDraft = useMemo(() => {
    if (!taskType) {
      return createBlankTemplate("turn_generation");
    }
    return createBlankTemplate(taskType);
  }, [taskType]);

  // Don't render the form until we have a valid task type
  if (!taskType || !validTaskTypes.includes(taskType)) {
    return null;
  }

  return (
    <Container maxW="6xl">
      <TemplateForm
        initialDraft={initialDraft}
        onSubmit={handleTemplateSubmit}
        onCancel={handleCancel}
        isSubmitting={createMutation.isPending}
        submitLabel="Create Template"
        pageTitle="New Template"
        isEditMode={false}
      />
    </Container>
  );
}
