import { HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AutosizeTextarea, Button, Dialog, Field } from "@/components/ui";
import { useChapterSummaryActions } from "@/features/scenario-player/hooks/use-chapter-summary-actions";
import { useChapterSummaryStatuses } from "@/features/scenario-player/hooks/use-chapter-summary-statuses";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useChapterSummaryDialogStore } from "@/features/scenario-player/stores/chapter-summary-dialog-store";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { useTRPC } from "@/lib/trpc";
import { ChapterSummaryStatusBadge } from "./chapter-summary-status-badge";

export function ChapterSummaryDialog() {
  const closingEventId = useChapterSummaryDialogStore((s) => s.closingEventId);
  const closeDialog = useChapterSummaryDialogStore((s) => s.closeDialog);
  const isOpen = closingEventId !== null;

  const trpc = useTRPC();
  const { scenario, chapterLabelsByEventId, chaptersByEventId, deriveChapterLabel } =
    useScenarioContext();
  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const leafTurnId = previewLeafTurnId ?? scenario.anchorTurnId;
  const { statusesByClosingEventId } = useChapterSummaryStatuses({
    scenarioId: scenario.id,
    leafTurnId,
  });
  const status = closingEventId ? statusesByClosingEventId.get(closingEventId) : undefined;
  const chapterEventId = status?.chapterEventId;
  const chapter = chapterEventId ? chaptersByEventId[chapterEventId] : undefined;
  const chapterLabel =
    chapterEventId && chapter
      ? (chapterLabelsByEventId[chapterEventId] ?? deriveChapterLabel(chapter))
      : "Chapter Summary";

  const summaryQuery = useQuery(
    trpc.chapterSummaries.get.queryOptions(
      { closingEventId: closingEventId ?? "" },
      {
        enabled: isOpen && !!closingEventId,
        placeholderData: keepPreviousData,
      }
    )
  );

  const summaryRecord = summaryQuery.data?.summary;
  const [textValue, setTextValue] = useState(summaryRecord?.summaryText ?? "");

  useEffect(() => {
    if (!summaryRecord) {
      setTextValue("");
      return;
    }
    setTextValue(summaryRecord.summaryText);
  }, [summaryRecord]);

  const { saveSummary, summarizeChapter, isSaving, isSummarizing } = useChapterSummaryActions();

  const canSummarize = Boolean(status?.closingEventId && status.state !== "current");
  const summarizeButtonLabel =
    status?.state === "missing" ? "Generate" : status?.state === "error" ? "Retry" : "Regenerate";

  const handleClose = () => {
    closeDialog();
  };

  const handleSave = async () => {
    if (!closingEventId) return;
    if (textValue.trim().length === 0) return;
    await saveSummary({
      closingEventId,
      summaryText: textValue,
      summaryJson: summaryRecord?.summaryJson,
    });
    handleClose();
  };

  const handleSummarize = async () => {
    if (!closingEventId) return;
    await summarizeChapter({
      closingEventId,
      force: status?.state === "ready",
    });
  };

  const lastUpdated = summaryRecord?.updatedAt ?? summaryRecord?.createdAt;
  const lastUpdatedLabel = lastUpdated ? lastUpdated.toLocaleString() : null;
  const canSave = Boolean(closingEventId) && textValue.trim().length > 0 && !summaryQuery.isPending;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) handleClose();
      }}
      placement="center"
      size="xl"
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{chapterLabel}</Dialog.Title>
          <HStack gap="2" align="center">
            <ChapterSummaryStatusBadge status={status} />
            {canSummarize && status?.state !== "running" ? (
              <Button variant="ghost" size="xs" onClick={handleSummarize} loading={isSummarizing}>
                {summarizeButtonLabel}
              </Button>
            ) : null}
          </HStack>
        </Dialog.Header>
        <Dialog.Body>
          {summaryQuery.isPending ? (
            <Stack gap="4" align="center">
              <Spinner />
              <Text color="content.muted" fontSize="sm">
                Loading summary…
              </Text>
            </Stack>
          ) : summaryQuery.isError && status?.state !== "missing" ? (
            <Stack gap="3">
              <Text color="fg.error" fontSize="sm">
                Failed to load summary details.
              </Text>
            </Stack>
          ) : (
            <Stack gap="4">
              <Field label="Summary">
                <AutosizeTextarea
                  value={textValue}
                  onChange={(event) => setTextValue(event.target.value)}
                  minRows={5}
                  maxRows={20}
                />
              </Field>
              {lastUpdatedLabel ? (
                <Text fontSize="xs" color="content.muted">
                  Last updated {lastUpdatedLabel}
                </Text>
              ) : null}
              {status?.state === "stale" ? (
                <Text fontSize="xs" color="fg.warning">
                  The turns covered by this summary have changed, so it might not accurately reflect
                  the chapter's content. ({status.staleReasons})
                </Text>
              ) : null}
            </Stack>
          )}
        </Dialog.Body>
        <Dialog.Footer display="flex" justifyContent="flex-end" gap="2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} loading={isSaving} disabled={!canSave}>
            Update Summary
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
