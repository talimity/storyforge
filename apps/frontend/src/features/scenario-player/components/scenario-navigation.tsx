import {
  Box,
  HStack,
  IconButton,
  Input,
  Menu,
  Popover,
  Portal,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useState } from "react";
import {
  LuChevronDown,
  LuEllipsisVertical,
  LuPencilLine,
  LuPlus,
  LuTableOfContents,
  LuTrash,
} from "react-icons/lu";
import { Button, Dialog, EmptyState, Field } from "@/components/ui";
import { useChapterActions } from "@/features/scenario-player/hooks/use-chapter-actions";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import {
  selectIsGenerating,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { showSuccessToast } from "@/lib/error-handling";

type ChapterItem = ReturnType<typeof useScenarioContext>["chapters"][number];

export function ScenarioNavigation() {
  const { scenario, chapters, deriveChapterLabel } = useScenarioContext();

  const latestChapter = chapters.at(-1);
  const chapterLabel = latestChapter ? deriveChapterLabel(latestChapter) : null;
  const headerLabel = chapterLabel ? `${scenario.title} – ${chapterLabel}` : scenario.title;

  const {
    insertChapterAtTurn,
    renameChapter,
    deleteChapter,
    isInsertingChapter,
    isRenamingChapter,
  } = useChapterActions();

  const {
    open: isRenameDialogOpen,
    onOpen: openRenameDialog,
    onClose: closeRenameDialog,
  } = useDisclosure();
  const [renameTarget, setRenameTarget] = useState<ChapterItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const openRename = (chapter: ChapterItem) => {
    setRenameTarget(chapter);
    setRenameValue(chapter.title ?? "");
    openRenameDialog();
  };

  const handleRenameSubmit = async () => {
    if (!renameTarget) return;
    const nextTitle = renameValue.trim();

    await renameChapter({ eventId: renameTarget.eventId, title: nextTitle });
    showSuccessToast({ title: "Chapter renamed" });
    closeRenameDialog();
    setRenameTarget(null);
  };

  return (
    <>
      <Popover.Root positioning={{ placement: "bottom", gutter: 4 }} lazyMount unmountOnExit>
        <Popover.Trigger asChild>
          <Button position="relative" variant="ghost">
            <Text fontWeight="medium" fontSize="sm" lineClamp={1}>
              {headerLabel}
            </Text>
            <LuChevronDown />
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Arrow />
              <Popover.Body>
                <Popover.Title textStyle="heading">Chapter Outline</Popover.Title>
                <ChapterList
                  handleRename={openRename}
                  insertChapterAtTurn={insertChapterAtTurn}
                  deleteChapter={deleteChapter}
                  isInsertingChapter={isInsertingChapter}
                />
              </Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>

      <RenameChapterDialog
        isOpen={isRenameDialogOpen}
        onClose={() => {
          closeRenameDialog();
          setRenameTarget(null);
        }}
        value={renameValue}
        onChange={setRenameValue}
        onSubmit={handleRenameSubmit}
        isSubmitting={isRenamingChapter}
      />
    </>
  );
}

function ChapterList({
  handleRename,
  insertChapterAtTurn,
  deleteChapter,
  isInsertingChapter,
}: {
  handleRename: (chapter: ChapterItem) => void;
  insertChapterAtTurn: ReturnType<typeof useChapterActions>["insertChapterAtTurn"];
  deleteChapter: ReturnType<typeof useChapterActions>["deleteChapter"];
  isInsertingChapter: ReturnType<typeof useChapterActions>["isInsertingChapter"];
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
      <Stack gap="0" py="2">
        {chapters.length === 0 && (
          <EmptyState
            icon={<LuTableOfContents />}
            title="No chapters yet"
            description="Use chapters to organize your scenario and generate summaries to reduce token usage."
          />
        )}

        {chapters.map((chapter: ChapterItem) => (
          <ChapterRow
            key={chapter.eventId}
            chapter={chapter}
            onSelect={handleSelect}
            onRename={handleRename}
            onDelete={handleDelete}
            label={deriveChapterLabel(chapter)}
          />
        ))}
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
  onSelect,
  onRename,
  onDelete,
  label,
}: {
  chapter: ChapterItem;
  onSelect: (chapter: ChapterItem) => void;
  onRename: (chapter: ChapterItem) => void;
  onDelete: (chapter: ChapterItem) => void;
  label: string;
}) {
  return (
    <Button
      asChild
      size="sm"
      variant="ghost"
      colorPalette="neutral"
      justifyContent="space-between"
      alignItems="center"
      w="full"
      onClick={() => onSelect(chapter)}
    >
      <HStack>
        <Text fontSize="sm" fontWeight="medium" lineClamp={1}>
          {label}
        </Text>

        <Menu.Root positioning={{ placement: "bottom-end" }}>
          <Menu.Trigger asChild>
            <IconButton
              variant="ghost"
              size="xs"
              onClick={(event) => event.stopPropagation()}
              aria-label="Chapter actions"
            >
              <LuEllipsisVertical />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            {/* additional z-index hack needed because of apparent chakra bug with popover/menu nesting */}
            <Menu.Positioner zIndex="popover !important">
              <Menu.Content>
                <Menu.Item value="rename" onSelect={() => onRename(chapter)}>
                  <LuPencilLine />
                  <Box flex="1">Rename</Box>
                </Menu.Item>
                <Menu.Item
                  value="delete"
                  color="fg.error"
                  _hover={{ bg: "bg.error", color: "fg.error" }}
                  onSelect={() => onDelete(chapter)}
                >
                  <LuTrash />
                  <Box flex="1">Delete</Box>
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>
    </Button>
  );
}

function RenameChapterDialog({
  isOpen,
  onClose,
  value,
  onChange,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => !details.open && onClose()}
      placement="center"
    >
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Rename Chapter</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Stack>
            <Field label="Chapter title">
              <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Enter chapter title"
                autoFocus
              />
            </Field>
          </Stack>
        </Dialog.Body>
        <Dialog.Footer display="flex" justifyContent="flex-end" gap="2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} loading={isSubmitting}>
            Save
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
