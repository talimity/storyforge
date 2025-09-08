import { useEffect, useMemo } from "react";
import {
  type InputMode,
  IntentPanel,
} from "@/features/scenario-player/components/intent-panel/intent-panel";
import { PlayerLayout } from "@/features/scenario-player/components/player-layout";
import { TimelineView } from "@/features/scenario-player/components/timeline/timeline-view";
import { useScenarioIntentActions } from "@/features/scenario-player/hooks/use-scenario-intent-actions";
import { useScenarioTimeline } from "@/features/scenario-player/hooks/use-scenario-timeline";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-store";
import { useActiveScenario } from "@/hooks/use-active-scenario";

export function PlayerPage() {
  const { scenario, participants, chapters } = useScenarioContext();
  const { setActiveScenario } = useActiveScenario();
  const { selectedCharacterId, setSelectedCharacter, reset } = useScenarioPlayerStore();

  // Reset store when scenario changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: "hook specifies more dependencies than necessary" but we want to trigger reset only on scenarioId change???
  useEffect(() => {
    return () => {
      console.debug("Resetting scenario player store");
      reset();
    };
  }, [scenario.id, reset]);

  const { addTurn, isAddingTurn } = useScenarioIntentActions();

  const { turns, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = useScenarioTimeline({
    scenarioId: scenario.id,
  });

  // Auto-select first character when available
  const firstCharacterParticipant = useMemo(
    () => participants.find((p) => p.type === "character" && p.characterId),
    [participants]
  );

  // Auto-select first character when available
  useEffect(() => {
    if (!selectedCharacterId && firstCharacterParticipant?.characterId) {
      setSelectedCharacter(firstCharacterParticipant.characterId);
    }
  }, [selectedCharacterId, firstCharacterParticipant, setSelectedCharacter]);

  // Set scenario as active when loaded
  useEffect(() => {
    setActiveScenario(scenario.id);
  }, [scenario.id, setActiveScenario]);

  const selectedParticipant = selectedCharacterId
    ? participants.find((p) => p.characterId === selectedCharacterId)
    : null;

  // Click handlers
  const handleSubmitIntent = async (_mode: InputMode, text: string) => {
    if (!selectedParticipant || !scenario || !chapters[0]) return;

    try {
      await addTurn(scenario.id, text, selectedParticipant.id, chapters[0].id);
    } catch (error) {
      console.error("Failed to submit intent:", error);
    }
  };

  const handleStarterSelect = async (characterId: string, starterId: string) => {
    // TODO: Implement starter selection behavior
    console.log("Selected starter:", { characterId, starterId });
  };

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
    />
  );

  const intentPanel = (
    <IntentPanel onSubmitIntent={handleSubmitIntent} isGenerating={isAddingTurn} />
  );

  return <PlayerLayout timeline={timelineView} intentPanel={intentPanel} />;
}
