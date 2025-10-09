import { Card, HStack, IconButton, Stack, Text, VStack } from "@chakra-ui/react";
import { sortScenarioLorebooks } from "@storyforge/lorebooks";
import { useStore } from "@tanstack/react-form";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import { Switch } from "@/components/ui";
import {
  LorebookMultiSelect,
  type LorebookSelectItem,
} from "@/features/lorebooks/components/lorebook-selector";
import {
  type ScenarioFormValues,
  scenarioFormDefaultValues,
} from "@/features/scenarios/components/form-schemas";
import { formatFormError, withForm } from "@/lib/app-form";
import { useTRPC } from "@/lib/trpc";

export type ScenarioLorebookFormValue = ScenarioFormValues["lorebooks"][number];

type ScenarioLorebookManagerProps = {
  disabled?: boolean;
};

type ManualDisplayInfo = {
  lorebookId: string;
  name: string;
  entryCount: number;
};

type CharacterLorebookDisplayInfo = {
  lorebookId: string;
  characterLorebookId: string;
  name: string;
  entryCount: number;
};

type ManualScenarioLorebook = Extract<ScenarioLorebookFormValue, { kind: "manual" }>;
type CharacterScenarioLorebook = Extract<ScenarioLorebookFormValue, { kind: "character" }>;

