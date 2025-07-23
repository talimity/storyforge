
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { UITurn } from "@storyforge/shared";

interface TurnDisplayProps {
  turns: UITurn[];
  currentTurnIndex: number;
  onTurnChange: (index: number) => void;
  onHistoryToggle: () => void;
}

export const TurnDisplay = ({
  turns,
  currentTurnIndex,
  onTurnChange,
  onHistoryToggle,
}: TurnDisplayProps) => {
  const currentTurn = turns[currentTurnIndex];
  const canGoPrevious = currentTurnIndex > 0;
  const canGoNext = currentTurnIndex < turns.length - 1;

  return (
    <div className="flex-1 p-6 overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Turn Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTurnChange(currentTurnIndex - 1)}
              disabled={!canGoPrevious}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Turn {currentTurn?.number || 1} of {turns.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTurnChange(currentTurnIndex + 1)}
              disabled={!canGoNext}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={onHistoryToggle}>
            <Eye className="w-4 h-4 mr-2" />
            History
          </Button>
        </div>

        {/* Current Turn Content */}
        {currentTurn && (
          <Card className="narrative-container">
            <CardContent className="p-8">
              <div className="narrative-text space-y-4">
                {currentTurn.content.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
