import { Box, Tabs, VStack } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { LuBox, LuEye, LuInfo } from "react-icons/lu";
import { UnsavedChangesDialog } from "@/components/dialogs/unsaved-changes";
import { Button, PageHeader } from "@/components/ui";
import { useUnsavedChangesProtection } from "@/lib/hooks/use-unsaved-changes-protection";
import { LayoutBuilder } from "./builder/layout-builder";
import { TemplateMetadata } from "./builder/template-metadata";
import { TemplatePreview } from "./preview";
import {
  type TemplateFormData,
  templateFormSchema,
} from "./template-form-schema";
import type { TemplateDraft } from "./types";
import { validateDraft } from "./utils/compile-draft";

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
      responseFormat: "text",
    },
  });

  // Builder state
  const [layoutDraft, setLayoutDraft] = useState(initialDraft.layoutDraft);
  const [slotsDraft, setSlotsDraft] = useState(initialDraft.slotsDraft);
  const [builderIsDirty, setBuilderIsDirty] = useState(false);

  // Track if we just submitted to prevent flash on save
  const justSubmittedRef = useRef(false);
  const prevInitialDraftRef = useRef(initialDraft);

  // Update state when initialDraft changes (for edit mode)
  useEffect(() => {
    // Only reset if the draft has actually changed (not just a re-render after save)
    const draftChanged =
      prevInitialDraftRef.current.name !== initialDraft.name ||
      prevInitialDraftRef.current.task !== initialDraft.task ||
      JSON.stringify(prevInitialDraftRef.current.layoutDraft) !==
        JSON.stringify(initialDraft.layoutDraft) ||
      JSON.stringify(prevInitialDraftRef.current.slotsDraft) !==
        JSON.stringify(initialDraft.slotsDraft);

    if (
      isEditMode &&
      initialDraft.name &&
      draftChanged &&
      !justSubmittedRef.current
    ) {
      reset({
        name: initialDraft.name,
        task: initialDraft.task,
        description: "",
        responseFormat: "text",
      });
      setLayoutDraft(initialDraft.layoutDraft);
      setSlotsDraft(initialDraft.slotsDraft);
      setBuilderIsDirty(false);
    }

    // Reset the flag after handling the update
    if (justSubmittedRef.current) {
      justSubmittedRef.current = false;
    }

    prevInitialDraftRef.current = initialDraft;
  }, [initialDraft, isEditMode, reset]);

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

  const validationErrors = validateDraft(currentDraft);
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

  // Event handlers
  const handleLayoutChange = useCallback((newLayout: typeof layoutDraft) => {
    setLayoutDraft(newLayout);
    setBuilderIsDirty(true);
  }, []);

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
      icon: <LuBox />,
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

              <LayoutBuilder
                layout={layoutDraft}
                slots={slotsDraft}
                task={metadata.task}
                onLayoutChange={handleLayoutChange}
                onSlotsChange={(newSlots) => {
                  setSlotsDraft(newSlots);
                  setBuilderIsDirty(true);
                }}
              />
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