export const ScenarioLorebookManager = withForm({
  defaultValues: scenarioFormDefaultValues,
  props: { disabled: false } satisfies ScenarioLorebookManagerProps,
  render: function Render({ form, disabled = false }) {
    const participants = useStore(form.store, (state) => state.values.participants ?? []);
    const storedLorebooks = useStore(form.store, (state) => state.values.lorebooks ?? []);

    const participantIds = getUniqueParticipantIds(participants);
    const { names: characterNames } = useCharacterNames(participantIds);
    const characterLorebooks = useCharacterLorebookMap(participantIds);

    const [manualDraftDisplay, setManualDraftDisplay] = useState<Record<string, ManualDisplayInfo>>(
      {}
    );
    const manualIdsFromStore = getManualLorebookIds(storedLorebooks);
    const manualDisplay = useManualLorebookDisplay(manualIdsFromStore, manualDraftDisplay);

    useEffect(() => {
      const next = mergeScenarioLorebooks({
        current: storedLorebooks,
        participantIds,
        characterLorebooks,
      });

      if (!areScenarioLorebooksEqual(storedLorebooks, next)) {
        form.setFieldValue("lorebooks", next);
      }
    }, [form, storedLorebooks, participantIds, characterLorebooks]);

    return (
      <form.Field name="lorebooks" mode="array">
        {(lorebooksField) => {
          const lorebooks = lorebooksField.state.value ?? [];
          const manualEntries = lorebooks.filter(isManualEntry);
          const inheritedEntries = lorebooks.filter(isCharacterEntry);

          const errorMessages = lorebooksField.state.meta.errors
            .map((error) => formatFormError(error))
            .filter((message) => message.length > 0);
          const showErrors = errorMessages.length > 0 && lorebooksField.state.meta.isTouched;

          const updateLorebooks = (entries: ScenarioLorebookFormValue[]) => {
            lorebooksField.handleChange(sortFormLorebooks(entries));
          };

          const handleAddLorebooks = (items: LorebookSelectItem[]) => {
            if (items.length === 0) return;
            const current = lorebooksField.state.value ?? [];
            const next: ScenarioLorebookFormValue[] = [...current];
            const existingManualIds = new Set(
              current.filter(isManualEntry).map((entry) => entry.lorebookId)
            );

            for (const item of items) {
              if (existingManualIds.has(item.id)) {
                continue;
              }

              next.push({
                kind: "manual",
                lorebookId: item.id,
                manualAssignmentId: null,
                enabled: true,
                defaultEnabled: true,
                name: item.name,
                entryCount: item.entryCount,
              });
              existingManualIds.add(item.id);
            }

            updateLorebooks(next);

            setManualDraftDisplay((prev) => {
              const nextDisplay = { ...prev };
              for (const item of items) {
                nextDisplay[item.id] = {
                  lorebookId: item.id,
                  name: item.name,
                  entryCount: item.entryCount,
                };
              }
              return nextDisplay;
            });
          };

          const handleRemoveManualLorebook = (lorebookId: string) => {
            const current = lorebooksField.state.value ?? [];
            const next = current.filter(
              (entry) => !(isManualEntry(entry) && entry.lorebookId === lorebookId)
            );

            setManualDraftDisplay((prev) => {
              if (!(lorebookId in prev)) return prev;
              const nextDisplay = { ...prev };
              delete nextDisplay[lorebookId];
              return nextDisplay;
            });

            updateLorebooks(next);
          };

          const handleToggle = (entry: ScenarioLorebookFormValue, enabled: boolean) => {
            const key = getScenarioLorebookKey(entry);
            const current = lorebooksField.state.value ?? [];
            const next = current.map((item) =>
              getScenarioLorebookKey(item) === key ? applyToggle(item, enabled) : item
            );
            updateLorebooks(next);
          };

          return (
            <Stack gap={4}>
              <LorebookMultiSelect onSelect={handleAddLorebooks} disabled={disabled} />

              {manualEntries.length > 0 && (
                <Stack gap={3}>
                  <Text fontWeight="bold">Manual assignments</Text>
                  <Stack gap={3}>
                    {manualEntries.map((lorebook) => {
                      const display = manualDisplay[lorebook.lorebookId];
                      const displayName = display?.name ?? lorebook.name ?? lorebook.lorebookId;
                      const entryCount = display?.entryCount ?? lorebook.entryCount;
                      return (
                        <ScenarioLorebookRow
                          key={getScenarioLorebookKey(lorebook)}
                          lorebook={lorebook}
                          displayName={displayName}
                          entryCount={entryCount}
                          characterName={undefined}
                          onToggle={handleToggle}
                          onRemove={() => handleRemoveManualLorebook(lorebook.lorebookId)}
                          canRemove
                          disabled={disabled}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
              )}

              {inheritedEntries.length > 0 && (
                <Stack gap={3}>
                  <Text fontWeight="bold">Inherited assignments</Text>
                  <Stack gap={3}>
                    {inheritedEntries.map((lorebook) => {
                      const display = findInheritedDisplayInfo(lorebook, characterLorebooks);
                      const displayName = display?.name ?? lorebook.name ?? lorebook.lorebookId;
                      const entryCount = display?.entryCount ?? lorebook.entryCount;
                      const characterName =
                        characterNames[lorebook.characterId] ?? lorebook.characterId;
                      return (
                        <ScenarioLorebookRow
                          key={getScenarioLorebookKey(lorebook)}
                          lorebook={lorebook}
                          displayName={displayName}
                          entryCount={entryCount}
                          characterName={characterName}
                          onToggle={handleToggle}
                          disabled={disabled}
                        />
                      );
                    })}
                  </Stack>
                </Stack>
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
      </form.Field>
    );
  },
});

type ScenarioLorebookRowProps = {
  lorebook: ScenarioLorebookFormValue;
  displayName: string;
  entryCount?: number;
  characterName?: string;
  onToggle: (entry: ScenarioLorebookFormValue, enabled: boolean) => void;
  onRemove?: () => void;
  canRemove?: boolean;
  disabled?: boolean;
};

function ScenarioLorebookRow({
  lorebook,
  displayName,
  entryCount,
  characterName,
  onToggle,
  onRemove,
  canRemove = false,
  disabled = false,
}: ScenarioLorebookRowProps) {
  const isInherited = lorebook.kind === "character";

  return (
    <Card.Root layerStyle="surface" opacity={lorebook.enabled ? 1 : 0.6}>
      <Card.Body>
        <HStack align="flex-start" justify="space-between" gap={3}>
          <VStack align="flex-start" gap={1} flex={1} minW={0}>
            <HStack gap={2}>
              <Text fontWeight="medium" flex={1} minW={0} truncate>
                {displayName}
              </Text>
              <Text fontSize="xs" px={2} py={0.5} borderRadius="full" bg="surface.muted">
                {isInherited ? "Inherited" : "Manual"}
              </Text>
            </HStack>
            <Text color="content.muted" fontSize="sm">
              {entryCount ?? 0} entries
            </Text>
            {isInherited && characterName && (
              <Text color="content.muted" fontSize="sm">
                From {characterName}
              </Text>
            )}
          </VStack>

          <HStack gap={2}>
            <Switch
              size="sm"
              checked={lorebook.enabled}
              onCheckedChange={(event) => onToggle(lorebook, event.checked)}
              disabled={disabled}
            />
            {canRemove && !!onRemove && (
              <IconButton
                aria-label="Remove lorebook"
                size="sm"
                variant="ghost"
                colorPalette="red"
                onClick={onRemove}
                disabled={disabled}
              >
                <LuTrash2 />
              </IconButton>
            )}
          </HStack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}

function isManualEntry(entry: ScenarioLorebookFormValue): entry is ManualScenarioLorebook {
  return entry.kind === "manual";
}

function isCharacterEntry(entry: ScenarioLorebookFormValue): entry is CharacterScenarioLorebook {
  return entry.kind === "character";
}

function applyToggle(
  entry: ScenarioLorebookFormValue,
  enabled: boolean
): ScenarioLorebookFormValue {
  if (isManualEntry(entry)) {
    return { ...entry, enabled };
  }

  const overrideEnabled = enabled === entry.defaultEnabled ? null : enabled;
  return { ...entry, enabled, overrideEnabled };
}

function sortFormLorebooks(entries: ScenarioLorebookFormValue[]): ScenarioLorebookFormValue[] {
  const wrapped = entries.map((entry) => ({
    kind: entry.kind,
    sortKey: entry.name ?? entry.lorebookId,
    entry,
  }));

  return sortScenarioLorebooks(wrapped).map((item) => item.entry);
}

function getScenarioLorebookKey(entry: ScenarioLorebookFormValue) {
  if (isManualEntry(entry)) {
    return `manual:${entry.lorebookId}`;
  }
  return `character:${entry.characterLorebookId}`;
}

function mergeScenarioLorebooks(options: {
  current: ScenarioLorebookFormValue[];
  participantIds: string[];
  characterLorebooks: Record<string, CharacterLorebookDisplayInfo[]>;
}): ScenarioLorebookFormValue[] {
  const { current, participantIds, characterLorebooks } = options;
  const existingByKey = new Map(current.map((entry) => [getScenarioLorebookKey(entry), entry]));
  const manualEntries = current.filter(isManualEntry);
  const next: ScenarioLorebookFormValue[] = [...manualEntries];

  for (const characterId of participantIds) {
    const displays = characterLorebooks[characterId] ?? [];
    for (const display of displays) {
      const key = `character:${display.characterLorebookId}`;
      const existing = existingByKey.get(key);
      if (existing && isCharacterEntry(existing)) {
        next.push(existing);
        continue;
      }

      next.push({
        kind: "character",
        lorebookId: display.lorebookId,
        characterId,
        characterLorebookId: display.characterLorebookId,
        enabled: true,
        defaultEnabled: true,
        overrideEnabled: null,
        name: display.name,
        entryCount: display.entryCount,
      });
    }
  }

  return sortFormLorebooks(next);
}

function areScenarioLorebooksEqual(
  left: ScenarioLorebookFormValue[],
  right: ScenarioLorebookFormValue[]
) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];

    if (a.kind !== b.kind) {
      return false;
    }

    if (isManualEntry(a) && isManualEntry(b)) {
      if (
        a.lorebookId !== b.lorebookId ||
        a.enabled !== b.enabled ||
        a.manualAssignmentId !== b.manualAssignmentId ||
        a.defaultEnabled !== b.defaultEnabled
      ) {
        return false;
      }
      continue;
    }

    if (isCharacterEntry(a) && isCharacterEntry(b)) {
      if (
        a.characterLorebookId !== b.characterLorebookId ||
        a.enabled !== b.enabled ||
        a.defaultEnabled !== b.defaultEnabled ||
        a.overrideEnabled !== b.overrideEnabled
      ) {
        return false;
      }
      continue;
    }

    return false;
  }

  return true;
}

function getUniqueParticipantIds(participants: ScenarioFormValues["participants"]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const participant of participants) {
    const identifier = participant?.characterId;
    if (typeof identifier === "string" && identifier.length > 0 && !seen.has(identifier)) {
      seen.add(identifier);
      ids.push(identifier);
    }
  }
  return ids;
}

function getManualLorebookIds(lorebooks: ScenarioLorebookFormValue[]): string[] {
  const ids: string[] = [];
  for (const entry of lorebooks) {
    if (isManualEntry(entry)) {
      ids.push(entry.lorebookId);
    }
  }
  return ids;
}

function useCharacterNames(characterIds: string[]) {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.characters.getByIds.queryOptions(
      { ids: characterIds },
      { enabled: characterIds.length > 0, staleTime: 60 * 1000 }
    )
  );

  const names: Record<string, string> = {};
  const characterList = query.data?.characters ?? [];
  for (const character of characterList) {
    names[character.id] = character.name;
  }

  return { names };
}

function useCharacterLorebookMap(characterIds: string[]) {
  const trpc = useTRPC();
  const queries = useQueries({
    queries: characterIds.map((id) =>
      trpc.characterLorebooks.list.queryOptions(
        { id },
        { enabled: id.length > 0, staleTime: 60 * 1000 }
      )
    ),
  });

  const lorebooksByCharacter: Record<string, CharacterLorebookDisplayInfo[]> = {};
  for (let index = 0; index < characterIds.length; index += 1) {
    const id = characterIds[index];
    const query = queries[index];
    if (!query?.data) continue;
    const summaries = query.data.lorebooks ?? [];
    lorebooksByCharacter[id] = summaries.map((summary) => ({
      lorebookId: summary.id,
      characterLorebookId: summary.characterLorebookId,
      name: summary.name,
      entryCount: summary.entryCount,
    }));
  }

  return lorebooksByCharacter;
}

function useManualLorebookDisplay(
  manualIds: string[],
  draftDisplay: Record<string, ManualDisplayInfo>
) {
  const trpc = useTRPC();
  const queries = useQueries({
    queries: manualIds.map((id) =>
      trpc.lorebooks.getById.queryOptions({ id }, { enabled: id.length > 0, staleTime: 60 * 1000 })
    ),
  });

  const display: Record<string, ManualDisplayInfo> = {};

  for (let index = 0; index < manualIds.length; index += 1) {
    const id = manualIds[index];
    const query = queries[index];
    if (query?.data) {
      display[id] = {
        lorebookId: query.data.id,
        name: query.data.name,
        entryCount: query.data.entryCount,
      };
      continue;
    }

    if (draftDisplay[id]) {
      display[id] = draftDisplay[id];
    }
  }

  return display;
}

function findInheritedDisplayInfo(
  entry: CharacterScenarioLorebook,
  characterLorebooks: Record<string, CharacterLorebookDisplayInfo[]>
) {
  const summaries = characterLorebooks[entry.characterId] ?? [];
  for (const summary of summaries) {
    if (summary.characterLorebookId === entry.characterLorebookId) {
      return summary;
    }
  }
  return undefined;
}
