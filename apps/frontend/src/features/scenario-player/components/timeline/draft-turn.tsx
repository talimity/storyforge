import { Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { memo } from "react";
import Markdown from "react-markdown";
import { useShallow } from "zustand/react/shallow";
import { Avatar, Prose } from "@/components/ui";
import { AutoFollowOnDraft } from "@/features/scenario-player/components/timeline/auto-follow-draft";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useIntentRunsStore } from "@/features/scenario-player/stores/intent-run-store";
import { getApiUrl } from "@/lib/get-api-url";

// chakra avatar is kind of heavy so we don't want to render on every token
const MemoAvatar = memo(Avatar, (prev, next) => prev.src === next.src);

export function DraftTurn() {
  const { getCharacterByParticipantId } = useScenarioContext();
  const { runId, isActive, authorId, previewText } = useDraftPreview();

  if (!isActive) return null;

  const author = authorId ? getCharacterByParticipantId(authorId) : null;
  const authorName = author?.name ?? "Generating";
  const avatarSrc = getApiUrl(author?.avatarPath ?? undefined);

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
              {/*<HStack gap={2}>*/}
              {/*  <StepSummary />*/}
              {/*</HStack>*/}
            </Stack>
          </HStack>
        </HStack>
        {previewText ? (
          <Prose maxW="85ch" size="lg" color="content.muted">
            <Markdown>{previewText}</Markdown>
          </Prose>
        ) : (
          <Text fontSize="sm" color="content.muted">
            Thinking…
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
        return { isActive: false, isStreaming: false, authorId: null, previewText: "" };
      }

      const run = s.runsById[id];
      const last = run.provisional[run.provisional.length - 1];

      return {
        runId: id,
        isActive: run.status === "pending" || run.status === "running",
        isStreaming: last?.status === "streaming" || run.livePreview.length > 0,
        authorId: run.currentActorParticipantId ?? null,
        previewText: (last?.text || run.livePreview || "").trim(),
      };
    })
  );
}
