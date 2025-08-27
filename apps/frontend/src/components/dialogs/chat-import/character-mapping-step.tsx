import { Box, Grid, HStack, Icon, Input, Text, VStack } from "@chakra-ui/react";
import type {
  CharacterMapping,
  ChatImportAnalyzeOutput,
} from "@storyforge/schemas";
import { LuMessageCircle, LuUser } from "react-icons/lu";
import { CharacterSingleSelect } from "@/components/features/character/character-selector";
import { Field } from "@/components/ui";

interface CharacterMappingStepProps {
  scenarioName: string;
  setScenarioName: (name: string) => void;
  scenarioDescription: string;
  setScenarioDescription: (description: string) => void;
  analyzeResult: ChatImportAnalyzeOutput | null;
  characterMappings: CharacterMapping[];
  updateMapping: (index: number, mapping: Partial<CharacterMapping>) => void;
}

export function CharacterMappingStep({
  scenarioName,
  setScenarioName,
  scenarioDescription,
  setScenarioDescription,
  analyzeResult,
  characterMappings,
  updateMapping,
}: CharacterMappingStepProps) {
  return (
    <VStack gap={4} align="stretch">
      <Field label="Scenario Name" required>
        <Input
          value={scenarioName}
          onChange={(e) => setScenarioName(e.target.value)}
          placeholder="Enter scenario name"
        />
      </Field>

      <Field label="Description" optionalText="(optional)">
        <Input
          value={scenarioDescription}
          onChange={(e) => setScenarioDescription(e.target.value)}
          placeholder="Optional description"
        />
      </Field>

      {analyzeResult && (
        <Box>
          <Text fontWeight="medium" mb={2}>
            Detected Characters ({analyzeResult.detectedCharacters.length})
          </Text>
          <Text fontSize="sm" color="content.muted" mb={4}>
            Assign the detected characters to existing characters in your
            library, set them as narrators, or choose to drop their messages.
          </Text>

          <VStack gap={3} align="stretch" maxH="300px" overflowY="auto">
            {characterMappings.map((mapping, index) => {
              const stats = analyzeResult.detectedCharacters[index];
              return (
                <CharacterMappingItem
                  key={stats.name}
                  stats={stats}
                  mapping={mapping}
                  onUpdate={(updates) => updateMapping(index, updates)}
                />
              );
            })}
          </VStack>
        </Box>
      )}
    </VStack>
  );
}

interface CharacterMappingItemProps {
  stats: ChatImportAnalyzeOutput["detectedCharacters"][0];
  mapping: CharacterMapping;
  onUpdate: (mapping: Partial<CharacterMapping>) => void;
}

function CharacterMappingItem({
  stats,
  mapping,
  onUpdate,
}: CharacterMappingItemProps) {
  return (
    <Box p={3} bg="surface.subtle" borderRadius="md">
      <Grid templateColumns="1fr 2fr" gap={3} alignItems="center">
        <HStack gap={2}>
          <Icon size="sm">
            {stats.isUser ? <LuUser /> : <LuMessageCircle />}
          </Icon>
          <VStack align="start" gap={0}>
            <Text fontWeight="medium">{stats.name}</Text>
            <Text fontSize="xs" color="content.muted">
              {stats.messageCount} message
              {stats.messageCount !== 1 ? "s" : ""}
            </Text>
          </VStack>
        </HStack>

        <HStack gap={2}>
          <select
            value={mapping.targetType}
            onChange={(e) =>
              onUpdate({
                targetType: e.target.value as CharacterMapping["targetType"],
                characterId: undefined,
              })
            }
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid var(--chakra-colors-surface-border)",
              background: "var(--chakra-colors-surface)",
            }}
          >
            <option value="character">Character</option>
            <option value="narrator">Narrator</option>
            <option value="ignore">Drop</option>
          </select>

          {mapping.targetType === "character" && (
            <Box flex={1}>
              <CharacterSingleSelect
                inDialog
                value={mapping.characterId || null}
                onChange={(id) =>
                  onUpdate({
                    characterId: id || undefined,
                  })
                }
                placeholder="Select character"
              />
            </Box>
          )}
        </HStack>
      </Grid>
    </Box>
  );
}
