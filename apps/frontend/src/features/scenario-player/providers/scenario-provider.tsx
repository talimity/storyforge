import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useScenarioEnvironment } from "@/features/scenario-player/hooks/use-scenario-environment";
import { useScenarioTimelineState } from "@/features/scenario-player/hooks/use-scenario-timeline-state";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";

type ScenarioCtxEnvironment = ReturnType<typeof useScenarioEnvironment>;
export type ScenarioCtxParticipant = ScenarioCtxEnvironment["participants"][number];
export type ScenarioCtxCharacter = ScenarioCtxEnvironment["characters"][number];
type ScenarioCtxTimelineState = ReturnType<typeof useScenarioTimelineState>;
type ScenarioCtxChapter = ScenarioCtxTimelineState["chapters"]["chapters"][number];

type ScenarioCtx = ScenarioCtxEnvironment & {
  participantsById: Record<string, ScenarioCtxParticipant>;
  charactersById: Record<string, ScenarioCtxCharacter>;
  getCharacterById: (characterId?: string | null) => ScenarioCtxCharacter | null;
  getParticipantById: (participantId?: string | null) => ScenarioCtxParticipant | null;
  getCharacterByParticipantId: (participantId: string) => ScenarioCtxCharacter | null;
  timelineState: ScenarioCtxTimelineState;
  chapters: ScenarioCtxTimelineState["chapters"]["chapters"];
  chaptersByEventId: Record<string, ScenarioCtxChapter>;
  chapterLabelsByEventId: Record<string, string>;
  deriveChapterLabel: (chapter: ScenarioCtxChapter) => string;
};
const ScenarioContext = createContext<ScenarioCtx | null>(null);

export function ScenarioProvider(props: { scenarioId: string; children: ReactNode }) {
  const { scenarioId, children } = props;
  const env = useScenarioEnvironment(scenarioId);

  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const timelineState = useScenarioTimelineState({
    scenarioId,
    leafTurnId: previewLeafTurnId ?? env.scenario.anchorTurnId ?? null,
  });
  const chapters = useMemo(() => timelineState.chapters.chapters, [timelineState]);
  const deriveChapterLabel = useMemo(
    () => (chapter: ScenarioCtxChapter) => {
      const trimmed = chapter.title?.trim();
      return trimmed ? `Ch.${chapter.number} - ${trimmed}` : `Chapter ${chapter.number}`;
    },
    []
  );
  const chaptersByEventId = useMemo(
    () => Object.fromEntries(chapters.map((chapter) => [chapter.eventId, chapter])),
    [chapters]
  );
  const chapterLabelsByEventId = useMemo(
    () =>
      Object.fromEntries(
        chapters.map((chapter) => [chapter.eventId, deriveChapterLabel(chapter)] as const)
      ),
    [chapters, deriveChapterLabel]
  );

  const participantsById = useMemo(
    () => Object.fromEntries(env.participants.map((p) => [p.id, p])),
    [env.participants]
  );
  const charactersById = useMemo(
    () => Object.fromEntries(env.characters.map((c) => [c.id, c])),
    [env.characters]
  );

  const getCharacterById = useMemo(
    () => (characterId?: string | null) => {
      if (!characterId) return null;
      return charactersById[characterId] || null;
    },
    [charactersById]
  );

  const getParticipantById = useMemo(
    () => (participantId?: string | null) => {
      if (!participantId) return null;
      return participantsById[participantId] || null;
    },
    [participantsById]
  );

  const getCharacterByParticipantId = useMemo(
    () => (participantId: string) => {
      const p = participantsById[participantId];
      return p?.characterId ? charactersById[p.characterId] : null;
    },
    [participantsById, charactersById]
  );

  const contextValue = useMemo(
    () => ({
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
      deriveChapterLabel,
    }),
    [
      env,
      participantsById,
      charactersById,
      getCharacterById,
      getParticipantById,
      getCharacterByParticipantId,
      timelineState,
      chapters,
      chaptersByEventId,
      chapterLabelsByEventId,
      deriveChapterLabel,
    ]
  );

  return <ScenarioContext.Provider value={contextValue}>{children}</ScenarioContext.Provider>;
}

export function useScenarioContext() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenarioContext called outside ScenarioProvider");
  return ctx;
}
