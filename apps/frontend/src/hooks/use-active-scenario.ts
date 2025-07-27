import { useState, useCallback, useEffect } from "react";
import {
  UIScenario,
  UITurn,
  InputMode,
  ProcessingStep,
} from "@storyforge/shared";

export const useScenario = (initialScenario?: UIScenario) => {
  const [scenario, setScenario] = useState<UIScenario | undefined>(
    initialScenario
  );
  const [currentTurnIndex, setCurrentTurnIndex] = useState(
    initialScenario?.turns.length ? initialScenario.turns.length - 1 : 0
  );
  const [inputMode, setInputMode] = useState<InputMode>("director");
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    null
  );
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (initialScenario) {
      setScenario(initialScenario);
      setCurrentTurnIndex(initialScenario.turns.length - 1);
    }
  }, [initialScenario]);

  const processingSteps: ProcessingStep[] = [
    {
      name: "Planner Agent",
      description: "Analyzing character motivations",
      progress: 100,
    },
    {
      name: "Screenplay Agent",
      description: "Structuring dialogue and actions",
      progress: 75,
    },
    {
      name: "Prose Agent",
      description: "Crafting narrative prose",
      progress: 30,
    },
  ];

  const handleTurnChange = useCallback(
    (index: number) => {
      if (scenario && index >= 0 && index < scenario.turns.length) {
        setCurrentTurnIndex(index);
      }
    },
    [scenario]
  );

  const handleSendInput = useCallback(() => {
    if (!inputText.trim() || !scenario) return;

    setIsProcessing(true);

    // Simulate processing - in real app, this would make API calls
    setTimeout(() => {
      const newTurn: UITurn = {
        id: scenario.turns.length + 1,
        number: scenario.turns.length + 1,
        content: `[Generated response based on: "${inputText}"]

The story continues as new events unfold. The characters react to the recent developments, their relationships shifting like shadows in the flickering light of the narrative flame.

Each choice echoes through the halls of destiny, weaving together the threads of fate into an ever more complex tapestry of intrigue and adventure.`,
        timestamp: new Date(),
        activeCharacters: selectedCharacter ? [selectedCharacter] : [],
      };

      setScenario((prev) =>
        prev
          ? {
              ...prev,
              turns: [...prev.turns, newTurn],
              turnCount: prev.turnCount + 1,
            }
          : undefined
      );

      setCurrentTurnIndex(scenario.turns.length);
      setIsProcessing(false);
      setInputText("");
    }, 3000);
  }, [inputText, selectedCharacter, scenario]);

  return {
    scenario,
    currentTurnIndex,
    inputMode,
    selectedCharacter,
    inputText,
    isProcessing,
    processingSteps,
    handleTurnChange,
    setInputMode,
    setSelectedCharacter,
    setInputText,
    handleSendInput,
  };
};
