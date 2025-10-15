import {
  Box,
  HStack,
  IconButton,
  Menu,
  MenuSeparator,
  Portal,
  useBreakpointValue,
} from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import {
  LuCheck,
  LuChevronRight,
  LuEllipsisVertical,
  LuFilePlus,
  LuGhost,
  LuInfo,
  LuListEnd,
  LuMoveDown,
  LuMoveUp,
  LuPencil,
  LuRefreshCw,
  LuTableOfContents,
  LuTrash,
  LuX,
} from "react-icons/lu";
import { DiscardChangesDialog } from "@/components/dialogs/discard-changes-dialog";
import { GenerationInfoDialog } from "@/features/scenario-player/components/timeline/generation-info-dialog.js";
import { InsertTurnDialog } from "@/features/scenario-player/components/timeline/insert-turn-dialog";
import { useChapterActions } from "@/features/scenario-player/hooks/use-chapter-actions";
import { useScenarioIntentActions } from "@/features/scenario-player/hooks/use-scenario-intent-actions";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import {
  selectEditedContentForTurn,
  useTurnUiStore,
} from "@/features/scenario-player/stores/turn-ui-store";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

interface TurnActionsProps {
  turn: TimelineTurn;
  isPreviewing: boolean;
  isGenerating: boolean;
}

type ActionSlot = "quick" | "menu";
type ActionKind = "item" | "submenu" | "separator";

type ActionDefinition = {
  id: string;
  label?: string;
  icon?: ReactNode;
  slots: ActionSlot[];
  disabled?: boolean;
  onSelect?: () => void;
  kind: ActionKind;
  color?: string;
  children?: ActionDefinition[];
};

