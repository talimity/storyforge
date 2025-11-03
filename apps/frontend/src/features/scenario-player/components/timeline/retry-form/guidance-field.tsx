import { Box, Text } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import {
  INTENT_KIND_CONFIG,
  intentFormDefaultValues,
} from "@/features/scenario-player/utils/intent-form";
import { withFieldGroup } from "@/lib/form/app-form";

type GuidanceFieldProps = {
  isGenerating?: boolean;
};

type GuidanceFieldValues = Pick<typeof intentFormDefaultValues, "text" | "kind" | "characterId">;

function buildPlaceholder(
  kind: GuidanceFieldValues["kind"],
  characterName?: string | null
): string {
  if (characterName) {
    return `Enter ${characterName}'s action or dialogue...`;
  }

  switch (kind) {
    case "manual_control":
      return "Describe the exact turn you want";
    case "guided_control":
      return "Share the guidance for this character's next turn";
    case "narrative_constraint":
      return "Explain the constraint or direction for the story";
    default:
      return "Provide optional notes for the next turn";
  }
}

export const GuidanceField = withFieldGroup({
  defaultValues: {
    text: intentFormDefaultValues.text,
    kind: intentFormDefaultValues.kind,
    characterId: intentFormDefaultValues.characterId,
  } satisfies GuidanceFieldValues as GuidanceFieldValues,
  props: {
    isGenerating: false,
  } satisfies GuidanceFieldProps as GuidanceFieldProps,
  render: function Render({ group, isGenerating = false }) {
    const { getCharacterById } = useScenarioContext();
    const kind = useStore(
      group.store,
      (state) => state.values.kind ?? intentFormDefaultValues.kind
    );
    const characterId = useStore(group.store, (state) => state.values.characterId || null);
    const selectedCharacterName = getCharacterById(characterId)?.name;

    const config = INTENT_KIND_CONFIG[kind];

    if (!config.requiresText) {
      return (
        <Box>
          <Text fontSize="xs" color="content.muted">
            No additional guidance needed. Select Retry to continue from this point.
          </Text>
        </Box>
      );
    }

    return (
      <group.AppField name="text">
        {(field) => (
          <field.TextareaInput
            label="Intent Guidance"
            required
            minRows={3}
            maxRows={12}
            disabled={isGenerating}
            placeholder={buildPlaceholder(kind, selectedCharacterName)}
          />
        )}
      </group.AppField>
    );
  },
});
