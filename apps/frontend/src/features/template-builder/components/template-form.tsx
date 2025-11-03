import { Badge, Card, HStack, List, Spacer, Stack, Tabs, VStack } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { useEffect, useId, useRef, useState } from "react";
import { LuEye, LuInfo, LuRows3, LuSyringe, LuTriangleAlert } from "react-icons/lu";
import { useShallow } from "zustand/react/shallow";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes-dialog";
import { Alert, Button } from "@/components/ui";
import { AttachmentsPanel } from "@/features/template-builder/components/attachments/attachments-panel";
import { LayoutBuilder } from "@/features/template-builder/components/layout-builder";
import { TemplateMetadata } from "@/features/template-builder/components/template-metadata";
import { TemplatePreview } from "@/features/template-builder/components/template-preview";
import { validateDraft } from "@/features/template-builder/services/compile-draft";
import { useTemplateBuilderStore } from "@/features/template-builder/stores/template-builder-store";
import {
  type TemplateFormData,
  templateFormSchema,
} from "@/features/template-builder/template-form-schema";
import type { TemplateDraft } from "@/features/template-builder/types";
import { useUnsavedChangesProtection } from "@/hooks/use-unsaved-changes-protection";
import { useAppForm } from "@/lib/form/app-form";

interface TemplateFormProps {
  initialDraft: TemplateDraft;
  onSubmit: (data: {
    metadata: TemplateFormData;
    layoutDraft: TemplateDraft["layoutDraft"];
    slotsDraft: TemplateDraft["slotsDraft"];
    attachmentDrafts: TemplateDraft["attachmentDrafts"];
  }) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isEditMode?: boolean;
}

type MetadataFormValues = TemplateFormData & { description: string };