export function TurnActions({ turn, isPreviewing, isGenerating }: TurnActionsProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { scenario } = useScenarioContext();
  const { insertChapterAtTurn, isInsertingChapter } = useChapterActions();
  const { insertTurnAfter } = useScenarioIntentActions();

  const editingTurnId = useTurnUiStore((state) => state.editingTurnId);
  const startEditing = useTurnUiStore((state) => state.startEditing);
  const stopEditing = useTurnUiStore((state) => state.stopEditing);
  const setEditedContent = useTurnUiStore((state) => state.setEditedContent);
  const openDeleteOverlay = useTurnUiStore((state) => state.openDeleteOverlay);
  const openRetryOverlay = useTurnUiStore((state) => state.openRetryOverlay);
  const openManualInsert = useTurnUiStore((state) => state.openManualInsert);
  const closeManualInsert = useTurnUiStore((state) => state.closeManualInsert);
  const manualInsertTargetId = useTurnUiStore((state) => state.manualInsertTargetId);
  const manualInsertTurn = manualInsertTargetId === turn.id ? turn : null;

  const editedContent = useTurnUiStore(selectEditedContentForTurn(turn.id, turn.content.text));
  const isEditing = editingTurnId === turn.id;
  const isDirty = editedContent !== turn.content.text;

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showGenerationInfo, setShowGenerationInfo] = useState(false);

  const updateTurnMutation = useMutation(
    trpc.timeline.updateTurnContent.mutationOptions({
      onError: (error) => {
        showErrorToast({ title: "Failed to save changes", error });
      },
      onSuccess: () => {
        showSuccessToast({ title: "Turn updated", description: "Changes saved." });
        qc.invalidateQueries(trpc.timeline.window.pathFilter());
        stopEditing();
      },
    })
  );

  const toggleGhostMutation = useMutation(
    trpc.timeline.setTurnGhost.mutationOptions({
      onError: (error) => {
        showErrorToast({ title: "Failed to toggle ghost state", error });
      },
      onSuccess: (_data, variables) => {
        showSuccessToast({
          title: variables.isGhost ? "Turn ghosted" : "Turn restored",
          description: variables.isGhost
            ? "Turn will be skipped in prompts and scenario state."
            : "Turn will be included in prompts and scenario state again.",
        });
        qc.invalidateQueries(trpc.timeline.window.pathFilter());
        qc.invalidateQueries(trpc.timeline.state.pathFilter());
      },
    })
  );

  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
  const buttonSize = isMobile ? "sm" : "2xs";
  const isRetryAvailable = Boolean(turn.parentTurnId);

  const handleStartEdit = useCallback(() => {
    startEditing(turn.id, turn.content.text);
  }, [startEditing, turn.content.text, turn.id]);

  const handleSave = useCallback(() => {
    if (!isDirty) {
      stopEditing();
      return;
    }
    updateTurnMutation.mutate({ turnId: turn.id, content: editedContent });
  }, [editedContent, isDirty, stopEditing, turn.id, updateTurnMutation]);

  const handleCancel = useCallback(() => {
    if (!isDirty) {
      stopEditing();
      return;
    }
    setShowDiscardDialog(true);
  }, [isDirty, stopEditing]);

  const handleConfirmDiscard = useCallback(() => {
    setEditedContent(turn.id, turn.content.text);
    setShowDiscardDialog(false);
    stopEditing();
  }, [setEditedContent, stopEditing, turn.content.text, turn.id]);

  const handleRetry = useCallback(() => {
    if (!isRetryAvailable || isGenerating) return;
    openRetryOverlay({
      turnId: turn.id,
      branchFromTurnId: turn.parentTurnId,
      cutoffTurnId: turn.id,
    });
  }, [isGenerating, isRetryAvailable, openRetryOverlay, turn.id, turn.parentTurnId]);

  const handleInsertChapterBreak = useCallback(async () => {
    if (isGenerating) return;
    try {
      await insertChapterAtTurn({ turnId: turn.id });
      showSuccessToast({ title: "Chapter break inserted" });
    } catch (error) {
      showErrorToast({ title: "Failed to insert chapter break", error });
    }
  }, [insertChapterAtTurn, isGenerating, turn.id]);

  const handleToggleGhost = useCallback(() => {
    toggleGhostMutation.mutate({ turnId: turn.id, isGhost: !turn.isGhost });
  }, [toggleGhostMutation, turn.id, turn.isGhost]);

  const handleManualInsertSubmit = useCallback(
    async (input: { authorParticipantId: string; text: string }) => {
      if (!manualInsertTurn) return;
      try {
        await insertTurnAfter({
          scenarioId: scenario.id,
          targetTurnId: manualInsertTurn.id,
          authorParticipantId: input.authorParticipantId,
          text: input.text,
        });
        showSuccessToast({
          title: "Turn inserted",
          description: "Manual turn added to the timeline.",
        });
        closeManualInsert();
      } catch (error) {
        showErrorToast({ title: "Failed to insert turn", error });
      }
    },
    [closeManualInsert, insertTurnAfter, manualInsertTurn, scenario.id]
  );

  const actionDefinitions: ActionDefinition[] = useMemo(
    () => [
      {
        id: "edit",
        label: "Edit",
        icon: <LuPencil />,
        slots: ["quick", "menu"],
        kind: "item",
        disabled: isEditing || isPreviewing || isGenerating,
        onSelect: handleStartEdit,
      },
      {
        id: "retry",
        label: "Retry",
        icon: <LuRefreshCw />,
        slots: ["quick", "menu"],
        kind: "item",
        disabled: !isRetryAvailable || isGenerating,
        onSelect: handleRetry,
      },
      { id: "separator-actions", slots: ["menu"], kind: "separator" },
      {
        id: "move-up",
        label: "Move Up",
        icon: <LuMoveUp />,
        slots: ["menu"],
        kind: "item",
        disabled: true,
        onSelect: () => {},
      },
      {
        id: "move-down",
        label: "Move Down",
        icon: <LuMoveDown />,
        slots: ["menu"],
        kind: "item",
        disabled: true,
        onSelect: () => {},
      },
      {
        id: "insert",
        label: "Insert",
        icon: <LuListEnd />,
        slots: ["menu"],
        kind: "submenu",
        children: [
          {
            id: "manual-insert",
            label: "Manual Turn",
            icon: <LuFilePlus />,
            slots: ["menu"],
            kind: "item",
            disabled: isGenerating,
            onSelect: () => openManualInsert(turn.id),
          },
          {
            id: "chapter-break",
            label: "Chapter Separator",
            icon: <LuTableOfContents />,
            slots: ["menu"],
            kind: "item",
            disabled: isInsertingChapter || isGenerating,
            onSelect: () => {
              void handleInsertChapterBreak();
            },
          },
        ],
      },
      { id: "separator-ghost", slots: ["menu"], kind: "separator" },
      {
        id: "toggle-ghost",
        label: turn.isGhost ? "Restore Turn" : "Ghost Turn",
        icon: <LuGhost />,
        slots: ["menu"],
        kind: "item",
        disabled: toggleGhostMutation.isPending,
        onSelect: handleToggleGhost,
      },
      { id: "separator-delete", slots: ["menu"], kind: "separator" },
      {
        id: "delete",
        label: "Delete…",
        icon: <LuTrash />,
        slots: ["menu"],
        kind: "item",
        color: "fg.error",
        onSelect: () => openDeleteOverlay(turn.id),
      },
      { id: "separator-info", slots: ["menu"], kind: "separator" },
      {
        id: "generation-info",
        label: "Gen Info",
        icon: <LuInfo />,
        slots: ["menu"],
        kind: "item",
        disabled: !turn.provenance,
        onSelect: () => setShowGenerationInfo(true),
      },
    ],
    [
      handleInsertChapterBreak,
      handleRetry,
      handleStartEdit,
      handleToggleGhost,
      isGenerating,
      isInsertingChapter,
      isPreviewing,
      isEditing,
      isRetryAvailable,
      openDeleteOverlay,
      openManualInsert,
      toggleGhostMutation.isPending,
      turn.id,
      turn.isGhost,
      turn.provenance,
    ]
  );

  const quickActions = !isMobile
    ? actionDefinitions.filter((action) => action.kind === "item" && action.slots.includes("quick"))
    : [];

  const menuActions = actionDefinitions.filter((action) => action.slots.includes("menu"));

  if (isEditing) {
    return (
      <>
        <HStack gap={1}>
          <IconButton
            size={buttonSize}
            variant="ghost"
            colorPalette="green"
            onClick={handleSave}
            aria-label="Save changes"
            disabled={updateTurnMutation.isPending}
            loading={updateTurnMutation.isPending}
          >
            <LuCheck />
          </IconButton>
          <IconButton
            size={buttonSize}
            variant="ghost"
            colorPalette="red"
            onClick={handleCancel}
            aria-label="Cancel editing"
            disabled={updateTurnMutation.isPending}
          >
            <LuX />
          </IconButton>
        </HStack>
        <DiscardChangesDialog
          isOpen={showDiscardDialog}
          onOpenChange={(details) => setShowDiscardDialog(details.open)}
          onConfirm={handleConfirmDiscard}
        />
        <GenerationInfoDialog
          turnId={turn.id}
          isOpen={showGenerationInfo}
          onOpenChange={(details) => setShowGenerationInfo(details.open)}
        />
        <InsertTurnDialog
          isOpen={!!manualInsertTurn}
          turn={manualInsertTurn}
          onSubmit={handleManualInsertSubmit}
          onClose={closeManualInsert}
        />
      </>
    );
  }

  return (
    <>
      <HStack gap={2} _hover={{ opacity: 1 }} opacity={0.6}>
        {quickActions.map((action) => (
          <IconButton
            key={action.id}
            size={buttonSize}
            variant="ghost"
            colorPalette={action.color || "neutral"}
            onClick={action.onSelect}
            disabled={action.disabled || isPreviewing}
            aria-label={action.label || action.id}
          >
            {action.icon}
          </IconButton>
        ))}
        <Menu.Root
          onFocusOutside={(details) => {
            details.preventDefault();
            details.stopPropagation();
          }}
        >
          <Menu.Trigger asChild>
            <IconButton
              size={buttonSize}
              variant="ghost"
              aria-label="More actions"
              disabled={isPreviewing}
            >
              <LuEllipsisVertical />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>{renderMenuActions(menuActions, isPreviewing)}</Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>
      <DiscardChangesDialog
        isOpen={showDiscardDialog}
        onOpenChange={(details) => setShowDiscardDialog(details.open)}
        onConfirm={handleConfirmDiscard}
      />
      <GenerationInfoDialog
        turnId={turn.id}
        isOpen={showGenerationInfo}
        onOpenChange={(details) => setShowGenerationInfo(details.open)}
      />
      {manualInsertTurn ? (
        <InsertTurnDialog
          isOpen
          turn={manualInsertTurn}
          onSubmit={handleManualInsertSubmit}
          onClose={closeManualInsert}
        />
      ) : null}
    </>
  );
}

function renderMenuActions(actions: ActionDefinition[], disableAll: boolean): ReactNode {
  return actions.map((action) => {
    const disabled = action.disabled || disableAll;

    if (action.kind === "separator") {
      return <MenuSeparator key={action.id} />;
    }

    if (action.kind === "submenu" && action.children) {
      return (
        <Menu.Root key={action.id}>
          <Menu.TriggerItem>
            {action.icon}
            <Box flex="1">{action.label}</Box>
            <LuChevronRight />
          </Menu.TriggerItem>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>{renderMenuActions(action.children, disableAll)}</Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      );
    }

    return (
      <Menu.Item
        key={action.id}
        value={action.id}
        onSelect={action.onSelect}
        disabled={disabled}
        color={action.color}
      >
        {action.icon}
        <Box flex="1">{action.label}</Box>
      </Menu.Item>
    );
  });
}
