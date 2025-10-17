import { Box, Stack, Text } from "@chakra-ui/react";
import { memo, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Avatar, Button, StreamingMarkdown } from "@/components/ui";
import { AutoFollowOnDraft } from "@/features/scenario-player/components/timeline/auto-follow-draft";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useIntentRunsStore } from "@/features/scenario-player/stores/intent-run-store";
import { getApiUrl } from "@/lib/get-api-url";
import { TurnHeader } from "./turn-header";

// chakra avatar is kind of heavy so we don't want to render on every token
const MemoAvatar = memo(Avatar, (prev, next) => prev.src === next.src);

export function DraftTurn() {
  const { getCharacterByParticipantId } = useScenarioContext();
  const { runId, isActive, authorId, previewText, isPresentation, charCount } = useDraftPreview();
  const [showInternal, setShowInternal] = useState(false);

  useEffect(() => {
    void runId;
    setShowInternal(false);
  }, [runId]);

  const author = authorId ? getCharacterByParticipantId(authorId) : null;
  const authorName = author?.name ?? "Generating";
  const avatarSrc = getApiUrl(author?.avatarPath ?? undefined);
  const tintColor = author?.defaultColor ? author.defaultColor.toLowerCase() : null;
  const shouldShowText = isPresentation || showInternal;
  const hint = isPresentation ? null : "Draft";
  const approxTokens = charCount > 0 ? Math.max(1, Math.round(charCount / 4)) : 0;

  const tintCss = useMemo(() => {
    const resolvedTint =
      typeof tintColor === "string" ? tintColor : "var(--chakra-colors-fg-emphasized)";
    return { "--input-color": resolvedTint };
  }, [tintColor]);

  if (!isActive) return null;

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
              {hint}
            </Text>,
          ]}
          rightSlot={
            !isPresentation ? (
              <Button size="xs" variant="ghost" onClick={() => setShowInternal((v) => !v)}>
                {showInternal ? "Hide draft" : "Show draft"}
              </Button>
            ) : null
          }
        />
        {shouldShowText ? (
          previewText ? (
            <StreamingMarkdown
              text={previewText}
              dialogueAuthorId={author?.id ?? null}
              maxW="85ch"
              size="lg"
            />
          ) : (
            <Text fontSize="md" color="content.muted">
              Thinking…
            </Text>
          )
        ) : (
          <Text fontSize="md" color="content.muted">
            {approxTokens > 0 ? `Thinking… (~${approxTokens} tokens)` : "Thinking…"}
          </Text>
        )}

        <AutoFollowOnDraft />
      </Stack>
    </Box>
  );
}

function useDraftPreview() {
  return useIntentRunsStore(
    useShallow((s) => {
      const id = s.currentRunId;
      if (!id) {
        return {
          runId: "",
          isActive: false,
          isStreaming: false,
          authorId: null,
          previewText: "",
          isPresentation: true,
          charCount: 0,
        };
      }

      const run = s.runsById[id];
      const last = run.provisional[run.provisional.length - 1];
      // Use throttled UI-facing fields from the store

      return {
        runId: id,
        isActive: run.status === "pending" || run.status === "running",
        isStreaming: last?.status === "streaming" || run.livePreview.length > 0,
        authorId: run.currentActorParticipantId ?? null,
        previewText: (run.displayPreview || last?.text || "").trim(),
        isPresentation: run.lastTokenIsPresentation ?? true,
        charCount: run.displayCharCount ?? 0,
      };
    })
  );
}