export function TemplateForm({
  initialDraft,
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel = "Cancel",
  isEditMode = false,
}: TemplateFormProps) {
  const [activeTab, setActiveTab] = useState("metadata");

  const { layoutDraft, slotsDraft, attachmentDrafts, builderIsDirty, initialize, markClean } =
    useTemplateBuilderStore(
      useShallow((state) => ({
        layoutDraft: state.layoutDraft,
        slotsDraft: state.slotsDraft,
        attachmentDrafts: state.attachmentDrafts,
        builderIsDirty: state.isDirty,
        initialize: state.initialize,
        markClean: state.markClean,
      }))
    );

  const metadataDefaults: MetadataFormValues = {
    name: initialDraft.name,
    task: initialDraft.task,
    description: initialDraft.description ?? "",
  };

  const form = useAppForm({
    formId: `template-metadata-form-${useId()}`,
    defaultValues: metadataDefaults,
    validators: {
      onBlur: ({ value }) => {
        const result = templateFormSchema.safeParse({
          name: value.name,
          task: value.task,
          description: value.description || undefined,
        });
        if (result.success) return undefined;

        const fieldErrors: Record<string, unknown> = {};

        for (const issue of result.error.issues) {
          const key = issue.path.join(".");
          if (!key) continue;
          if (fieldErrors[key]) continue;
          fieldErrors[key] = issue.message;
        }

        return { fields: fieldErrors };
      },
    },
    onSubmit: async ({ value }) => {
      const structureIssues = validateDraft({
        task: value.task,
        layoutDraft,
        slotsDraft,
        attachmentDrafts,
      });

      if (structureIssues.length > 0) {
        setActiveTab("structure");
        return;
      }

      justSubmittedRef.current = true;
      const metadata: TemplateFormData = {
        name: value.name,
        task: value.task,
        description: value.description || undefined,
      };

      await onSubmit({ metadata, layoutDraft, slotsDraft, attachmentDrafts });

      form.reset({
        name: metadata.name,
        task: metadata.task,
        description: metadata.description ?? "",
      });

      markClean();
      justSubmittedRef.current = false;
    },
  });

  const justSubmittedRef = useRef(false);
  const prevInitialDraftRef = useRef<TemplateDraft | null>(null);

  useEffect(() => {
    const prev = prevInitialDraftRef.current;
    const isFirstMount = prev === null;
    const templateSwitched = prev?.id !== initialDraft.id;

    if ((isFirstMount || templateSwitched) && !justSubmittedRef.current) {
      form.reset({
        name: initialDraft.name,
        task: initialDraft.task,
        description: initialDraft.description ?? "",
      });
      initialize(initialDraft);
    }

    prevInitialDraftRef.current = initialDraft;
  }, [form, initialDraft, initialize]);

  const metadataValues = useStore(form.store, (state) => state.values);
  const formIsDirty = useStore(form.store, (state) => state.isDirty);
  const formIsSubmitting = useStore(form.store, (state) => state.isSubmitting);

  const currentDraft: TemplateDraft = {
    id: initialDraft.id,
    name: metadataValues.name,
    description: metadataValues.description || "",
    task: metadataValues.task,
    layoutDraft,
    slotsDraft,
    attachmentDrafts,
  };

  const structureErrors = validateDraft({
    task: metadataValues.task,
    layoutDraft,
    slotsDraft,
    attachmentDrafts,
  });
  const hasStructureErrors = structureErrors.length > 0;
  const structureErrorCount = structureErrors.length;

  const metadataValidation = templateFormSchema.safeParse({
    name: metadataValues.name,
    task: metadataValues.task,
    description: metadataValues.description || undefined,
  });
  const metadataErrorCount = metadataValidation.success
    ? 0
    : metadataValidation.error.issues.length;

  const hasUnsavedChanges = (formIsDirty || builderIsDirty) && !formIsSubmitting;

  const computedSubmitLabel = submitLabel
    ? submitLabel
    : isEditMode
      ? hasUnsavedChanges
        ? "Save Changes"
        : "Saved"
      : "Create Template";

  const { showDialog, handleConfirmNavigation, handleCancelNavigation, confirmNavigation } =
    useUnsavedChangesProtection({
      hasUnsavedChanges,
      message: "You have unsaved changes to this template. Are you sure you want to leave?",
    });

  const tabs = [
    {
      value: "metadata",
      label: "Metadata",
      icon: <LuInfo />,
      badge: metadataErrorCount > 0 ? metadataErrorCount : undefined,
      badgeColorPalette: metadataErrorCount > 0 ? ("red" as const) : undefined,
    },
    {
      value: "structure",
      label: "Layout",
      icon: <LuRows3 />,
      badge: structureErrorCount > 0 ? structureErrorCount : undefined,
      badgeColorPalette: structureErrorCount > 0 ? ("red" as const) : undefined,
    },
    {
      value: "attachments",
      label: "Injections",
      icon: <LuSyringe />,
    },
    {
      value: "preview",
      label: "Preview",
      icon: <LuEye />,
    },
  ];

  return (
    <>
      <Card.Root layerStyle="surface" maxW="60rem" mx="auto">
        <form
          id={form.formId}
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <Tabs.Root
            value={activeTab}
            onValueChange={(details) => setActiveTab(details.value)}
            lazyMount
          >
            <Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Trigger key={tab.value} value={tab.value}>
                  <HStack gap={2} align="center">
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge ? (
                      <Badge colorPalette={tab.badgeColorPalette ?? "gray"}>{tab.badge}</Badge>
                    ) : null}
                  </HStack>
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="metadata" p={6}>
              <TemplateMetadata form={form} isEditMode={isEditMode} />
            </Tabs.Content>

            <Tabs.Content value="structure" p={6}>
              <VStack align="stretch" gap={4}>
                {hasStructureErrors && (
                  <Alert
                    icon={<LuTriangleAlert />}
                    title={`Template layout has issues (${structureErrorCount})`}
                    status="error"
                  >
                    <List.Root>
                      {structureErrors.map((error, index) => (
                        <List.Item key={error + String(index)}>{error}</List.Item>
                      ))}
                    </List.Root>
                  </Alert>
                )}

                <LayoutBuilder task={metadataValues.task} />
              </VStack>
            </Tabs.Content>

            <Tabs.Content value="attachments" p={6}>
              <AttachmentsPanel task={metadataValues.task} />
            </Tabs.Content>

            <Tabs.Content value="preview" p={6}>
              <Stack gap={4}>
                <TemplatePreview draft={currentDraft} />
              </Stack>
            </Tabs.Content>
          </Tabs.Root>

          <Card.Footer borderTopWidth={1} borderTopColor="border" pt={6} px={6}>
            <HStack width="full" align="center">
              <Button
                variant="ghost"
                onClick={() => confirmNavigation(onCancel)}
                disabled={formIsSubmitting}
              >
                {cancelLabel}
              </Button>
              <Spacer />
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ canSubmit, isSubmitting }) => (
                  <Button
                    colorPalette="primary"
                    type="submit"
                    disabled={
                      !canSubmit ||
                      isSubmitting ||
                      (hasStructureErrors && activeTab === "structure")
                    }
                    loading={isSubmitting}
                    loadingText={isEditMode ? "Saving..." : "Creating..."}
                  >
                    {computedSubmitLabel}
                  </Button>
                )}
              </form.Subscribe>
            </HStack>
          </Card.Footer>
        </form>
      </Card.Root>

      <UnsavedChangesDialog
        isOpen={showDialog}
        onConfirm={handleConfirmNavigation}
        onCancel={handleCancelNavigation}
        message="You have unsaved changes to this template. Are you sure you want to leave?"
      />
    </>
  );
}
