import { Input, Stack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Button, Dialog, Field } from "@/components/ui";
import { useChapterActions } from "@/features/scenario-player/hooks/use-chapter-actions";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useChapterRenameDialogStore } from "@/features/scenario-player/stores/chapter-rename-dialog-store";
import { showSuccessToast } from "@/lib/error-handling";

export function ChapterRenameDialog() {
  const eventId = useChapterRenameDialogStore((s) => s.eventId);
  const closeDialog = useChapterRenameDialogStore((s) => s.closeDialog);
  const { chaptersByEventId } = useScenarioContext();
  const { renameChapter, isRenamingChapter } = useChapterActions();

  const chapter = eventId ? chaptersByEventId[eventId] : null;
  const [value, setValue] = useState(chapter?.title ?? "");

  useEffect(() => {
    setValue(chapter?.title ?? "");
  }, [chapter?.title]);

  const isOpen = !!eventId;

  const handleSubmit = async () => {
    if (!eventId) return;
    const nextTitle = value.trim();
    await renameChapter({ eventId, title: nextTitle });
    showSuccessToast({ title: "Chapter renamed" });
    closeDialog();
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => {
        if (!details.open) closeDialog();
      }}
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
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter chapter title"
                autoFocus
              />
            </Field>
          </Stack>
        </Dialog.Body>
        <Dialog.Footer display="flex" justifyContent="flex-end" gap="2">
          <Button variant="ghost" size="sm" onClick={closeDialog} disabled={isRenamingChapter}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={isRenamingChapter}>
            Save
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
