import { useEffect } from "react";
import {
  type InputMode,
  IntentPanel,
} from "@/features/scenario-player/components/intent-panel/intent-panel";
import { PlayerLayout } from "@/features/scenario-player/components/player-layout";
import { VirtualizedTimeline } from "@/features/scenario-player/components/timeline/virtualized-timeline";
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
  const selectedCharacterId = useScenarioPlayerStore((s) => s.selectedCharacterId);
  const setSelectedCharacter = useScenarioPlayerStore((s) => s.setSelectedCharacter);
  const resetPlayerStore = useScenarioPlayerStore((s) => s.reset);
  const currentRunId = useIntentRunsStore((s) => s.currentRunId);
  const resetRunStore = useIntentRunsStore((s) => s.clearAllRuns);
  const { addTurn } = useScenarioIntentActions();
  const { startIntent, cancelIntent } = useIntentEngine(scenario.id);
  const { turns, hasNextPage, isFetching, isPending, fetchNextPage, refetch } = useScenarioTimeline(
    { scenarioId: scenario.id }
  );

  useEffect(() => {
    return () => {
      // Reset stores when scenario changes
      resetPlayerStore();
      resetRunStore();
      // Set active scenario
      setActiveScenario(scenario.id);
    };
  }, [scenario.id, resetPlayerStore, resetRunStore, setActiveScenario]);

  // Auto-select first character when available
  useEffect(() => {
    const firstChara = participants.find((p) => p.type === "character" && p.characterId);
    if (!selectedCharacterId && firstChara?.characterId) {
      setSelectedCharacter(firstChara.characterId);
    }
  }, [selectedCharacterId, participants, setSelectedCharacter]);

  const selectedParticipant = selectedCharacterId
    ? participants.find((p) => p.characterId === selectedCharacterId)
    : null;

  // Click handlers
  const handleSubmitIntent = async (mode: InputMode, text: string) => {
    if (!scenario) return;

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

  const timeline = (
    <VirtualizedTimeline
      scenarioId={scenario.id}
      scenarioTitle={scenario.title}
      chapterTitle={chapters.length > 0 ? chapters[0].title || "Chapter 1" : undefined}
      turns={turns}
      hasNextPage={hasNextPage}
      isFetching={isFetching}
      isPending={isPending}
      onLoadMore={fetchNextPage}
      onTurnDeleted={refetch}
      onStarterSelect={handleStarterSelect}
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

  return <PlayerLayout timeline={timeline} intentPanel={intentPanel} />;
}
