import { Card, Grid, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";
import { Avatar, Field, Radio, RadioGroup } from "@/components/ui/index";
import { CharacterMultiSelect } from "@/features/characters/components/character-selector";

import { getApiUrl } from "@/lib/get-api-url";

export interface ParticipantData {
  characterId: string;
  role?: string;
  isUserProxy?: boolean;
}

interface ParticipantWithDetails extends ParticipantData {
  character: {
    id: string;
    name: string;
    avatarPath?: string | null;
  };
}

interface ParticipantManagerProps {
  participants: ParticipantWithDetails[];
  onChange: (participants: ParticipantData[]) => void;
  scenarioId?: string;
  isDisabled?: boolean;
}

export function ParticipantManager({
  participants,
  onChange,
  scenarioId,
  isDisabled = false,
}: ParticipantManagerProps) {
  // Derive selected character IDs from participants prop
  const selectedCharacterIds = participants.map((p) => p.characterId);

  // Find which participant is the user proxy
  const userProxyId = participants.find((p) => p.isUserProxy)?.characterId;

  const handleCharacterSelectionChange = (newIds: string[]) => {
    // This handles both additions and removals from the multiselect
    const existingIds = participants.map((p) => p.characterId);
    const toAdd = newIds.filter((id) => !existingIds.includes(id));
    const toRemove = existingIds.filter((id) => !newIds.includes(id));

    // Keep participants that weren't removed, and add new ones
    const newParticipants: ParticipantData[] = [
      ...participants
        .filter((p) => !toRemove.includes(p.characterId))
        .map((p) => ({
          characterId: p.characterId,
          role: p.role,
          isUserProxy: p.isUserProxy,
        })),
      ...toAdd.map((id) => ({
        characterId: id,
        role: undefined,
        isUserProxy: false,
      })),
    ];
    onChange(newParticipants);
  };

  const handleRemoveParticipant = (characterId: string) => {
    const newParticipants = participants
      .filter((p) => p.characterId !== characterId)
      .map((p) => ({
        characterId: p.characterId,
        role: p.role,
        isUserProxy: p.isUserProxy,
      }));
    onChange(newParticipants);
  };

  const handleRoleChange = (characterId: string, role: string) => {
    const newParticipants = participants.map((p) => ({
      characterId: p.characterId,
      role: p.characterId === characterId ? role : p.role,
      isUserProxy: p.isUserProxy,
    }));
    onChange(newParticipants);
  };

  const handleUserProxyChange = (characterId: string | null) => {
    if (!characterId) return;
    const newParticipants = participants.map((p) => ({
      characterId: p.characterId,
      role: p.role,
      isUserProxy: p.characterId === characterId,
    }));
    onChange(newParticipants);
  };

  return (
    <Stack gap={4}>
      {/* Add Characters */}
      <Stack gap={2}>
        <Field label="Add Characters"></Field>
        <CharacterMultiSelect
          value={selectedCharacterIds}
          onChange={handleCharacterSelectionChange}
          filterMode={scenarioId ? "notInScenario" : "all"}
          scenarioId={scenarioId}
          disabled={isDisabled}
          hideClearTrigger
        />
      </Stack>

      {/* Current Participants */}
      <Grid templateColumns="repeat(auto-fill, minmax(280px, 1fr))" gap={4}>
        {participants.map((participant) => (
          <Card.Root key={participant.characterId} layerStyle="surface">
            <Card.Body>
              <Stack gap={3}>
                {/* Character Info & Remove Button */}
                <HStack justify="space-between">
                  <HStack gap={2}>
                    <Avatar
                      shape="rounded"
                      size="lg"
                      name={participant.character.name}
                      src={
                        participant.character.avatarPath
                          ? getApiUrl(participant.character.avatarPath)
                          : undefined
                      }
                    />
                    <Text fontWeight="medium">{participant.character.name}</Text>
                  </HStack>
                  <IconButton
                    aria-label="Remove participant"
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => handleRemoveParticipant(participant.characterId)}
                    disabled={isDisabled}
                  >
                    <LuX />
                  </IconButton>
                </HStack>

                {/* Role Input */}
                <Field label="Role" optionalText=" (optional)">
                  <Input
                    size="sm"
                    placeholder="e.g., Player, NPC, Antagonist..."
                    value={participant.role || ""}
                    onChange={(e) => handleRoleChange(participant.characterId, e.target.value)}
                    disabled={isDisabled}
                  />
                </Field>

                {/* User Proxy Selection */}
                <RadioGroup
                  value={userProxyId || ""}
                  onValueChange={(details) => handleUserProxyChange(details.value)}
                  disabled={isDisabled}
                >
                  <Radio value={participant.characterId}>
                    <Text fontSize="sm">Use for {"{{user}}"} replacements</Text>
                  </Radio>
                </RadioGroup>
              </Stack>
            </Card.Body>
          </Card.Root>
        ))}
      </Grid>

      {/* Validation Message */}
      {participants.length < 2 && (
        <Text color="red.500" fontSize="sm">
          A scenario requires at least 2 characters.
        </Text>
      )}
    </Stack>
  );
}
