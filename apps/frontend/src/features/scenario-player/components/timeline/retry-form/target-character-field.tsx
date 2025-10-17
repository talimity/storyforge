import { HStack, Stack, Text } from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { CharacterMiniSelect } from "@/features/scenario-player/components/intent-panel/character-mini-select";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import {
  INTENT_KIND_CONFIG,
  intentFormDefaultValues,
} from "@/features/scenario-player/utils/intent-form";
import { withFieldGroup } from "@/lib/app-form";

type TargetCharacterFieldProps = {
  isGenerating?: boolean;
};

type TargetCharacterValues = Pick<typeof intentFormDefaultValues, "characterId" | "kind">;

export const TargetCharacterField = withFieldGroup({
  defaultValues: {
    characterId: intentFormDefaultValues.characterId,
    kind: intentFormDefaultValues.kind,
  } satisfies TargetCharacterValues as TargetCharacterValues,
  props: {
    isGenerating: false,
  } satisfies TargetCharacterFieldProps as TargetCharacterFieldProps,
  render: function Render({ group, isGenerating = false }) {
    const { characters, getCharacterById } = useScenarioContext();
    const kind = useStore(
      group.store,
      (state) => state.values.kind ?? intentFormDefaultValues.kind
    );
    const config = INTENT_KIND_CONFIG[kind];

    if (!config.allowsTarget) {
      return null;
    }

    return (
      <group.AppField name="characterId">
        {(field) => {
          const selectedName = getCharacterById(field.state.value)?.name || null;

          return (
            <field.Field label="Target Character" required={config.requiresTarget}>
              <Stack gap={2}>
                <HStack gap={2} alignItems="center">
                  <CharacterMiniSelect
                    characters={characters}
                    value={field.state.value || null}
                    onChange={(value) => {
                      field.handleChange(value);
                      field.handleBlur();
                    }}
                    portalled={false}
                    disabled={isGenerating}
                  />
                  <Text fontSize="sm" color="content.muted">
                    {selectedName}
                  </Text>
                </HStack>
                {!selectedName && config.requiresTarget ? (
                  <Text fontSize="xs" color="content.muted" pl={1}>
                    Select who should take this turn.
                  </Text>
                ) : null}
              </Stack>
            </field.Field>
          );
        }}
      </group.AppField>
    );
  },
});
