import { Flex, HStack, Icon, Link, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import type { ChapterSummaryStatus } from "@storyforge/contracts";
import { LuChevronDown, LuCircleAlert, LuPlus, LuTableOfContents } from "react-icons/lu";
import { Button, EmptyState } from "@/components/ui";
import { ChapterRenameDialog } from "@/features/scenario-player/components/chapter-rename-dialog";
import { ChapterSummaryActionsMenu } from "@/features/scenario-player/components/chapter-summary/chapter-summary-actions-menu";
import { ChapterSummaryDialog } from "@/features/scenario-player/components/chapter-summary/chapter-summary-dialog";
import { ChapterSummaryStatusBadge } from "@/features/scenario-player/components/chapter-summary/chapter-summary-status-badge";
import { useChapterActions } from "@/features/scenario-player/hooks/use-chapter-actions";
import { useChapterSummaryActions } from "@/features/scenario-player/hooks/use-chapter-summary-actions";
import { useChapterSummaryStatuses } from "@/features/scenario-player/hooks/use-chapter-summary-statuses";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useChapterRenameDialogStore } from "@/features/scenario-player/stores/chapter-rename-dialog-store";
import { useChapterSummaryDialogStore } from "@/features/scenario-player/stores/chapter-summary-dialog-store";
import {
  selectIsGenerating,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { showSuccessToast } from "@/lib/error-handling";

type ChapterItem = ReturnType<typeof useScenarioContext>["chapters"][number];

export function ScenarioNavigation() {
  const { scenario, chapters, deriveChapterLabel } = useScenarioContext();

  const openSummaryDialog = useChapterSummaryDialogStore((s) => s.openDialog);
  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const leafTurnId = previewLeafTurnId ?? scenario.anchorTurnId;
  const { summaries: chapterSummaryStatuses, statusesByChapterEventId } = useChapterSummaryStatuses(
    {
      scenarioId: scenario.id,
      leafTurnId,
    }
  );
  const { summarizeChapter, isSummarizing } = useChapterSummaryActions();

  const latestChapter = chapters.at(-1);
  const chapterLabel = latestChapter ? deriveChapterLabel(latestChapter) : undefined;

  const { insertChapterAtTurn, deleteChapter, isInsertingChapter, isDeletingChapter } =
    useChapterActions();
  const openRenameDialog = useChapterRenameDialogStore((s) => s.openDialog);

  const hasAttention = chapterSummaryStatuses.some(
    ({ state }) => state === "stale" || state === "error" || state === "missing"
  );

  return (
    <>
      <Popover.Root positioning={{ placement: "bottom", gutter: 4 }} lazyMount unmountOnExit>
        <Popover.Trigger asChild>
          <Button
            variant="ghost"
            px="8"
            w="full"
            justifyContent="space-between"
            position="relative"
          >
            <Flex direction="column" gap="0" lineHeight="1.25">
              <Text truncate>{scenario.title}</Text>
              {chapterLabel && (
                <Text fontSize="2xs" color="content.muted" lineClamp={1}>
                  {chapterLabel}
                </Text>
              )}
            </Flex>
            {/* icon makes text off-center so use absolute positioning */}
            {hasAttention ? (
              <Icon position="absolute" right="2" size="sm" color="fg.error">
                <LuCircleAlert />
              </Icon>
            ) : (
              <Icon position="absolute" right="3" size="sm">
                <LuChevronDown />
              </Icon>
            )}
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Arrow />
              <Popover.Body>
                <Popover.Title textStyle="heading">Chapter Outline</Popover.Title>
                <ChapterList
                  handleRename={(chapter) => openRenameDialog(chapter.eventId)}
                  insertChapterAtTurn={insertChapterAtTurn}
                  deleteChapter={deleteChapter}
                  isInsertingChapter={isInsertingChapter}
                  isDeletingChapter={isDeletingChapter}
                  statusesByChapterEventId={statusesByChapterEventId}
                  onOpenSummary={openSummaryDialog}
                  onSummarize={summarizeChapter}
                  isSummarizing={isSummarizing}
                />
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>

      <ChapterRenameDialog />
      <ChapterSummaryDialog />
    </>
  );
}

function ChapterList({
  handleRename,
  insertChapterAtTurn,
  deleteChapter,
  isInsertingChapter,
  isDeletingChapter,
  statusesByChapterEventId,
  onOpenSummary,
  onSummarize,
  isSummarizing,
}: {
  handleRename: (chapter: ChapterItem) => void;
  insertChapterAtTurn: ReturnType<typeof useChapterActions>["insertChapterAtTurn"];
  deleteChapter: ReturnType<typeof useChapterActions>["deleteChapter"];
  isInsertingChapter: ReturnType<typeof useChapterActions>["isInsertingChapter"];
  isDeletingChapter: ReturnType<typeof useChapterActions>["isDeletingChapter"];
  statusesByChapterEventId: Map<string, ChapterSummaryStatus>;
  onOpenSummary: (closingEventId: string) => void;
  onSummarize: (args: { closingEventId: string; force?: boolean }) => Promise<unknown>;
  isSummarizing: boolean;
}) {
  const { scenario, chapters, deriveChapterLabel } = useScenarioContext();
  const setScrollTarget = useScenarioPlayerStore((s) => s.setPendingScrollTarget);
  const isPreviewing = useScenarioPlayerStore((s) => s.previewLeafTurnId !== null);
  const isGenerating = useIntentRunsStore(selectIsGenerating);

  const handleSelect = (chapter: ChapterItem) => {
    const targetTurnId = chapter.turnId ?? scenario.rootTurnId;
    if (!targetTurnId) return;

    setScrollTarget({ kind: "turn", turnId: targetTurnId, edge: "center" });
  };

  const handleInsert = async () => {
    if (!scenario.anchorTurnId) return;

    await insertChapterAtTurn({ turnId: scenario.anchorTurnId });
    showSuccessToast({ title: "Chapter break inserted" });
    setScrollTarget({ kind: "turn", turnId: scenario.anchorTurnId, edge: "end" });
  };

  const disableInsert = !scenario.anchorTurnId;

  const handleDelete = async (chapter: ChapterItem) => {
    await deleteChapter({ eventId: chapter.eventId });
    showSuccessToast({ title: "Chapter deleted" });
    if (chapter.turnId) {
      setScrollTarget({ kind: "turn", turnId: chapter.turnId, edge: "start" });
    }
  };

  return (
    <Stack>
      <Stack gap="1" py="2">
        {chapters.length === 0 && (
          <EmptyState
            icon={<LuTableOfContents />}
            title="No chapters yet"
            description="Use chapters to organize your scenario and generate summaries to reduce token usage."
          />
        )}

        {chapters.map((chapter: ChapterItem) => {
          const status = statusesByChapterEventId.get(chapter.eventId);
          return (
            <ChapterRow
              key={chapter.eventId}
              chapter={chapter}
              status={status}
              onSelect={handleSelect}
              onRename={handleRename}
              onDelete={handleDelete}
              onOpenSummary={onOpenSummary}
              onSummarize={onSummarize}
              isSummarizing={isSummarizing}
              isDeleting={isDeletingChapter}
              label={deriveChapterLabel(chapter)}
            />
          );
        })}
      </Stack>
      {!isGenerating && !isPreviewing ? (
        <Button
          variant="outline"
          size="xs"
          colorPalette="primary"
          w="full"
          onClick={handleInsert}
          disabled={disableInsert || isInsertingChapter}
          loading={isInsertingChapter}
        >
          <LuPlus />
          Insert Chapter Separator
        </Button>
      ) : null}
    </Stack>
  );
}

function ChapterRow({
  chapter,
  status,
  onSelect,
  onRename,
  onDelete,
  onOpenSummary,
  onSummarize,
  isSummarizing,
  isDeleting,
  label,
}: {
  chapter: ChapterItem;
  status?: ChapterSummaryStatus;
  onSelect: (chapter: ChapterItem) => void;
  onRename: (chapter: ChapterItem) => void;
  onDelete: (chapter: ChapterItem) => void;
  onOpenSummary: (closingEventId: string) => void;
  onSummarize: (args: { closingEventId: string; force?: boolean }) => Promise<unknown>;
  isSummarizing: boolean;
  isDeleting: boolean;
  label: string;
}) {
  const closingEventId = status?.closingEventId;
  const isActionable = Boolean(closingEventId && status?.state !== "current");

  return (
    <HStack colorPalette="neutral" align="center" gap="2" w="full">
      <Button
        asChild
        size="xs"
        justifyContent="start"
        variant="plain"
        flex="1"
        onClick={() => onSelect(chapter)}
      >
        <Link fontSize="sm" truncate>
          {label}
        </Link>
      </Button>
      <ChapterSummaryStatusBadge status={status} />
      <ChapterSummaryActionsMenu
        status={status}
        onOpenSummary={() => closingEventId && onOpenSummary(closingEventId)}
        onSummarize={(force) =>
          closingEventId ? onSummarize({ closingEventId, force }) : Promise.resolve()
        }
        onRename={() => onRename(chapter)}
        onDelete={() => onDelete(chapter)}
        isSummarizing={isSummarizing && isActionable}
        isDeleting={isDeleting}
        portalled={false}
      />
    </HStack>
  );
}
