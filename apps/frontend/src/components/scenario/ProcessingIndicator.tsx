
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Zap } from "lucide-react";
import { ProcessingStep } from "@/types/scenario";

interface ProcessingIndicatorProps {
  steps: ProcessingStep[];
  isVisible: boolean;
}

export const ProcessingIndicator = ({ steps, isVisible }: ProcessingIndicatorProps) => {
  if (!isVisible) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Zap className="w-4 h-4 animate-pulse" />
            <span className="font-medium">Generating narrative...</span>
          </div>
          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{step.name}</span>
                  <span className="text-muted-foreground">{step.progress}%</span>
                </div>
                <Progress value={step.progress} className="h-1" />
                <div className="text-xs text-muted-foreground">
                  {step.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
