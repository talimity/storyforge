import { Box, Flex, Heading, Separator, Stack } from "@chakra-ui/react";
import type { ChapterSummaryStatus } from "@storyforge/contracts";
import { ChapterSummaryActionsMenu } from "@/features/scenario-player/components/chapter-summary/chapter-summary-actions-menu";
import { ChapterSummaryStatusBadge } from "@/features/scenario-player/components/chapter-summary/chapter-summary-status-badge";
import { useChapterActions } from "@/features/scenario-player/hooks/use-chapter-actions";
import { useChapterSummaryActions } from "@/features/scenario-player/hooks/use-chapter-summary-actions";
import { useChapterSummaryStatuses } from "@/features/scenario-player/hooks/use-chapter-summary-statuses";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useChapterRenameDialogStore } from "@/features/scenario-player/stores/chapter-rename-dialog-store";
import { useChapterSummaryDialogStore } from "@/features/scenario-player/stores/chapter-summary-dialog-store";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { showSuccessToast } from "@/lib/error-handling";

type ChapterSeparatorProps = {
  chapterEventId?: string;
  label?: string;
};

export function ChapterSeparator(props: ChapterSeparatorProps) {
  const { chapterEventId, label } = props;
  const { scenario, chaptersByEventId, deriveChapterLabel } = useScenarioContext();
  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const leafTurnId = previewLeafTurnId ?? scenario.anchorTurnId;

  const { statusesByChapterEventId } = useChapterSummaryStatuses({
    scenarioId: scenario.id,
    leafTurnId,
  });

  const status = chapterEventId ? statusesByChapterEventId.get(chapterEventId) : undefined;
  const chapter = chapterEventId ? chaptersByEventId[chapterEventId] : undefined;
  const heading = chapter ? deriveChapterLabel(chapter) : label;

  if (!heading) {
    console.warn("ChapterSeparator: missing heading", { chapterEventId, label });
    return <Separator />;
  }

  return (
    <ChapterSeparatorInner chapterEventId={chapterEventId} heading={heading} status={status} />
  );
}

function ChapterSeparatorInner(props: {
  chapterEventId?: string;
  heading: string;
  status?: ChapterSummaryStatus;
}) {
  const { chapterEventId, heading, status } = props;
  const { summarizeChapter, isSummarizing } = useChapterSummaryActions();
  const { deleteChapter, isDeletingChapter } = useChapterActions();
  const openSummaryDialog = useChapterSummaryDialogStore((s) => s.openDialog);
  const openRenameDialog = useChapterRenameDialogStore((s) => s.openDialog);

  const closingEventId = status?.closingEventId;
  const isActionable = Boolean(closingEventId && status?.state !== "current");
  const hasChapterNode = Boolean(chapterEventId);

  const handleOpenSummary = () => {
    if (!closingEventId || !isActionable) return;
    openSummaryDialog(closingEventId);
  };

  const handleSummarize = (force?: boolean) => {
    if (!closingEventId || !isActionable) return;
    void summarizeChapter({ closingEventId, force });
  };

  const handleRename = () => {
    if (!chapterEventId) return;
    openRenameDialog(chapterEventId);
  };

  const handleDelete = async () => {
    if (!chapterEventId) return;
    await deleteChapter({ eventId: chapterEventId });
    showSuccessToast({ title: "Chapter deleted" });
  };

  return (
    <Stack p={8} textAlign="center" role="group" position="relative">
      <Flex align="center" justify="center" gap="2">
        <Heading color="content.muted" fontWeight="medium" fontSize="xl">
          {heading}
        </Heading>
        <ChapterSummaryStatusBadge status={status} showText={false} />
      </Flex>
      {hasChapterNode ? (
        <Box
          position="absolute"
          top="2"
          right="2"
          opacity={0}
          pointerEvents="none"
          transition="opacity 0.2s ease"
          _groupHover={{ opacity: 1, pointerEvents: "auto" }}
        >
          <ChapterSummaryActionsMenu
            status={status}
            onOpenSummary={handleOpenSummary}
            onSummarize={handleSummarize}
            onRename={handleRename}
            onDelete={handleDelete}
            isSummarizing={isSummarizing && isActionable}
            isDeleting={isDeletingChapter}
            portalled
          />
        </Box>
      ) : null}
      <Separator />
    </Stack>
  );
}
