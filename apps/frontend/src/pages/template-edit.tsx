import { Container, Heading, Text, VStack } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Button, SimplePageHeader } from "@/components/ui";
import { TemplateForm } from "@/features/template-builder/components/template-form";
import { compileDraft } from "@/features/template-builder/services/compile-draft";
import { templateToDraft } from "@/features/template-builder/services/template-conversion";
import type { LayoutNodeDraft, SlotDraft } from "@/features/template-builder/types";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

function TemplateEditPage() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const templateQuery = useQuery(
    trpc.templates.getById.queryOptions(
      { id: id ?? "" },
      { enabled: !!id, refetchOnWindowFocus: false }
    )
  );

  const updateMutation = useMutation(
    trpc.templates.update.mutationOptions({
      onSuccess: async () => {
        showSuccessToast({
          title: "Template updated",
          description: `Changes saved.`,
        });
        await queryClient.invalidateQueries(trpc.templates.pathFilter());
        templateQuery.refetch();
      },
    })
  );

  const handleSubmit = async (data: {
    metadata: { name: string; task: TaskKind; description?: string };
    layoutDraft: LayoutNodeDraft[];
    slotsDraft: Record<string, SlotDraft>;
  }) => {
    if (!templateQuery.data) return;

    try {
      const draft = {
        id: templateQuery.data.id,
        name: data.metadata.name,
        description: data.metadata.description || "",
        task: templateQuery.data.task, // Task cannot change in edit mode
        layoutDraft: data.layoutDraft,
        slotsDraft: data.slotsDraft,
      };

      const compiledTemplate = compileDraft(draft);

      await updateMutation.mutateAsync({
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
        pageTitle={template.name}
        isEditMode={true}
      />
    </Container>
  );
}

export default TemplateEditPage;
