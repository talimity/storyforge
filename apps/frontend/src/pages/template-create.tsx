import { Container } from "@chakra-ui/react";
import { type TaskKind, taskKindSchema } from "@storyforge/gentasks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TemplateForm } from "@/features/template-builder/components/template-form";
import { compileDraft } from "@/features/template-builder/services/compile-draft";
import { createBlankTemplate } from "@/features/template-builder/services/template-conversion";
import type { LayoutNodeDraft, SlotDraft } from "@/features/template-builder/types";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

export function TemplateCreatePage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskType = searchParams.get("type") as TaskKind | null;
  const queryClient = useQueryClient();

  // Redirect if no task type or invalid task type
  useEffect(() => {
    if (!taskType || !taskKindSchema.safeParse(taskType).success) {
      navigate("/templates/select-task", { replace: true });
    }
  }, [taskType, navigate]);

  const createMutation = useMutation(
    trpc.templates.create.mutationOptions({
      onSuccess: async ({ name }) => {
        showSuccessToast({
          title: "Template created",
          description: `New template "${name}" created.`,
        });
        await queryClient.invalidateQueries(trpc.templates.pathFilter());
        navigate(`/templates`);
      },
    })
  );

  const handleTemplateSubmit = (data: {
    metadata: {
      name: string;
      task: TaskKind;
      description?: string;
    };
    layoutDraft: LayoutNodeDraft[];
    slotsDraft: Record<string, SlotDraft>;
  }) => {
    if (!taskType) return;

    try {
      const draft = {
        id: `template_${Date.now()}`, // Temporary ID
        name: data.metadata.name,
        description: data.metadata.description || "",
        task: taskType,
        layoutDraft: data.layoutDraft,
        slotsDraft: data.slotsDraft,
      };

      const compiledTemplate = compileDraft(draft);

      createMutation.mutate({ ...compiledTemplate, task: taskType });
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
  if (!taskType || !taskKindSchema.safeParse(taskType).success) {
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
