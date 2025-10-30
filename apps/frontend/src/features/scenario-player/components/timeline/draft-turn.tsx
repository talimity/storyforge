import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { assertDefined } from "@storyforge/utils";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Avatar, Button, StreamingMarkdown } from "@/components/ui";
import { AutoFollowOnDraft } from "@/features/scenario-player/components/timeline/auto-follow-draft";
import { useScenarioIntentActions } from "@/features/scenario-player/hooks/use-scenario-intent-actions";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import {
  type RecoverableDraft,
  useIntentRunsStore,
} from "@/features/scenario-player/stores/intent-run-store";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { showErrorToast } from "@/lib/error-handling";
import { getApiUrl } from "@/lib/get-api-url";
import { TurnHeader } from "./turn-header";

// chakra avatar is kind of heavy so we don't want to render on every token
const MemoAvatar = memo(Avatar, (prev, next) => prev.src === next.src);

export function DraftTurn() {
  const { scenario, getCharacterByParticipantId } = useScenarioContext();
  const { addTurn } = useScenarioIntentActions();
  const clearRun = useIntentRunsStore((state) => state.clearRun);
  const setPendingScrollTarget = useScenarioPlayerStore((s) => s.setPendingScrollTarget);
  const {
    runId,
    isVisible,
    mode,
    authorId,
    previewText,
    isPresentation,
    charCount,
    error,
    recoverableDraft,
  } = useDraftPreview();
  const [showInternal, setShowInternal] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    void runId;
    setShowInternal(false);
  }, [runId]);

  const author = getCharacterByParticipantId(authorId);
  const authorName = author?.name ?? "Generating";
  const avatarSrc = getApiUrl(author?.avatarPath);
  const tintColor = author?.defaultColor.toLowerCase();
  const shouldShowText = mode === "recoverable" ? true : isPresentation || showInternal;
  const statusHint =
    mode === "recoverable"
      ? recoverableDraft?.source === "cancelled"
        ? "Generation interrupted"
        : "Generation failed"
      : isPresentation
        ? null
        : "Draft";
  const approxTokens =
    mode === "generating" && charCount > 0 ? Math.max(1, Math.round(charCount / 4)) : 0;
  const canToggleInternal = mode === "generating" && !isPresentation;
  const canConvert =
    mode === "recoverable" &&
    recoverableDraft?.actorParticipantId !== null &&
    previewText.trim().length > 0;

  const tintCss = useMemo(() => {
    const resolvedTint =
      typeof tintColor === "string" ? tintColor : "var(--chakra-colors-fg-emphasized)";
    return { "--input-color": resolvedTint };
  }, [tintColor]);

  const handleDismiss = useCallback(() => {
    if (!runId) return;
    clearRun(runId);
  }, [clearRun, runId]);

  const handleConvertToManual = useCallback(async () => {
    if (
      mode !== "recoverable" ||
      !recoverableDraft ||
      recoverableDraft.actorParticipantId === null ||
      previewText.trim().length === 0
    ) {
      return;
    }

    setIsConverting(true);
    try {
      assertDefined(recoverableDraft.actorParticipantId);
      await addTurn({
        scenarioId: scenario.id,
        text: previewText.trim(),
        authorParticipantId: recoverableDraft.actorParticipantId,
        parentTurnId: recoverableDraft.branchFromTurnId,
      });
      setPendingScrollTarget({ kind: "bottom" });
      clearRun(runId);
    } catch (error_) {
      showErrorToast({ title: "Failed to create manual turn", error: error_ });
    } finally {
      setIsConverting(false);
    }
  }, [
    addTurn,
    clearRun,
    mode,
    previewText,
    recoverableDraft,
    runId,
    scenario.id,
    setPendingScrollTarget,
  ]);

  if (!isVisible) {
    return null;
  }

  return (
    <Box
      layerStyle="surface"
      p={4}
      borderRadius="md"
      data-turn-id={runId}
      data-testid="draft-turn-item"
      opacity={0.9}
      borderStyle="dashed"
      css={tintCss}
    >
      <Stack gap={2}>
        <TurnHeader
          avatar={
            avatarSrc ? (
              <MemoAvatar
                shape="rounded"
                layerStyle="surface"
                size="md"
                name={authorName}
                src={avatarSrc}
              />
            ) : null
          }
          title={authorName}
          metadata={[
            <Text fontSize="xs" layerStyle="tinted.muted" key="hint">
              {statusHint}
            </Text>,
          ]}
          rightSlot={
            canToggleInternal ? (
              <Button size="xs" variant="ghost" onClick={() => setShowInternal((v) => !v)}>
                {showInternal ? "Hide draft" : "Show draft"}
              </Button>
            ) : null
          }
        />
        {shouldShowText ? (
          previewText ? (
            <StreamingMarkdown text={previewText} dialogueAuthorId={author?.id} />
          ) : (
            <Text fontSize="md" color="content.muted">
              {mode === "recoverable" ? "No recovered text." : "Thinking…"}
            </Text>
          )
        ) : (
          <Text fontSize="md" color="content.muted">
            {approxTokens > 0 ? `Thinking… (~${approxTokens} tokens)` : "Thinking…"}
          </Text>
        )}

        {mode === "recoverable" && error ? (
          <Text fontSize="sm" color="fg.error">
            {error}
          </Text>
        ) : null}

        {mode === "recoverable" ? (
          <HStack gap={2} justify="space-between" align="center">
            <Button size="xs" variant="ghost" onClick={handleDismiss} disabled={isConverting}>
              Discard
            </Button>
            <Button
              size="xs"
              colorPalette="primary"
              onClick={handleConvertToManual}
              disabled={!canConvert || isConverting}
              loading={isConverting}
            >
              Save
            </Button>
          </HStack>
        ) : (
          <AutoFollowOnDraft />
        )}
      </Stack>
    </Box>
  );
}

type DraftPreviewState = {
  runId: string;
  isVisible: boolean;
  mode: "generating" | "recoverable" | "inactive";
  authorId?: string;
  previewText: string;
  isPresentation: boolean;
  charCount: number;
  error?: string;
  recoverableDraft?: RecoverableDraft;
};

function useDraftPreview(): DraftPreviewState {
  return useIntentRunsStore(
    useShallow((s): DraftPreviewState => {
      const fallback: DraftPreviewState = {
        runId: "",
        isVisible: false,
        mode: "inactive",
        previewText: "",
        isPresentation: true,
        charCount: 0,
        error: undefined,
      };
      const id = s.currentRunId;
      if (!id) {
        return fallback;
      }

      const run = s.runsById[id];
      if (!run) {
        return fallback;
      }

      const recovery = run.pendingRecovery;
      const isGenerating = run.status === "pending" || run.status === "running";
      const mode = recovery ? "recoverable" : isGenerating ? "generating" : "inactive";

      if (mode === "inactive") {
        return {
          runId: id,
          mode,
          previewText: "",
          isVisible: false,
          isPresentation: true,
          charCount: 0,
        };
      }

      const last = run.provisional[run.provisional.length - 1];
      const previewSource =
        run.displayPresentationPreview || run.displayPreview || last?.text || "";
      const previewText = recovery ? recovery.text.trim() : previewSource.trim();

      return {
        runId: id,
        isVisible: true,
        mode,
        authorId: recovery?.actorParticipantId ?? run.currentActorParticipantId,
        previewText,
        isPresentation: recovery ? true : (run.lastTokenIsPresentation ?? true),
        charCount: run.displayCharCount,
        error: recovery?.error ?? run.error,
        recoverableDraft: run.pendingRecovery,
      };
    })
  );
}
