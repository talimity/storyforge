import { Container, Heading, Text, VStack } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/prompt-renderer";
import { useNavigate, useParams } from "react-router-dom";
import { TemplateForm } from "@/components/features/templates/template-form";
import type {
  LayoutNodeDraft,
  SlotDraft,
} from "@/components/features/templates/types";
import { compileDraft } from "@/components/features/templates/utils/compile-draft";
import { templateToDraft } from "@/components/features/templates/utils/template-conversion";
import { Button, SimplePageHeader } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { showErrorToast, showSuccessToast } from "@/lib/utils/error-handling";

export function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const templateQuery = trpc.templates.getById.useQuery(
    { id: id ?? "" },
    { enabled: !!id }
  );

  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: async () => {
      showSuccessToast({
        title: "Template updated",
        description: `Changes saved.`,
      });
      await utils.templates.invalidate();
      templateQuery.refetch();
    },
  });

  const handleSubmit = (data: {
    metadata: {
      name: string;
      task: TaskKind;
      description?: string;
    };
    layoutDraft: LayoutNodeDraft[];
    slotsDraft: Record<string, SlotDraft>;
  }) => {
    if (!templateQuery.data) return;

    try {
      const draft = {
        id: templateQuery.data.id,
        name: data.metadata.name,
        task: templateQuery.data.task, // Task cannot change in edit mode
        layoutDraft: data.layoutDraft,
        slotsDraft: data.slotsDraft,
      };

      const compiledTemplate = compileDraft(draft);

      updateMutation.mutate({
        id: templateQuery.data.id,
        data: {
          name: data.metadata.name,
          description: data.metadata.description,
          layout: compiledTemplate.layout,
          slots: compiledTemplate.slots,
        },
      });
    } catch (error) {
      showErrorToast({
        title: "Failed to save template",
        fallbackMessage: "An unknown error occurred.",
        error,
      });
    }
  };

  const handleCancel = () => {
    navigate("/templates");
  };

  if (templateQuery.isLoading) {
    return (
      <Container maxW="6xl">
        <SimplePageHeader title="Loading Template..." />
        <VStack gap={4} align="center" py={12}>
          <Text color="content.muted">Loading template data...</Text>
        </VStack>
      </Container>
    );
  }

  if (!id || templateQuery.isError || !templateQuery.data) {
    return (
      <Container maxW="6xl">
        <SimplePageHeader title="Template Not Found" />
        <VStack gap={4} align="center" textAlign="center" py={12}>
          <Heading size="md" color="content.muted">
            {!id
              ? "No template ID provided in the URL."
              : "The template you're looking for doesn't exist or has been deleted."}
          </Heading>
          <Text color="content.muted" fontSize="sm">
            {templateQuery.error?.message}
          </Text>
          <Button onClick={handleCancel}>Back to Templates</Button>
        </VStack>
      </Container>
    );
  }

  const template = templateQuery.data;
  const initialDraft = templateToDraft(template);

  return (
    <Container maxW="6xl">
      <TemplateForm
        initialDraft={initialDraft}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={updateMutation.isPending}
        submitLabel="Save Changes"
        pageTitle={`Edit '${template.name}'`}
        isEditMode={true}
      />
    </Container>
  );
}
