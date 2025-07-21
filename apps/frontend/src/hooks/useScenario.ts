
import { useState, useCallback } from 'react';
import { Scenario, Turn, InputMode, ProcessingStep } from '@/types/scenario';

export const useScenario = (initialScenario: Scenario) => {
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(initialScenario.turns.length - 1);
  const [inputMode, setInputMode] = useState<InputMode>('director');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const processingSteps: ProcessingStep[] = [
    { name: "Planner Agent", description: "Analyzing character motivations", progress: 100 },
    { name: "Screenplay Agent", description: "Structuring dialogue and actions", progress: 75 },
    { name: "Prose Agent", description: "Crafting narrative prose", progress: 30 },
  ];

  const handleTurnChange = useCallback((index: number) => {
    if (index >= 0 && index < scenario.turns.length) {
      setCurrentTurnIndex(index);
    }
  }, [scenario.turns.length]);

  const handleSendInput = useCallback(() => {
    if (!inputText.trim()) return;
    
    setIsProcessing(true);
    
    // Simulate processing - in real app, this would make API calls
    setTimeout(() => {
      const newTurn: Turn = {
        id: scenario.turns.length + 1,
        number: scenario.turns.length + 1,
        content: `[Generated response based on: "${inputText}"]

The story continues as new events unfold. The characters react to the recent developments, their relationships shifting like shadows in the flickering light of the narrative flame.

Each choice echoes through the halls of destiny, weaving together the threads of fate into an ever more complex tapestry of intrigue and adventure.`,
        timestamp: new Date(),
        activeCharacters: selectedCharacter ? [selectedCharacter] : [],
      };

      setScenario(prev => ({
        ...prev,
        turns: [...prev.turns, newTurn],
        turnCount: prev.turnCount + 1
      }));

      setCurrentTurnIndex(scenario.turns.length);
      setIsProcessing(false);
      setInputText('');
    }, 3000);
  }, [inputText, selectedCharacter, scenario.turns.length]);

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
    handleSendInput
  };
};
