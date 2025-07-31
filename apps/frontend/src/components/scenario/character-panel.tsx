import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, User } from "lucide-react";
import { UICharacter, InputMode } from "@storyforge/shared";

interface CharacterPanelProps {
  characters: UICharacter[];
  selectedCharacter: string | null;
  inputMode: InputMode;
  onCharacterSelect: (name: string) => void;
  onInputModeChange: (mode: InputMode) => void;
}

export const CharacterPanel = ({
  characters,
  selectedCharacter,
  inputMode,
  onCharacterSelect,
  onInputModeChange,
}: CharacterPanelProps) => {
  return (
    <div className="w-80 border-r border-border bg-card/50 backdrop-blur-sm p-4 space-y-4 overflow-y-auto scrollbar-thin">
      <div className="space-y-3">
        <h3 className="font-medium text-foreground text-sm uppercase tracking-wide">
          Characters
        </h3>
        {characters.map((character) => (
          <Card
            key={character.id}
            className={`character-card cursor-pointer transition-all ${
              character.isActive ? "border-primary shadow-elegant" : ""
            } ${selectedCharacter === character.name ? "bg-primary/10" : ""}`}
            onClick={() => onCharacterSelect(character.name)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="w-10 h-10 border-2 border-border">
                    <AvatarImage src={undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {character.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {character.isActive && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-background animate-pulse-glow" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm truncate">
                    {character.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {character.mood}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {character.status}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mode Selector */}
      <div className="pt-4 border-t border-border space-y-3">
        <h4 className="font-medium text-foreground text-sm uppercase tracking-wide">
          Input Mode
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={inputMode === "director" ? "default" : "outline"}
            size="sm"
            onClick={() => onInputModeChange("director")}
            className={
              inputMode === "director"
                ? "bg-gradient-gold text-accent-foreground"
                : ""
            }
          >
            <Crown className="w-3 h-3 mr-1" />
            Director
          </Button>
          <Button
            variant={inputMode === "character" ? "default" : "outline"}
            size="sm"
            onClick={() => onInputModeChange("character")}
            className={inputMode === "character" ? "bg-gradient-primary" : ""}
          >
            <User className="w-3 h-3 mr-1" />
            Character
          </Button>
        </div>
        {inputMode === "character" && (
          <div className="text-xs text-muted-foreground">
            Playing as:{" "}
            <span className="text-primary">
              {selectedCharacter || "Select a character"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
