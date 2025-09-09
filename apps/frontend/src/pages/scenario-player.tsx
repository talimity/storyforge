import { useEffect, useRef } from "react";
import {
  type InputMode,
  IntentPanel,
} from "@/features/scenario-player/components/intent-panel/intent-panel";
import { PlayerLayout } from "@/features/scenario-player/components/player-layout";
import { TimelineView } from "@/features/scenario-player/components/timeline/timeline-view";
import { useIntentEngine } from "@/features/scenario-player/hooks/use-intent-engine";
import { useScenarioIntentActions } from "@/features/scenario-player/hooks/use-scenario-intent-actions";
import { useScenarioTimeline } from "@/features/scenario-player/hooks/use-scenario-timeline";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useIntentRunsStore } from "@/features/scenario-player/stores/intent-run-store";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";
import { useActiveScenario } from "@/hooks/use-active-scenario";

export function PlayerPage() {
  const { scenario, participants, chapters } = useScenarioContext();
  const { setActiveScenario } = useActiveScenario();
  const { selectedCharacterId, setSelectedCharacter, reset } = useScenarioPlayerStore();

  // Reset store when scenario changes
  useEffect(() => {
    return () => {
      console.debug("Resetting scenario player store", scenario.id);
      reset();
    };
  }, [scenario.id, reset]);

  const { addTurn } = useScenarioIntentActions();
  const { startIntent, cancelIntent } = useIntentEngine(scenario.id);
  const currentRunId = useIntentRunsStore((s) => s.currentRunId);

  const { turns, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = useScenarioTimeline({
    scenarioId: scenario.id,
  });

  // Auto-select first character when available
  useEffect(() => {
    const firstChara = participants.find((p) => p.type === "character" && p.characterId);
    if (!selectedCharacterId && firstChara?.characterId) {
      setSelectedCharacter(firstChara.characterId);
    }
  }, [selectedCharacterId, participants, setSelectedCharacter]);

  // Set scenario as active when loaded
  useEffect(() => {
    setActiveScenario(scenario.id);
  }, [scenario.id, setActiveScenario]);

  const selectedParticipant = selectedCharacterId
    ? participants.find((p) => p.characterId === selectedCharacterId)
    : null;

  // Click handlers
  const handleSubmitIntent = async (mode: InputMode, text: string) => {
    if (!scenario) return;
    try {
      switch (mode) {
        case "direct": {
          if (!selectedParticipant) return;
          await startIntent({
            kind: "manual_control",
            text,
            targetParticipantId: selectedParticipant.id,
          });
          break;
        }
        case "constraints": {
          await startIntent({ kind: "narrative_constraint", text });
          break;
        }
        case "quick": {
          await startIntent({ kind: "continue_story" });
          break;
        }
      }
    } catch (error) {
      console.error("Failed to submit intent:", error);
    }
  };

  const handleCancelIntent = async () => {
    if (!currentRunId) return;
    await cancelIntent(currentRunId);
  };

  const handleStarterSelect = async (characterId: string, message: string) => {
    const actor = participants.find((p) => p.characterId === characterId);
    const chapter = chapters[0];
    if (!actor || !chapter) return;
    await addTurn(scenario.id, message, actor.id, chapter.id);
  };

  const scrollRef = useRef<HTMLDivElement>(null);

  const timelineView = (
    <TimelineView
      scenarioId={scenario.id}
      scenarioTitle={scenario.title}
      chapterTitle={chapters.length > 0 ? chapters[0].title || "Chapter 1" : undefined}
      turns={turns}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={fetchNextPage}
      onTurnDeleted={refetch}
      onStarterSelect={handleStarterSelect}
      scrollRef={scrollRef}
    />
  );

  const intentPanel = (
    <IntentPanel
      onSubmitIntent={handleSubmitIntent}
      onCancelIntent={handleCancelIntent}
      onQuickContinue={() => {
        void startIntent({ kind: "continue_story" });
      }}
    />
  );

  return <PlayerLayout timeline={timelineView} intentPanel={intentPanel} scrollRef={scrollRef} />;
}
