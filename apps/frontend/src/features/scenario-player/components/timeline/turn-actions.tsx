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
import { isDefined } from "@storyforge/utils";
import { useMutation } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
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
import { useScenarioDataInvalidator } from "@/features/scenario-player/hooks/use-scenario-data-invalidator";
import { useScenarioIntentActions } from "@/features/scenario-player/hooks/use-scenario-intent-actions";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import {
  isPinnableTurnAction,
  selectPinnedQuickActions,
  usePlayerPreferencesStore,
} from "@/features/scenario-player/stores/player-preferences-store";
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
  const { scenario } = useScenarioContext();
  const { insertChapterAtTurn, isInsertingChapter } = useChapterActions();
  const { insertTurnAfter } = useScenarioIntentActions();
  const { invalidateCore } = useScenarioDataInvalidator();

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
        void invalidateCore();
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
        void invalidateCore();
      },
    })
  );

  const isMobile = useBreakpointValue({ base: true, md: false });
  const buttonSize = isMobile ? "sm" : "xs";
  const isRetryAvailable = Boolean(turn.parentTurnId);

  const handleStartEdit = () => {
    startEditing(turn.id, turn.content.text);
  };

  const handleSave = () => {
    if (!isDirty) {
      stopEditing();
      return;
    }
    updateTurnMutation.mutate({ turnId: turn.id, content: editedContent });
  };

  const handleCancel = () => {
    if (!isDirty) {
      stopEditing();
      return;
    }
    setShowDiscardDialog(true);
  };

  const handleConfirmDiscard = () => {
    setEditedContent(turn.id, turn.content.text);
    setShowDiscardDialog(false);
    stopEditing();
  };

  const handleRetry = () => {
    if (!isRetryAvailable || isGenerating) return;
    openRetryOverlay({
      turnId: turn.id,
      branchFromTurnId: turn.parentTurnId,
      cutoffTurnId: turn.id,
    });
  };

  const handleInsertChapterBreak = async () => {
    if (isGenerating) return;
    try {
      await insertChapterAtTurn({ turnId: turn.id });
      showSuccessToast({ title: "Chapter break inserted" });
    } catch (error) {
      showErrorToast({ title: "Failed to insert chapter break", error });
    }
  };

  const handleToggleGhost = () => {
    toggleGhostMutation.mutate({ turnId: turn.id, isGhost: !turn.isGhost });
  };

  const handleManualInsertSubmit = async (input: { authorParticipantId: string; text: string }) => {
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
  };

  const actionDefinitions: ActionDefinition[] = [
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
      slots: ["quick", "menu"],
      kind: "item",
      color: "fg.error",
      onSelect: () => openDeleteOverlay(turn.id),
    },
    { id: "separator-info", slots: ["menu"], kind: "separator" },
    {
      id: "generation-info",
      label: "Gen Info",
      icon: <LuInfo />,
      slots: ["quick", "menu"],
      kind: "item",
      disabled: !turn.provenance,
      onSelect: () => setShowGenerationInfo(true),
    },
  ];

  const pinnedQuickActions = usePlayerPreferencesStore(selectPinnedQuickActions);
  const quickActions = pinnedQuickActions
    .map((actionId) =>
      actionDefinitions.find((action) => action.kind === "item" && action.id === actionId)
    )
    .filter(isDefined);

  const quickActionIds = new Set(pinnedQuickActions);
  const isPinnedQuickAction = (actionId: string) =>
    isPinnableTurnAction(actionId) && quickActionIds.has(actionId);

  const rawMenuActions = actionDefinitions.filter((action) => {
    if (!action.slots.includes("menu")) return false;
    return !(action.kind === "item" && isPinnedQuickAction(action.id));
  });

  const menuActions: ActionDefinition[] = [];
  let pendingSeparator: ActionDefinition | null = null;

  for (const action of rawMenuActions) {
    if (action.kind === "separator") {
      pendingSeparator = action;
      continue;
    }

    if (pendingSeparator) {
      if (menuActions.length > 0) {
        menuActions.push(pendingSeparator);
      }
      pendingSeparator = null;
    }

    if (action.kind === "submenu") {
      const submenuChildren = action.children?.filter((child) => {
        if (!child.slots.includes("menu")) return false;
        return !(child.kind === "item" && isPinnedQuickAction(child.id));
      });

      if (submenuChildren === undefined || submenuChildren.length === 0) {
        continue;
      }

      menuActions.push({ ...action, children: submenuChildren });
      continue;
    }

    menuActions.push(action);
  }

  const dialogs = (
    <>
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
        isOpen={Boolean(manualInsertTurn)}
        turn={manualInsertTurn}
        onSubmit={handleManualInsertSubmit}
        onClose={closeManualInsert}
      />
    </>
  );

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
        {dialogs}
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
            layerStyle="tinted.subtle"
            onClick={action.onSelect}
            disabled={action.disabled || isPreviewing}
            aria-label={action.label || action.id}
          >
            {action.icon}
          </IconButton>
        ))}
        {menuActions.length > 0 ? (
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
                layerStyle="tinted.subtle"
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
        ) : null}
      </HStack>
      {dialogs}
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
