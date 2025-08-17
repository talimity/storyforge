import { useEffect, useMemo } from "react";
import {
  type InputMode,
  IntentPanel,
} from "@/components/features/player/intent-panel/intent-panel";
import { PlayerLayout } from "@/components/features/player/player-layout";
import { TurnHistory } from "@/components/features/player/turn-history";
import { toaster } from "@/components/ui";
import { useActiveScenario } from "@/lib/hooks/use-active-scenario";
import { useScenarioIntent } from "@/lib/hooks/use-scenario-intent";
import { useScenarioTimeline } from "@/lib/hooks/use-scenario-timeline";
import { useScenarioCtx } from "@/lib/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/stores/scenario-store";

export function PlayerPage() {
  const { scenario, characters, participants, chapters } = useScenarioCtx();
  const { setActiveScenario } = useActiveScenario();
  const { selectedCharacterId, setSelectedCharacter, reset } =
    useScenarioPlayerStore();

  // Reset store when scenario changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: "hook specifies more dependencies than necessary" but we want to trigger reset only on scenarioId change???
  useEffect(() => {
    return () => {
      reset();
    };
  }, [scenario.id, reset]);

  const { debugAddTurn, isAddingTurn } = useScenarioIntent();

  const {
    turns,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    // timelineDepth,
  } = useScenarioTimeline({ scenarioId: scenario.id });

  // Create participant map for easy lookup
  const participantMap = useMemo(() => {
    const map = new Map<string, { name: string; type: string }>();
    participants.forEach((p) => {
      if (p.type === "narrator") {
        map.set(p.id, { name: "Narrator", type: "narrator" });
      } else if (p.characterId) {
        const char = characters.find((c) => c.id === p.characterId);
        if (char) {
          map.set(p.id, { name: char.name, type: "character" });
        }
      }
    });
    return map;
  }, [participants, characters]);

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

  // Derive selected character and participant
  const selectedCharacter = selectedCharacterId
    ? characters.find((char) => char.id === selectedCharacterId)
    : null;

  const selectedParticipant = selectedCharacterId
    ? participants.find((p) => p.characterId === selectedCharacterId)
    : null;

  // Click handlers
  const handleSubmitIntent = async (_mode: InputMode, text: string) => {
    if (!selectedParticipant || !scenario || !chapters[0]) return;

    try {
      await debugAddTurn(
        scenario.id,
        text,
        selectedParticipant.id,
        chapters[0].id
      );
    } catch (error) {
      console.error("Failed to submit intent:", error);
    }
  };

  const handleQuickAction = async (action: string) => {
    // TODO: Implement quick actions when API is ready
    toaster.info({
      description: `Quick action "${action}" not yet implemented`,
    });
  };

  const turnHistory = (
    <TurnHistory
      scenarioTitle={scenario.title}
      chapterTitle={
        chapters.length > 0 ? chapters[0].title || "Chapter 1" : undefined
      }
      turns={turns}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={fetchNextPage}
      participants={participantMap}
    />
  );

  const intentPanel = (
    <IntentPanel
      selectedCharacterName={selectedCharacter?.name || null}
      onSubmitIntent={handleSubmitIntent}
      onQuickAction={handleQuickAction}
      isGenerating={isAddingTurn}
    />
  );

  return <PlayerLayout turnHistory={turnHistory} intentPanel={intentPanel} />;
}
