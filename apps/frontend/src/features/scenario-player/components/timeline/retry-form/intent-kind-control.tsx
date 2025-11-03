import { Box, SegmentGroup, Stack, Text } from "@chakra-ui/react";
import type { IntentKind } from "@storyforge/contracts";
import { useStore } from "@tanstack/react-form";
import { useMemo } from "react";
import {
  INTENT_KIND_CONFIG,
  intentFormDefaultValues,
} from "@/features/scenario-player/utils/intent-form";
import { withForm } from "@/lib/form/app-form";

const INTENT_KIND_SEGMENTS: Array<{
  value: IntentKind;
  label: string;
  description: string;
}> = [
  {
    value: "manual_control",
    label: "Direct Control",
    description: "Write a character's turn directly; another character will respond",
  },
  {
    value: "guided_control",
    label: "Guided Control",
    description: "Give high-level guidance to a character",
  },
  {
    value: "narrative_constraint",
    label: "Story Constraint",
    description:
      "Provide a specific goal or tone; the narrator will justify it in-universe before another character responds",
  },
  {
    value: "continue_story",
    label: "Continue Story",
    description: "Let the model respond without additional guidance",
  },
];

function isIntentKind(value: string | null | undefined): value is IntentKind {
  if (!value) return false;
  return INTENT_KIND_SEGMENTS.some((segment) => segment.value === value);
}

type IntentKindControlProps = {
  isGenerating?: boolean;
};

export const IntentKindControl = withForm({
  defaultValues: intentFormDefaultValues,
  props: {
    isGenerating: false,
  } satisfies IntentKindControlProps as IntentKindControlProps,
  render: function Render({ form, isGenerating = false }) {
    const selectedKind = useStore(
      form.store,
      (state) => state.values.kind ?? intentFormDefaultValues.kind
    );

    const selectedDescription = useMemo(
      () => INTENT_KIND_SEGMENTS.find((segment) => segment.value === selectedKind)?.description,
      [selectedKind]
    );

    return (
      <Stack gap={2}>
        <form.AppField name="kind">
          {(field) => (
            <field.Field label="Intent Kind">
              <Box overflowX="auto" maxW="100%" pb={1}>
                <SegmentGroup.Root
                  value={selectedKind}
                  onValueChange={(detail) => {
                    const next = detail.value;
                    if (!isIntentKind(next)) return;

                    field.handleChange(next);

                    const config = INTENT_KIND_CONFIG[next];
                    if (!config.allowsTarget) form.setFieldValue("characterId", null);
                    if (!config.requiresText) form.setFieldValue("text", "");
                  }}
                  size="xs"
                  disabled={isGenerating}
                >
                  <SegmentGroup.Indicator />
                  <SegmentGroup.Items items={INTENT_KIND_SEGMENTS} />
                </SegmentGroup.Root>
              </Box>
            </field.Field>
          )}
        </form.AppField>
        {selectedDescription ? (
          <Text fontSize="xs" color="content.muted" pl={1}>
            {selectedDescription}
          </Text>
        ) : null}
      </Stack>
    );
  },
});
