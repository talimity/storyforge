import { Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { memo, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Avatar, Button, StreamingMarkdown } from "@/components/ui";
import { AutoFollowOnDraft } from "@/features/scenario-player/components/timeline/auto-follow-draft";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useIntentRunsStore } from "@/features/scenario-player/stores/intent-run-store";
import { getApiUrl } from "@/lib/get-api-url";

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

  const shouldShowText = isPresentation || showInternal;
  const hint = useMemo(() => (isPresentation ? null : "Draft"), [isPresentation]);
  const approxTokens = useMemo(
    () => (charCount > 0 ? Math.max(1, Math.round(charCount / 4)) : 0),
    [charCount]
  );

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
    >
      <Stack gap={2}>
        <HStack justify="space-between" pb={1}>
          <HStack alignItems="center">
            {avatarSrc && (
              <MemoAvatar
                shape="rounded"
                layerStyle="surface"
                size="md"
                name={authorName}
                src={avatarSrc}
              />
            )}
            <Stack gap={0}>
              <Heading size="md" fontWeight="bold">
                {authorName}
              </Heading>
              {hint && (
                <Text fontSize="xs" color="content.subtle">
                  {hint}
                </Text>
              )}
            </Stack>
          </HStack>
          {!isPresentation && (
            <Button size="xs" variant="ghost" onClick={() => setShowInternal((v) => !v)}>
              {showInternal ? "Hide draft" : "Show draft"}
            </Button>
          )}
        </HStack>
        {shouldShowText ? (
          previewText ? (
            <StreamingMarkdown
              text={previewText}
              dialogueAuthorId={author?.id ?? null}
              maxW="85ch"
              size="lg"
              color="content.muted"
            />
          ) : (
            <Text fontSize="sm" color="content.muted">
              Thinking…
            </Text>
          )
        ) : (
          <Text fontSize="sm" color="content.muted">
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
