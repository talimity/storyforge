import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useScenarioEnvironment } from "@/features/scenario-player/hooks/use-scenario-environment";
import { useScenarioTimelineState } from "@/features/scenario-player/hooks/use-scenario-timeline-state";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";

type ScenarioEnvironment = ReturnType<typeof useScenarioEnvironment>;
type ScenarioParticipant = ScenarioEnvironment["participants"][number];
type ScenarioCharacter = ScenarioEnvironment["characters"][number];
type ScenarioTimelineState = ReturnType<typeof useScenarioTimelineState>;
type ScenarioChapter = ScenarioTimelineState["chapters"]["chapters"][number];

type ScenarioCtx = ScenarioEnvironment & {
  participantsById: Record<string, ScenarioParticipant>;
  charactersById: Record<string, ScenarioCharacter>;
  getCharacterByParticipantId: (participantId: string) => ScenarioCharacter | null;
  timelineState: ScenarioTimelineState;
  chapters: ScenarioTimelineState["chapters"]["chapters"];
  chaptersByEventId: Record<string, ScenarioChapter>;
  chapterLabelsByEventId: Record<string, string>;
  deriveChapterLabel: (chapter: ScenarioChapter) => string;
};
const ScenarioContext = createContext<ScenarioCtx | null>(null);

export function ScenarioProvider({
  scenarioId,
  children,
}: {
  scenarioId: string;
  children: ReactNode;
}) {
  const env = useScenarioEnvironment(scenarioId);
  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const timelineState = useScenarioTimelineState({
    scenarioId,
    leafTurnId: previewLeafTurnId ?? env.scenario.anchorTurnId ?? null,
  });
  const chapters = useMemo(() => timelineState.chapters.chapters, [timelineState]);
  const deriveChapterLabel = useMemo(
    () => (chapter: ScenarioChapter) => {
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
