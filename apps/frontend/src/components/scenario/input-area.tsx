import type { InputMode } from "@storyforge/shared";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface InputAreaProps {
  inputMode: InputMode;
  inputText: string;
  selectedCharacter: string | null;
  isProcessing: boolean;
  onInputChange: (text: string) => void;
  onSend: () => void;
}

export const InputArea = ({
  inputMode,
  inputText,
  selectedCharacter,
  isProcessing,
  onInputChange,
  onSend,
}: InputAreaProps) => {
  const canSend =
    inputText.trim() &&
    !isProcessing &&
    (inputMode === "director" || selectedCharacter);

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-sm p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Badge
            variant={inputMode === "director" ? "default" : "secondary"}
            className={
              inputMode === "director"
                ? "bg-gradient-gold text-accent-foreground"
                : ""
            }
          >
            {inputMode === "director"
              ? "Director Mode"
              : `Playing as ${selectedCharacter || "Character"}`}
          </Badge>
          {inputMode === "character" && !selectedCharacter && (
            <span className="text-muted-foreground text-xs">
              Select a character to play as
            </span>
          )}
        </div>

        <div className="flex gap-3">
          <Textarea
            placeholder={
              inputMode === "director"
                ? "Describe what happens next, introduce events, or guide the story..."
                : selectedCharacter
                  ? `What does ${selectedCharacter} say or do?`
                  : "Select a character first..."
            }
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            className={`flex-1 min-h-[80px] resize-none ${
              inputMode === "director" ? "input-director" : "input-character"
            }`}
            disabled={
              isProcessing || (inputMode === "character" && !selectedCharacter)
            }
          />
          <Button
            onClick={onSend}
            disabled={!canSend}
            className="self-end bg-gradient-primary hover:shadow-glow transition-all"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
