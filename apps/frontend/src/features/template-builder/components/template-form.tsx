import { List, Tabs, VStack } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import { LuEye, LuInfo, LuRows3, LuSyringe, LuTriangleAlert } from "react-icons/lu";
import { useShallow } from "zustand/react/shallow";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes-dialog";
import { Alert, Button, PageHeader } from "@/components/ui";
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
import { useAppForm } from "@/lib/app-form";

interface TemplateFormProps {
  initialDraft: TemplateDraft;
  onSubmit: (data: {
    metadata: TemplateFormData;
    layoutDraft: TemplateDraft["layoutDraft"];
    slotsDraft: TemplateDraft["slotsDraft"];
    attachmentDrafts: TemplateDraft["attachmentDrafts"];
  }) => Promise<void> | void;
  onCancel: () => void;
  pageTitle: string;
  isEditMode?: boolean;
}

type MetadataFormValues = TemplateFormData & { description: string };

export function TemplateForm({
  initialDraft,
  onSubmit,
  onCancel,
  pageTitle,
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
  const submitLabel = isEditMode
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
      {/* Todo: move page wrapper out of form */}
      <PageHeader.Root>
        <PageHeader.Title>
          {isEditMode ? `Edit Template: ${pageTitle}` : pageTitle}
        </PageHeader.Title>

        <PageHeader.Tabs tabs={tabs} defaultValue={activeTab} onChange={setActiveTab}>
          <PageHeader.Controls>
            <Button
              variant="ghost"
              onClick={() => confirmNavigation(onCancel)}
              disabled={formIsSubmitting}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  colorPalette="primary"
                  onClick={() => form.handleSubmit()}
                  disabled={
                    !canSubmit || isSubmitting || (hasStructureErrors && activeTab === "structure")
                  }
                  loading={isSubmitting}
                  loadingText={isEditMode ? "Saving..." : "Creating..."}
                >
                  {submitLabel}
                </Button>
              )}
            </form.Subscribe>
          </PageHeader.Controls>

          <Tabs.Content value="metadata">
            <TemplateMetadata form={form} isEditMode={isEditMode} />
          </Tabs.Content>

          <Tabs.Content value="structure">
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

          <Tabs.Content value="attachments">
            <AttachmentsPanel task={metadataValues.task} />
          </Tabs.Content>

          <Tabs.Content value="preview">
            <TemplatePreview draft={currentDraft} />
          </Tabs.Content>
        </PageHeader.Tabs>
      </PageHeader.Root>

      <UnsavedChangesDialog
        isOpen={showDialog}
        onConfirm={handleConfirmNavigation}
        onCancel={handleCancelNavigation}
      />
    </>
  );
}
