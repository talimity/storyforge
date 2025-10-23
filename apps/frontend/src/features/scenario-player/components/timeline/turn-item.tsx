import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { TimelineTurn } from "@storyforge/contracts";
import { type ReactNode, useCallback, useMemo } from "react";
import { LuGhost } from "react-icons/lu";
import { useInView } from "react-intersection-observer";
import { Avatar, Button, StreamingMarkdown, Tooltip } from "@/components/ui";
import { IntentProvenanceIndicator } from "@/features/scenario-player/components/timeline/intent-provenance-indicator";
import { getIntentProvenanceDisplay } from "@/features/scenario-player/components/timeline/intent-provenance-utils";
import { useBranchPreview } from "@/features/scenario-player/hooks/use-branch-preview";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import {
  selectIsGenerating,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";
import {
  selectOverlayForTurn,
  useTurnUiStore,
} from "@/features/scenario-player/stores/turn-ui-store";
import { getApiUrl } from "@/lib/get-api-url";
import { DeleteOverlay } from "./delete-overlay";
import { TurnActions } from "./turn-actions";
import { TurnEditor } from "./turn-editor";
import { TurnHeader } from "./turn-header";

export interface TurnItemProps {
  turn: TimelineTurn;
  prevTurn: TimelineTurn | null;
  nextTurn: TimelineTurn | null;
}

export function TurnItem({ turn, prevTurn, nextTurn }: TurnItemProps) {
  const editingTurnId = useTurnUiStore((state) => state.editingTurnId);
  const overlay = useTurnUiStore(selectOverlayForTurn(turn.id));

  const isEditing = editingTurnId === turn.id;
  const { getCharacterByParticipantId, participantsById } = useScenarioContext();
  const authorChar = getCharacterByParticipantId(turn.authorParticipantId);
  const authorName = authorChar?.name ?? "Narrator";
  const avatarSrc = getApiUrl(authorChar?.avatarPath ?? undefined);
  const participant = participantsById[turn.authorParticipantId];
  const dialogueColor = participant?.color
    ? participant.color.toLowerCase()
    : (authorChar?.defaultColor?.toLowerCase() ?? null);

  const isGenerating = useIntentRunsStore(selectIsGenerating);
  const { isPreviewing, previewSibling } = useBranchPreview();
  const { ref, inView } = useInView({ triggerOnce: true });

  const provenanceDisplay = useMemo(
    () => getIntentProvenanceDisplay(turn, prevTurn, nextTurn),
    [turn, prevTurn, nextTurn]
  );

  const handleSwipe = useCallback(
    async (dir: "left" | "right") => {
      if (isGenerating) return;
      const siblingId = dir === "left" ? turn.swipes?.leftTurnId : turn.swipes?.rightTurnId;
      await previewSibling(siblingId, turn.id);
    },
    [isGenerating, previewSibling, turn.swipes, turn.id]
  );

  const shouldRenderActions = isEditing || inView;
  const isDeleteOverlayActive = overlay?.mode === "delete";

  const tintCss = useMemo(() => {
    const resolvedDialogueColor =
      typeof dialogueColor === "string" ? dialogueColor : "var(--chakra-colors-fg-emphasized)";
    return { "--input-color": resolvedDialogueColor };
  }, [dialogueColor]);

  const headerMetadata = useMemo(() => {
    const items: ReactNode[] = [
      <Tooltip key="turn-no" content={turn.createdAt.toLocaleString() ?? "Unknown"}>
        <Text fontSize="xs" layerStyle="tinted.muted">
          #{turn.turnNo}
        </Text>
      </Tooltip>,
    ];

    if (inView && turn.isGhost) {
      items.push(
        <Text as="span" fontSize="xs" color="content.muted" key="ghost">
          <Tooltip
            content={
              "This turn is not included in prompts or factored into the timeline's current state."
            }
          >
            <LuGhost aria-label="Ghost turn" />
          </Tooltip>
        </Text>
      );
    }

    if (inView && provenanceDisplay) {
      items.push(<IntentProvenanceIndicator key="provenance" display={provenanceDisplay} />);
    }

    return items;
  }, [inView, provenanceDisplay, turn.createdAt, turn.isGhost, turn.turnNo]);

  return (
    <Box
      as="article"
      position="relative"
      layerStyle="surface"
      p={4}
      borderRadius="md"
      data-turn-id={turn.id}
      data-testid="turn-item"
      opacity={turn.isGhost ? 0.5 : 1}
      ref={ref}
      css={tintCss}
    >
      <Stack gap={2} pointerEvents={isDeleteOverlayActive ? "none" : undefined}>
        <TurnHeader
          avatar={
            avatarSrc ? (
              <Avatar
                shape="rounded"
                layerStyle="surface"
                size="md"
                name={authorName}
                src={avatarSrc}
              />
            ) : null
          }
          title={authorName}
          metadata={headerMetadata}
          rightSlot={
            shouldRenderActions ? (
              <TurnActions turn={turn} isPreviewing={isPreviewing} isGenerating={isGenerating} />
            ) : null
          }
        />

        {isEditing ? (
          <TurnEditor turnId={turn.id} originalContent={turn.content.text} />
        ) : (
          <StreamingMarkdown
            text={turn.content.text}
            dialogueAuthorId={authorChar?.id ?? null}
            dialogueTintColor={dialogueColor}
            data-testid="turn-content"
          />
        )}

        {turn.swipes && turn.swipes.swipeCount > 1 && (
          <HStack gap={2}>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => handleSwipe("left")}
              disabled={isGenerating || !turn.swipes.leftTurnId}
              aria-label="View previous alternate"
            >
              {"<"}
            </Button>
            <Text fontSize="xs" color="content.muted">
              {turn.swipes.swipeNo} / {turn.swipes.swipeCount}
            </Text>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => handleSwipe("right")}
              disabled={isGenerating || !turn.swipes.rightTurnId}
              aria-label="View next alternate"
            >
              {">"}
            </Button>
          </HStack>
        )}
      </Stack>
      {overlay?.mode === "delete" ? <DeleteOverlay turnId={turn.id} /> : null}
    </Box>
  );
}
