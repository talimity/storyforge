import { Box, HStack, Stack, Text } from "@chakra-ui/react";
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
    recoverable,
  } = useDraftPreview();
  const [showInternal, setShowInternal] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    void runId;
    setShowInternal(false);
  }, [runId]);

  const author = getCharacterByParticipantId(authorId);
  const defaultName = mode === "recoverable" ? "Recovered turn" : "Generating";
  const authorName = author?.name ?? defaultName;
  const avatarSrc = getApiUrl(author?.avatarPath ?? undefined);
  const tintColor = author?.defaultColor.toLowerCase();
  const shouldShowText = mode === "recoverable" ? true : isPresentation || showInternal;
  const statusHint =
    mode === "recoverable"
      ? recoverable?.source === "cancelled"
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
    recoverable !== null &&
    recoverable.actorParticipantId !== null &&
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
      !recoverable ||
      recoverable.actorParticipantId === null ||
      previewText.trim().length === 0
    ) {
      return;
    }

    setIsConverting(true);
    try {
      const text = previewText.trim();
      const baseInput = {
        scenarioId: scenario.id,
        text,
        authorParticipantId: recoverable.actorParticipantId,
      };
      const input =
        recoverable.branchFromTurnId && recoverable.branchFromTurnId.length > 0
          ? { ...baseInput, parentTurnId: recoverable.branchFromTurnId }
          : baseInput;
      await addTurn(input);
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
    recoverable,
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
            <StreamingMarkdown text={previewText} dialogueAuthorId={author?.id ?? null} />
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
  authorId: string | null;
  previewText: string;
  isPresentation: boolean;
  charCount: number;
  error?: string;
  recoverable: RecoverableDraft | null;
};

function useDraftPreview(): DraftPreviewState {
  return useIntentRunsStore(
    useShallow((s): DraftPreviewState => {
      const fallback: DraftPreviewState = {
        runId: "",
        isVisible: false,
        mode: "inactive",
        authorId: null,
        previewText: "",
        isPresentation: true,
        charCount: 0,
        error: undefined,
        recoverable: null,
      };
      const id = s.currentRunId;
      if (!id) {
        return fallback;
      }

      const run = s.runsById[id];
      if (!run) {
        return fallback;
      }

      const hasRecovery = Boolean(run.pendingRecovery);
      const isGenerating = run.status === "pending" || run.status === "running";
      const mode = hasRecovery ? "recoverable" : isGenerating ? "generating" : "inactive";

      if (mode === "inactive") {
        return {
          runId: id,
          isVisible: false,
          mode,
          authorId: null,
          previewText: "",
          isPresentation: true,
          charCount: 0,
          error: undefined,
          recoverable: null,
        };
      }

      const last = run.provisional[run.provisional.length - 1];
      const previewSource =
        run.displayPresentationPreview || run.displayPreview || last?.text || "";
      const previewText = hasRecovery
        ? (run.pendingRecovery?.text ?? "").trim()
        : previewSource.trim();

      return {
        runId: id,
        isVisible: true,
        mode,
        authorId: hasRecovery
          ? (run.pendingRecovery?.actorParticipantId ?? null)
          : (run.currentActorParticipantId ?? null),
        previewText,
        isPresentation: hasRecovery ? true : (run.lastTokenIsPresentation ?? true),
        charCount: run.displayCharCount ?? 0,
        error: hasRecovery ? (run.pendingRecovery?.error ?? run.error) : undefined,
        recoverable: run.pendingRecovery ?? null,
      };
    })
  );
}
