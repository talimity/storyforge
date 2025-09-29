import { Badge } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/index";
import type { IntentProvenanceDisplay } from "./intent-provenance-utils";

export interface IntentProvenanceIndicatorProps {
  display: IntentProvenanceDisplay | null;
}

export function IntentProvenanceIndicator(props: IntentProvenanceIndicatorProps) {
  const { display } = props;

  if (!display) {
    return null;
  }

  const isGenerating = display.status === "pending" || display.status === "running";

  return (
    <>
      {display.label ? (
        display.description ? (
          <Tooltip content={display.description} positioning={{ placement: "left" }}>
            <Badge
              size="xs"
              colorPalette={isGenerating ? "orange" : "neutral"}
              variant="subtle"
              textAlign="center"
              whiteSpace="nowrap"
            >
              {display.label}
            </Badge>
          </Tooltip>
        ) : (
          <Badge
            size="xs"
            colorPalette={isGenerating ? "orange" : "neutral"}
            variant="subtle"
            textAlign="center"
            whiteSpace="nowrap"
          >
            {display.label}
          </Badge>
        )
      ) : null}
    </>
  );
}
