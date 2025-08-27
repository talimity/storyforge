import { Box, Tabs, VStack } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { LuEye, LuInfo, LuRows3 } from "react-icons/lu";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes";
import { LayoutBuilder } from "@/components/features/templates/builder/layout-builder";
import { TemplateMetadata } from "@/components/features/templates/builder/template-metadata";
import { TemplatePreview } from "@/components/features/templates/preview/template-preview";
import {
  type TemplateFormData,
  templateFormSchema,
} from "@/components/features/templates/template-form-schema";
import type { TemplateDraft } from "@/components/features/templates/types";
import { Button, PageHeader } from "@/components/ui";
import { useUnsavedChangesProtection } from "@/lib/hooks/use-unsaved-changes-protection";
import {
  getValidationErrors,
  useTemplateBuilderStore,
} from "@/stores/template-builder-store";

interface TemplateFormProps {
  initialDraft: TemplateDraft;
  onSubmit: (data: {
    metadata: TemplateFormData;
    layoutDraft: TemplateDraft["layoutDraft"];
    slotsDraft: TemplateDraft["slotsDraft"];
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  pageTitle: string;
  isEditMode?: boolean;
}

export function TemplateForm({
  initialDraft,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save Template",
  pageTitle,
  isEditMode = false,
}: TemplateFormProps) {
  const [activeTab, setActiveTab] = useState("metadata");

  // Store state
  const {
    layoutDraft,
    slotsDraft,
    isDirty: builderIsDirty,
    initialize,
    markClean,
  } = useTemplateBuilderStore();

  // Form state for metadata
  const {
    handleSubmit,
    formState: { isDirty: metadataIsDirty, errors },
    watch,
    register,
    control,
    reset,
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    mode: "onBlur",
    defaultValues: {
      name: initialDraft.name,
      task: initialDraft.task,
      description: "",
    },
  });

  // Track if we just submitted to prevent flash on save
  const justSubmittedRef = useRef(false);
  const prevInitialDraftRef = useRef<TemplateDraft | null>(null);

  // Initialize store state when component mounts or initialDraft changes
  useEffect(() => {
    // Check if this is the first mount or if the draft has actually changed
    const prev = prevInitialDraftRef.current;
    const isFirstMount = prev === null;
    const draftChanged =
      prev !== null &&
      (prev.name !== initialDraft.name ||
        prev.task !== initialDraft.task ||
        JSON.stringify(prev.layoutDraft) !==
          JSON.stringify(initialDraft.layoutDraft) ||
        JSON.stringify(prev.slotsDraft) !==
          JSON.stringify(initialDraft.slotsDraft));

    // Initialize on mount or when draft changes
    if ((isFirstMount || draftChanged) && !justSubmittedRef.current) {
      if (isEditMode && initialDraft.name) {
        reset({
          name: initialDraft.name,
          task: initialDraft.task,
          description: "",
        });
      }
      initialize(initialDraft);
    }

    // Reset the flag after handling the update
    if (justSubmittedRef.current) {
      justSubmittedRef.current = false;
      markClean();
    }

    prevInitialDraftRef.current = initialDraft;
  }, [initialDraft, isEditMode, reset, initialize, markClean]);

  const metadata = watch();

  // Validation - memoize to prevent recreation on every render
  const currentDraft: TemplateDraft = useMemo(
    () => ({
      id: initialDraft.id,
      name: metadata.name,
      task: metadata.task,
      layoutDraft,
      slotsDraft,
    }),
    [initialDraft.id, metadata.name, metadata.task, layoutDraft, slotsDraft]
  );

  const builderStore = useTemplateBuilderStore();
  const validationErrors = useMemo(
    () =>
      getValidationErrors(
        builderStore,
        metadata.task,
        initialDraft.id,
        metadata.name
      ),
    [builderStore, metadata.task, metadata.name, initialDraft.id]
  );
  const hasValidationErrors = validationErrors.length > 0;
  const metadataErrorCount = Object.keys(errors).length;
  const structureErrorCount = validationErrors.length;

  const hasUnsavedChanges =
    (metadataIsDirty || builderIsDirty) && !isSubmitting;

  const { showDialog, handleConfirmNavigation, handleCancelNavigation } =
    useUnsavedChangesProtection({
      hasUnsavedChanges,
      message:
        "You have unsaved changes to this template. Are you sure you want to leave?",
    });

  const onFormSubmit = useCallback(
    (formData: TemplateFormData) => {
      if (hasValidationErrors) {
        setActiveTab("structure");
        return;
      }

      // Mark that we're submitting to prevent flash on save
      justSubmittedRef.current = true;

      onSubmit({ metadata: formData, layoutDraft, slotsDraft });
    },
    [hasValidationErrors, layoutDraft, slotsDraft, onSubmit]
  );

  const handleFormSubmit = useCallback(() => {
    handleSubmit(onFormSubmit)();
  }, [handleSubmit, onFormSubmit]);

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
      label: "Structure",
      icon: <LuRows3 />,
      badge: structureErrorCount > 0 ? structureErrorCount : undefined,
      badgeColorPalette: structureErrorCount > 0 ? ("red" as const) : undefined,
    },
    {
      value: "preview",
      label: "Preview",
      icon: <LuEye />,
    },
  ];

  return (
    <>
      <PageHeader.Root>
        <PageHeader.Title>{pageTitle}</PageHeader.Title>

        <PageHeader.Tabs
          tabs={tabs}
          defaultValue={activeTab}
          onChange={setActiveTab}
        >
          <PageHeader.Controls>
            <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              colorPalette="primary"
              onClick={handleFormSubmit}
              disabled={
                isSubmitting ||
                (hasValidationErrors && activeTab === "structure")
              }
              loading={isSubmitting}
              loadingText={isEditMode ? "Saving..." : "Creating..."}
            >
              {submitLabel}
            </Button>
          </PageHeader.Controls>

          <Tabs.Content value="metadata">
            <TemplateMetadata
              register={register}
              control={control}
              errors={errors}
              watchedValues={metadata}
              isEditMode={isEditMode}
            />
          </Tabs.Content>

          <Tabs.Content value="structure">
            <VStack align="stretch" gap={4}>
              {/* Validation Errors */}
              {hasValidationErrors && (
                <Box
                  bg="red.50"
                  border="1px solid"
                  borderColor="red.200"
                  p={3}
                  borderRadius="md"
                >
                  <VStack align="start" gap={1}>
                    {validationErrors.map((error) => (
                      <Box key={error} fontSize="sm" color="red.600">
                        • {error}
                      </Box>
                    ))}
                  </VStack>
                </Box>
              )}

              <LayoutBuilder task={metadata.task} />
            </VStack>
          </Tabs.Content>

          <Tabs.Content value="preview">
            <TemplatePreview draft={currentDraft} />
          </Tabs.Content>
        </PageHeader.Tabs>
      </PageHeader.Root>

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showDialog}
        onConfirm={handleConfirmNavigation}
        onCancel={handleCancelNavigation}
      />
    </>
  );
}
