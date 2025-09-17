import { Badge, Box, Stack } from "@chakra-ui/react";
import type { IntentStatus } from "@storyforge/contracts";
import { Tooltip } from "@/components/ui/index";
import type { IntentProvenanceDisplay } from "./intent-provenance-utils";

const BADGE_TOP = 4;
const BADGE_HEIGHT = 24;
const GUTTER_WIDTH = 5;

const statusPalette: Record<IntentStatus, { colorPalette: string; variant: "solid" | "subtle" }> = {
  pending: { colorPalette: "orange", variant: "subtle" },
  running: { colorPalette: "orange", variant: "solid" },
  finished: { colorPalette: "neutral", variant: "subtle" },
  failed: { colorPalette: "red", variant: "solid" },
  cancelled: { colorPalette: "gray", variant: "subtle" },
};

export interface IntentProvenanceIndicatorProps {
  display: IntentProvenanceDisplay | null;
  isActive?: boolean;
}

export function IntentProvenanceIndicator(props: IntentProvenanceIndicatorProps) {
  const { display, isActive } = props;

  if (!display) {
    return <Box width={GUTTER_WIDTH} />;
  }

  const palette = statusPalette[display.status];
  const isGenerating = isActive || display.status === "pending" || display.status === "running";

  return (
    <Box position="relative" width={GUTTER_WIDTH} minH="100%" py={2}>
      {display.connectTop && (
        <Box
          position="absolute"
          left="calc(50% - 1.5px)"
          top={0}
          width="3px"
          height={`${BADGE_TOP + BADGE_HEIGHT / 2}px`}
          bg="border"
        />
      )}
      {display.connectBottom && (
        <Box
          position="absolute"
          left="calc(50% - 1.5px)"
          top={`${BADGE_TOP + BADGE_HEIGHT / 2}px`}
          bottom={0}
          width="3px"
          bg="border"
        />
      )}

      <Stack gap={1} align="center" position="relative" zIndex={1} mt={`${BADGE_TOP}px`}>
        {display.label ? (
          display.description ? (
            <Tooltip content={display.description} positioning={{ placement: "left" }}>
              <Badge
                colorPalette={isGenerating ? "orange" : palette.colorPalette}
                variant={isGenerating ? "solid" : palette.variant}
                textAlign="center"
                whiteSpace="nowrap"
              >
                {display.label}
              </Badge>
            </Tooltip>
          ) : (
            <Badge
              colorPalette={isGenerating ? "orange" : palette.colorPalette}
              variant={isGenerating ? "solid" : palette.variant}
              textAlign="center"
              whiteSpace="nowrap"
            >
              {display.label}
            </Badge>
          )
        ) : (
          <Box bg="surface.muted" p={1} width="100%" height="100%"></Box>
        )}
      </Stack>
    </Box>
  );
}
