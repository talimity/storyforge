import { useQuery } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useScenarioEnvironment } from "@/features/scenario-player/hooks/use-scenario-environment";
import { useScenarioTimelineState } from "@/features/scenario-player/hooks/use-scenario-timeline-state";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { useTRPC } from "@/lib/trpc";

type ScenarioCtxEnvironment = ReturnType<typeof useScenarioEnvironment>;
export type ScenarioCtxParticipant = ScenarioCtxEnvironment["participants"][number];
export type ScenarioCtxCharacter = ScenarioCtxEnvironment["characters"][number];
type ScenarioCtxTimelineState = ReturnType<typeof useScenarioTimelineState>;
type ScenarioCtxChapter = ScenarioCtxTimelineState["chapters"]["chapters"][number];

type ScenarioCtx = ScenarioCtxEnvironment & {
  participantsById: Record<string, ScenarioCtxParticipant>;
  charactersById: Record<string, ScenarioCtxCharacter>;
  getCharacterById: (characterId?: string | null) => ScenarioCtxCharacter | undefined;
  getParticipantById: (participantId?: string | null) => ScenarioCtxParticipant | undefined;
  getCharacterByParticipantId: (participantId?: string | null) => ScenarioCtxCharacter | undefined;
  timelineState: ScenarioCtxTimelineState;
  chapters: ScenarioCtxTimelineState["chapters"]["chapters"];
  chaptersByEventId: Record<string, ScenarioCtxChapter>;
  chapterLabelsByEventId: Record<string, string>;
  deriveChapterLabel: (chapter?: ScenarioCtxChapter) => string;
  recommendedNextActor: {
    participantId: string;
    characterId: string | null;
  };
};
const ScenarioContext = createContext<ScenarioCtx | null>(null);

function indexById<T extends { id: string }>(items: T[]) {
  return Object.fromEntries(items.map((item) => [item.id, item])) as Record<string, T>;
}

function computeChapterLabel(chapter?: ScenarioCtxChapter) {
  if (!chapter) return "Unknown";
  const trimmed = chapter.title?.trim();
  return trimmed ? `Ch.${chapter.number} - ${trimmed}` : `Chapter ${chapter.number}`;
}

function indexChapters(chapters: ScenarioCtxChapter[]) {
  const chaptersByEventId: Record<string, ScenarioCtxChapter> = {};
  const chapterLabelsByEventId: Record<string, string> = {};

  for (const chapter of chapters) {
    chaptersByEventId[chapter.eventId] = chapter;
    chapterLabelsByEventId[chapter.eventId] = computeChapterLabel(chapter);
  }

  return { chaptersByEventId, chapterLabelsByEventId };
}

function createCharacterLookup(charactersById: Record<string, ScenarioCtxCharacter>) {
  return (characterId?: string | null) => {
    if (!characterId) return;
    return charactersById[characterId];
  };
}

function createParticipantLookup(participantsById: Record<string, ScenarioCtxParticipant>) {
  return (participantId?: string | null) => {
    if (!participantId) return;
    return participantsById[participantId];
  };
}

function createCharacterByParticipantLookup(
  participantsById: Record<string, ScenarioCtxParticipant>,
  charactersById: Record<string, ScenarioCtxCharacter>
) {
  return (participantId?: string | null) => {
    if (!participantId) return;
    const participant = participantsById[participantId];
    if (!participant?.characterId) return;
    return charactersById[participant.characterId];
  };
}

export function ScenarioProvider(props: { scenarioId: string; children: ReactNode }) {
  const { scenarioId, children } = props;
  const env = useScenarioEnvironment(scenarioId);
  const trpc = useTRPC();

  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const setSelectedCharacter = useScenarioPlayerStore((s) => s.setSelectedCharacter);
  const shouldAdoptRecommended = useScenarioPlayerStore((s) => s.pendingRecommendedSelection);
  const consumeRecommended = useScenarioPlayerStore((s) => s.consumeRecommendedSelection);

  const timelineState = useScenarioTimelineState({
    scenarioId,
    leafTurnId: previewLeafTurnId ?? env.scenario.anchorTurnId,
  });
  const chapters = timelineState.chapters.chapters;
  const participantsById = indexById(env.participants);
  const charactersById = indexById(env.characters);
  const { chaptersByEventId, chapterLabelsByEventId } = indexChapters(chapters);

  const getCharacterById = createCharacterLookup(charactersById);
  const getParticipantById = createParticipantLookup(participantsById);
  const getCharacterByParticipantId = createCharacterByParticipantLookup(
    participantsById,
    charactersById
  );

  const previewEnabled = Boolean(previewLeafTurnId);
  const nextActorQuery = useQuery({
    ...trpc.timeline.nextActor.queryOptions({
      scenarioId,
      leafTurnId: previewLeafTurnId ?? undefined,
    }),
    enabled: previewEnabled,
  });

  const activeNextParticipantId =
    (previewEnabled ? nextActorQuery.data?.participantId : undefined) ??
    env.nextActor.participantId;
  const recommendedParticipant = participantsById[activeNextParticipantId];
  const recommendedNextActor = {
    participantId: activeNextParticipantId,
    characterId: recommendedParticipant?.characterId ?? null,
  };

  useEffect(() => {
    if (!shouldAdoptRecommended) return;
    if (recommendedNextActor.characterId) {
      setSelectedCharacter(recommendedNextActor.characterId);
    }
    consumeRecommended();
  }, [
    consumeRecommended,
    recommendedNextActor.characterId,
    setSelectedCharacter,
    shouldAdoptRecommended,
  ]);

  const contextValue: ScenarioCtx = {
    ...env,
    participantsById,
    charactersById,
    getCharacterById,
    getParticipantById,
    getCharacterByParticipantId,
    timelineState,
    chapters,
    chaptersByEventId,
    chapterLabelsByEventId,
    deriveChapterLabel: computeChapterLabel,
    recommendedNextActor,
  };

  return <ScenarioContext.Provider value={contextValue}>{children}</ScenarioContext.Provider>;
}

export function useScenarioContext() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenarioContext called outside ScenarioProvider");
  return ctx;
}
