import { Card, Grid, HStack, IconButton, Stack, Text, VStack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { LuX } from "react-icons/lu";
import { Avatar, Field, Radio, RadioGroup } from "@/components/ui";
import { cardTypeLabels } from "@/features/characters/character-enums";
import { CharacterMultiSelect } from "@/features/characters/components/character-selector";
import { withFieldGroup } from "@/lib/app-form";
import { formatFormError } from "@/lib/form/field-control";
import { getApiUrl } from "@/lib/get-api-url";
import { useTRPC } from "@/lib/trpc";
import type { ScenarioFormValues } from "./form-schemas";

type ParticipantValues = ScenarioFormValues["participants"][number];

const participantDefaults: ParticipantValues = {
  characterId: "",
  role: undefined,
  isUserProxy: false,
};

type ParticipantManagerProps = {
  scenarioId?: string;
  disabled?: boolean;
};

export const ParticipantManager = withFieldGroup({
  defaultValues: { items: [] as ParticipantValues[] },
  props: {
    scenarioId: "",
    disabled: false,
  } satisfies ParticipantManagerProps as ParticipantManagerProps,
  render: function Render({ group, scenarioId, disabled = false }) {
    return (
      <group.Field name="items" mode="array">
        {(participantsField) => {
          const participants = participantsField.state.value ?? [];
          const selectedIds = participants.map(({ characterId }) => characterId);

          const errorMessages = participantsField.state.meta.errors
            .map((error) => formatFormError(error))
            .filter((message) => message.length > 0);

          const showErrors =
            errorMessages.length > 0 &&
            (participantsField.state.meta.isTouched || participantsField.state.meta.isDirty);

          const setUserProxyByIndex = (
            idx: number | null,
            source: ParticipantValues[] = participants
          ) => {
            const next = source.map((participant, participantIndex) => ({
              ...participant,
              isUserProxy: idx === participantIndex,
            }));
            participantsField.handleChange(next);
          };

          const handleCharacterSelection = (newIds: string[]) => {
            const currentById = new Map(
              participants.map((participant) => [participant.characterId, participant])
            );

            const next = newIds.map((id) => {
              const existing = currentById.get(id);
              return existing ?? { ...participantDefaults, characterId: id };
            });

            participantsField.handleChange(next);
          };

          return (
            <Stack gap={4}>
              <Field label="Add Characters">
                <CharacterMultiSelect
                  value={selectedIds}
                  onChange={handleCharacterSelection}
                  filterMode={scenarioId ? "notInScenario" : "all"}
                  scenarioId={scenarioId}
                  disabled={disabled}
                  hideClearTrigger
                />
              </Field>

              {participants.length === 0 ? (
                <Text color="content.muted" fontSize="sm">
                  Select characters to add them to the scenario.
                </Text>
              ) : (
                <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={4}>
                  {participants.map((participant, idx) => (
                    <ParticipantCard
                      // for array fields, key MUST be the index. any other key will cause crashes
                      // when removing items from the array, as there will be one render tick where
                      // group.store.values becomes undefined before the component is unmounted.
                      // see https://github.com/TanStack/form/issues/1561
                      // biome-ignore lint/suspicious/noArrayIndexKey: TODO remove after https://github.com/TanStack/form/pull/1729
                      key={idx}
                      form={group}
                      fields={`items[${idx}]`}
                      characterId={participant.characterId}
                      onRemove={() => participantsField.removeValue(idx)}
                      onSelectAsProxy={() => setUserProxyByIndex(idx)}
                    />
                  ))}
                </Grid>
              )}

              {showErrors &&
                errorMessages.map((message) => (
                  <Text key={message} color="fg.error" fontSize="sm">
                    {message}
                  </Text>
                ))}
            </Stack>
          );
        }}
      </group.Field>
    );
  },
});

type ParticipantCardProps = {
  characterId: string;
  onRemove: () => void;
  onSelectAsProxy: () => void;
};

const ParticipantCard = withFieldGroup({
  defaultValues: participantDefaults,
  props: {
    characterId: "",
    onRemove: () => {},
    onSelectAsProxy: () => {},
  } satisfies ParticipantCardProps as ParticipantCardProps,
  render: function Render({ group, onRemove, characterId, onSelectAsProxy }) {
    const trpc = useTRPC();

    const characterQuery = useQuery(
      trpc.characters.getById.queryOptions({ id: characterId }, { enabled: characterId.length > 0 })
    );

    const characterData = characterQuery.data;
    const displayName = characterData?.name || "Loading...";
    const isProxy = group.state.values.isUserProxy;

    return (
      <Card.Root layerStyle="surface">
        <Card.Body>
          <Stack gap={3}>
            <HStack justify="space-between">
              <HStack gap={2}>
                <Avatar
                  layerStyle="surface"
                  shape="rounded"
                  size="lg"
                  name={displayName}
                  src={getApiUrl(characterData?.avatarPath)}
                />
                <VStack gap={0} align="start">
                  <Text fontWeight="medium" truncate flex={1} minWidth={0}>
                    {displayName}
                  </Text>
                  <Text color="content.muted" textStyle="sm">
                    {cardTypeLabels[characterData?.cardType || "character"]}
                  </Text>
                </VStack>
              </HStack>
              <IconButton
                aria-label="Remove participant"
                size="xs"
                variant="ghost"
                colorPalette="red"
                onClick={onRemove}
              >
                <LuX />
              </IconButton>
            </HStack>

            <group.AppField name={"role"}>
              {(field) => (
                <field.TextInput
                  label="Role"
                  placeholder="e.g., Player, NPC, Antagonist (optional)"
                  size="sm"
                />
              )}
            </group.AppField>

            <RadioGroup
              value={isProxy ? characterId : ""}
              onValueChange={(details) => {
                if (details.value === characterId) {
                  onSelectAsProxy();
                }
              }}
            >
              <Radio value={characterId}>
                <Text fontSize="sm">Use for {"{{user}}"} replacements</Text>
              </Radio>
            </RadioGroup>
          </Stack>
        </Card.Body>
      </Card.Root>
    );
  },
});
