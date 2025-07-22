import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Pause } from "lucide-react";
import { Link } from "react-router-dom";
import { CharacterPanel } from "@/components/scenario/CharacterPanel";
import { TurnDisplay } from "@/components/scenario/TurnDisplay";
import { InputArea } from "@/components/scenario/InputArea";
import { ProcessingIndicator } from "@/components/scenario/ProcessingIndicator";
import { useScenario } from "@/hooks/useScenario";
import { Scenario } from "@/types/scenario";

export const ScenarioActive = () => {
  // Mock scenario data with turn-based structure
  const mockScenario: Scenario = {
    id: 1,
    name: "The Autumn Court Intrigue",
    description: "A tale of political maneuvering in the fae courts",
    turnCount: 3,
    currentTurnIndex: 2,
    characters: [
      {
        id: 1,
        name: "Lady Veridiana",
        avatar: null,
        isActive: true,
        mood: "Calculating",
        status: "Planning her next move",
      },
      {
        id: 2,
        name: "Lord Thorn",
        avatar: null,
        isActive: false,
        mood: "Suspicious",
        status: "Watching carefully",
      },
      {
        id: 3,
        name: "The Shadow Broker",
        avatar: null,
        isActive: false,
        mood: "Amused",
        status: "Lurking in shadows",
      },
    ],
    turns: [
      {
        id: 1,
        number: 1,
        content:
          "The Court of Whispers stands in magnificent splendor, its halls adorned with the colors of autumn. Nobles from across the realm have gathered for what promises to be a pivotal moment in fae politics. The air itself seems to shimmer with anticipation and barely contained magic.",
        timestamp: new Date(Date.now() - 3600000),
        activeCharacters: [],
      },
      {
        id: 2,
        number: 2,
        content:
          "Lady Veridiana enters the great hall, her emerald gown catching the light of the enchanted chandeliers above. Her presence commands attention, and conversations pause as she moves with calculated grace through the crowd. Every step is deliberate, every glance meaningful.",
        timestamp: new Date(Date.now() - 1800000),
        activeCharacters: ["Lady Veridiana"],
      },
      {
        id: 3,
        number: 3,
        content: `The golden leaves of autumn swirl through the air as Lady Veridiana steps into the Court of Whispers. Her emerald gown rustles softly against the marble floor, each footstep calculated and deliberate. The other nobles watch her approach with a mixture of curiosity and wariness.

"My lords and ladies," she begins, her voice carrying the weight of centuries, "I come before you today with news that will change the very fabric of our realm."

Lord Thorn's eyes narrow from across the chamber. He has suspected her of plotting for weeks, but now his suspicions seem confirmed. The Shadow Broker, meanwhile, observes from the shadows with barely concealed amusement—as if he knows something the others do not.

The tension in the air is palpable as all eyes turn to Lady Veridiana, waiting for her next words.`,
        timestamp: new Date(),
        activeCharacters: ["Lady Veridiana", "Lord Thorn", "The Shadow Broker"],
      },
    ],
  };

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
  } = useScenario(mockScenario);

  const handleHistoryToggle = () => {
    // TODO: Implement history panel toggle in Phase 3
    console.log("History toggle - to be implemented");
  };

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
