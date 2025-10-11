import type { IntentInput } from "@storyforge/contracts";
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

function PlayerPage() {
  const { scenario, participants, chapters, deriveChapterLabel } = useScenarioContext();
  const { setActiveScenario } = useActiveScenario();
  const selectedCharacterId = useScenarioPlayerStore((s) => s.selectedCharacterId);
  const setSelectedCharacter = useScenarioPlayerStore((s) => s.setSelectedCharacter);
  const resetPlayerStore = useScenarioPlayerStore((s) => s.reset);
  const currentRunId = useIntentRunsStore((s) => s.currentRunId);
  const resetRunStore = useIntentRunsStore((s) => s.clearAllRuns);
  const { addTurn } = useScenarioIntentActions();
  const { startIntent, cancelIntent } = useIntentEngine(scenario.id);
  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const { turns, hasNextPage, isFetching, isPending, fetchNextPage } = useScenarioTimeline({
    scenarioId: scenario.id,
    leafTurnId: previewLeafTurnId ?? null,
  });

  useEffect(() => {
    return () => {
      // Reset stores when scenario changes
      resetPlayerStore();
      resetRunStore(scenario.id);
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
      case "direct":
      case "guided": {
        if (!selectedParticipant) return;
        await startIntent({
          kind: mode === "direct" ? "manual_control" : "guided_control",
          text,
          targetParticipantId: selectedParticipant.id,
        });
        break;
      }
      case "constraints": {
        const payload: IntentInput = selectedParticipant
          ? {
              kind: "narrative_constraint",
              text,
              targetParticipantId: selectedParticipant.id,
            }
          : { kind: "narrative_constraint", text };
        await startIntent(payload);
        break;
      }
      case "quick": {
        const payload: IntentInput = selectedParticipant
          ? {
              kind: "continue_story",
              targetParticipantId: selectedParticipant.id,
            }
          : { kind: "continue_story" };
        await startIntent(payload);
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
    if (!actor) return;
    await addTurn({ scenarioId: scenario.id, text: message, authorParticipantId: actor.id });
  };

  const firstChapter = chapters.at(0);
  const firstChapterLabel = firstChapter ? deriveChapterLabel(firstChapter) : undefined;

  const timeline = (
    <VirtualizedTimeline
      scenarioId={scenario.id}
      scenarioTitle={scenario.title}
      firstChapterLabel={firstChapterLabel}
      turns={turns}
      hasNextPage={hasNextPage}
      isFetching={isFetching}
      isPending={isPending}
      onLoadMore={fetchNextPage}
      onStarterSelect={handleStarterSelect}
    />
  );

  const intentPanel = (
    <IntentPanel
      onSubmitIntent={handleSubmitIntent}
      onCancelIntent={handleCancelIntent}
      onQuickContinue={() => {
        const payload: IntentInput = selectedParticipant
          ? {
              kind: "continue_story",
              targetParticipantId: selectedParticipant.id,
            }
          : { kind: "continue_story" };
        void startIntent(payload);
      }}
    />
  );

  return <PlayerLayout timeline={timeline} intentPanel={intentPanel} />;
}

export default PlayerPage;
