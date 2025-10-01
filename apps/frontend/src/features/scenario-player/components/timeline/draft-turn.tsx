import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { memo } from "react";
import Markdown from "react-markdown";
import { useShallow } from "zustand/react/shallow";
import { Avatar, Prose } from "@/components/ui/index";
import { AutoFollowOnDraft } from "@/features/scenario-player/components/timeline/auto-follow-draft";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useIntentRunsStore } from "@/features/scenario-player/stores/intent-run-store";
import { getApiUrl } from "@/lib/get-api-url";

// chakra avatar is kind of heavy so we don't want to render on every token
const MemoAvatar = memo(Avatar, (prev, next) => prev.src === next.src);

export function DraftTurn() {
  const { getCharacterByParticipantId } = useScenarioContext();
  const { isActive, authorId, previewText } = useDraftPreview();

  if (!isActive) return null;

  const author = authorId ? getCharacterByParticipantId(authorId) : null;
  const authorName = author?.name ?? "Generating";
  const avatarSrc = getApiUrl(author?.avatarPath ?? undefined);

  return (
    <Box layerStyle="surface" p={4} borderRadius="md" opacity={0.9} borderStyle="dashed">
      <Stack gap={2}>
        <HStack justify="space-between" mb={1}>
          <HStack alignItems="center">
            {avatarSrc && (
              <MemoAvatar shape="rounded" name={authorName} src={avatarSrc} size="xs" />
            )}
            <Text fontSize="md" fontWeight="bold" color="content.emphasized">
              {authorName}
            </Text>
            <Text fontSize="xs" color="content.muted">
              (generating)
            </Text>
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
        <StepSummary />
        <AutoFollowOnDraft />
      </Stack>
    </Box>
  );
}

function StepSummary() {
  const run = useIntentRunsStore((s) => (s.currentRunId ? s.runsById[s.currentRunId] : null));
  if (!run) return null;

  const steps = Object.values(run.steps);
  if (!steps.length) return null;

  const running = steps.filter((s) => s.status === "running").length;
  const finished = steps.filter((s) => s.status === "finished").length;
  const errored = steps.filter((s) => s.status === "error").length;

  return (
    <Text fontSize="xs" color="content.muted">
      Steps: {running} running, {finished} finished{errored ? `, ${errored} error` : ""}
    </Text>
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
        isActive: run.status === "pending" || run.status === "running",
        isStreaming: last?.status === "streaming" || run.livePreview.length > 0,
        authorId: run.currentActorParticipantId ?? null,
        previewText: (last?.text || run.livePreview || "").trim(),
      };
    })
  );
}
