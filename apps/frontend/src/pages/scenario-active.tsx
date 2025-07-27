import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Pause } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { CharacterPanel } from "@/components/scenario/character-panel";
import { TurnDisplay } from "@/components/scenario/turn-display";
import { InputArea } from "@/components/scenario/input-area";
import { ProcessingIndicator } from "@/components/scenario/processing-indicator";
import { useScenario as useScenarioState } from "@/hooks/use-active-scenario";
import { useScenario, useCharacters } from "@/hooks/api";
import { transformScenarioToUI } from "@/lib/transforms";
import { UIScenario } from "@storyforge/shared";

export const ScenarioActive = () => {
  const { id } = useParams<{ id: string }>();

  const {
    data: scenarioData,
    isLoading: scenarioLoading,
    error: scenarioError,
  } = useScenario(id!);
  const { data: charactersData = [], isLoading: charactersLoading } =
    useCharacters();

  const uiScenario: UIScenario | undefined =
    scenarioData && charactersData
      ? transformScenarioToUI(scenarioData, charactersData)
      : undefined;

  const {
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
  } = useScenarioState(uiScenario);

  const handleHistoryToggle = () => {
    alert("History toggle - to be implemented");
  };

  if (scenarioLoading || charactersLoading) {
    return (
      <div className="min-h-screen bg-narrative-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-foreground mb-2">
            Loading scenario...
          </div>
          <div className="text-sm text-muted-foreground">
            Fetching data from server
          </div>
        </div>
      </div>
    );
  }

  if (scenarioError) {
    return (
      <div className="min-h-screen bg-narrative-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-destructive mb-2">
            Failed to load scenario
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            {scenarioError instanceof Error
              ? scenarioError.message
              : "Unknown error occurred"}
          </div>
          <Link to="/scenarios">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Scenarios
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!uiScenario || !scenario) {
    return (
      <div className="min-h-screen bg-narrative-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-foreground mb-2">
            Scenario not found
          </div>
          <div className="text-sm text-muted-foreground mb-4">
            The requested scenario could not be found
          </div>
          <Link to="/scenarios">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Scenarios
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-narrative-bg">
      {/* Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/scenarios">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">
                {scenario.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Turn {scenario.turns[currentTurnIndex]?.number || 1}
                </span>
                <span>•</span>
                <span>{scenario.characters.length} characters</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Pause className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Character Panel */}
        <CharacterPanel
          characters={scenario.characters}
          selectedCharacter={selectedCharacter}
          inputMode={inputMode}
          onCharacterSelect={setSelectedCharacter}
          onInputModeChange={setInputMode}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Turn Display */}
          <TurnDisplay
            turns={scenario.turns}
            currentTurnIndex={currentTurnIndex}
            onTurnChange={handleTurnChange}
            onHistoryToggle={handleHistoryToggle}
          />

          {/* Processing Indicator */}
          <div className="max-w-4xl mx-auto px-6">
            <ProcessingIndicator
              steps={processingSteps}
              isVisible={isProcessing}
            />
          </div>

          {/* Input Area */}
          <InputArea
            inputMode={inputMode}
            inputText={inputText}
            selectedCharacter={selectedCharacter}
            isProcessing={isProcessing}
            onInputChange={setInputText}
            onSend={handleSendInput}
          />
        </div>
      </div>
    </div>
  );
};
