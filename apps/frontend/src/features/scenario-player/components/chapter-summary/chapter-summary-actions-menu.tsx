import { Box, IconButton, Menu, Portal, Spinner } from "@chakra-ui/react";
import type { ChapterSummaryStatus } from "@storyforge/contracts";
import {
  LuEllipsisVertical,
  LuFileText,
  LuPencilLine,
  LuRefreshCcw,
  LuTrash,
} from "react-icons/lu";

type ChapterSummaryActionsMenuProps = {
  status?: ChapterSummaryStatus;
  onOpenSummary: () => void;
  onSummarize: (force?: boolean) => void;
  onRename?: () => void;
  onDelete?: () => void;
  isSummarizing?: boolean;
  isDisabled?: boolean;
  isDeleting?: boolean;
  portalled?: boolean;
};

function getLabelForState(state: ChapterSummaryStatus["state"]) {
  switch (state) {
    case "missing":
      return "Generate Summary";
    case "running":
      return "Summarizing...";
    case "ready":
      return "Regenerate Summary";
    case "error":
      return "Retry Summarization";
    case "current":
      return "Current Chapter";
    default:
      return "Regenerate Summary";
  }
}

export function ChapterSummaryActionsMenu(props: ChapterSummaryActionsMenuProps) {
  const {
    status,
    onOpenSummary,
    onSummarize,
    onRename,
    onDelete,
    isSummarizing = false,
    isDisabled = false,
    isDeleting = false,
    portalled = true,
  } = props;

  const summarizeState = status?.state ?? "missing";
  const summarizeLabel = getLabelForState(summarizeState);
  const shouldForce = summarizeState === "ready";
  const isRunning = summarizeState === "running" || isSummarizing;
  const hasClosingEvent = Boolean(status?.closingEventId);
  const isCurrentChapter = status?.state === "current";
  const canSummarize = isCurrentChapter || !hasClosingEvent;

  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton
          variant="ghost"
          size="xs"
          aria-label="Chapter actions"
          disabled={isDisabled}
          onClick={(event) => event.stopPropagation()}
        >
          <LuEllipsisVertical />
        </IconButton>
      </Menu.Trigger>
      <Portal disabled={!portalled}>
        <Menu.Positioner>
          <Menu.Content>
            {!canSummarize && (
              <>
                <Menu.Item value="summary" disabled={isDisabled} onSelect={onOpenSummary}>
                  <LuFileText />
                  <Box flex="1">View / Edit Summary</Box>
                </Menu.Item>
                <Menu.Item
                  value="summarize"
                  disabled={isDisabled || isRunning}
                  onSelect={() => onSummarize(shouldForce)}
                >
                  {isRunning ? <Spinner size="xs" /> : <LuRefreshCcw />}
                  <Box flex="1">{summarizeLabel}</Box>
                </Menu.Item>
              </>
            )}
            {onRename ? (
              <Menu.Item value="rename" onSelect={onRename}>
                <LuPencilLine />
                <Box flex="1">Rename</Box>
              </Menu.Item>
            ) : null}
            {onDelete ? (
              <Menu.Item
                value="delete"
                color="fg.error"
                _hover={{ bg: "bg.error", color: "fg.error" }}
                onSelect={onDelete}
                disabled={isDeleting}
              >
                <LuTrash />
                <Box flex="1">Delete</Box>
              </Menu.Item>
            ) : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
