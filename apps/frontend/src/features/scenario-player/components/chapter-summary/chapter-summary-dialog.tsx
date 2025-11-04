import { Box, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import type { ChapterSummaryStatus } from "@storyforge/contracts";
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
    const trimmed = textValue.trim();
    await saveSummary({
      closingEventId,
      summaryText: trimmed,
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
  const trimmedValue = textValue.trim();
  const canSave =
    Boolean(closingEventId) &&
    !summaryQuery.isPending &&
    (trimmedValue.length > 0 || Boolean(summaryRecord));
  const isRunning = status?.state === "running";
  const saveButtonLabel =
    trimmedValue.length > 0 ? "Update Summary" : summaryRecord ? "Clear Summary" : "Update Summary";
  const cancelButtonLabel = isRunning ? "Close" : "Cancel";

  const runInfo = status?.run;
  const isLoadingSummary = summaryQuery.isPending && !isRunning;
  const summaryUnavailable =
    summaryQuery.isError && status?.state !== "missing" && status?.state !== "running";

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
          <Stack gap="4">
            {runInfo ? (
              <ChapterSummaryRunStatus
                run={runInfo}
                state={status?.state}
                lastError={status?.lastError}
              />
            ) : null}

            {isLoadingSummary ? (
              <Stack gap="4" align="center">
                <Spinner />
                <Text color="content.muted" fontSize="sm">
                  Loading summary…
                </Text>
              </Stack>
            ) : null}

            {summaryUnavailable ? (
              <Text color="fg.error" fontSize="sm">
                Failed to load summary details.
                {status?.lastError ? ` (${status.lastError})` : ""}
              </Text>
            ) : null}

            {!isRunning && (
              <Field label="Summary">
                <AutosizeTextarea
                  value={textValue}
                  onChange={(event) => setTextValue(event.target.value)}
                  minRows={5}
                  maxRows={20}
                />
              </Field>
            )}

            {lastUpdatedLabel ? (
              <Text fontSize="xs" color="content.muted">
                Last updated {lastUpdatedLabel}
              </Text>
            ) : null}

            {status?.state === "stale" ? (
              <Text fontSize="xs" color="fg.warning">
                The turns covered by this summary have changed, so it might not accurately reflect
                the chapter's content.
              </Text>
            ) : null}
          </Stack>
        </Dialog.Body>
        <Dialog.Footer display="flex" justifyContent="flex-end" gap="2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isSaving}>
            {cancelButtonLabel}
          </Button>
          {!isRunning && (
            <Button size="sm" onClick={handleSave} loading={isSaving} disabled={!canSave}>
              {saveButtonLabel}
            </Button>
          )}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function ChapterSummaryRunStatus({
  run,
  state,
  lastError,
}: {
  run: NonNullable<ChapterSummaryStatus["run"]>;
  state?: ChapterSummaryStatus["state"];
  lastError?: string;
}) {
  const title = state === "running" ? "Summarizing chapter…" : "Summary run details";
  const durationLabel = formatDuration(run.elapsedMs);
  const lastEvent = run.lastEvent;
  const showPreview =
    state === "running" && run.outputPreview && run.outputPreview.trim().length > 0;

  return (
    <Stack gap="2" bg="bg.subtle" borderRadius="md" px="3" py="2">
      <Text fontSize="xs" fontWeight="semibold" color="content.muted">
        {title}
      </Text>
      <Stack gap="1">
        <Text fontSize="xs" color="content.subtle">
          Started {run.startedAt.toLocaleTimeString()} · Elapsed {durationLabel}
        </Text>
        {lastEvent ? (
          <Text fontSize="xs" color="content.subtle">
            Last event: {lastEvent.type}
            {lastEvent.name
              ? ` (${lastEvent.name})`
              : lastEvent.stepId
                ? ` (${lastEvent.stepId})`
                : ""}
          </Text>
        ) : null}
        {state === "running" ? (
          <Text fontSize="xs" color="content.subtle">
            Summarizer is currently running...
          </Text>
        ) : null}
        {state === "error" && lastError ? (
          <Text fontSize="xs" color="fg.error">
            Last error: {lastError}
          </Text>
        ) : null}
        {showPreview ? (
          <Box bg="bg.muted" borderRadius="sm" px="3" py="2">
            <Text fontSize="xs" fontFamily="mono" whiteSpace="pre-wrap" color="content.muted">
              {run.outputPreview}
            </Text>
          </Box>
        ) : null}
      </Stack>
    </Stack>
  );
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}
