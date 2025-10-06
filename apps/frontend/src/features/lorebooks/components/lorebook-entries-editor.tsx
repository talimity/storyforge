import { Heading, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { LuLibrary, LuPlus } from "react-icons/lu";
import { Button, EmptyState } from "@/components/ui";
import { withForm } from "@/lib/app-form";
import {
  createLorebookEntryDraft,
  type LorebookEntryFormValues,
  lorebookFormDefaultValues,
} from "./form-schemas";
import { LorebookEntryCard } from "./lorebook-entry-card";

export const LorebookEntriesEditor = withForm({
  defaultValues: lorebookFormDefaultValues,
  render: function Render({ form }) {
    return (
      <form.Field name="entries" mode="array">
        {(entriesField) => {
          const entries = entriesField.state.value ?? [];

          const setEntries = (next: LorebookEntryFormValues[]) => {
            entriesField.handleChange(
              next.map((entry, idx) => ({
                ...entry,
                insertion_order: idx,
              }))
            );
          };

          const handleAdd = () => {
            const next = [
              ...entries,
              createLorebookEntryDraft(entries.length),
            ] as LorebookEntryFormValues[];
            setEntries(next);
          };

          const handleDuplicate = (index: number) => {
            const source = entries[index];
            if (!source) return;
            const clone: LorebookEntryFormValues = {
              ...source,
              insertion_order: entries.length,
            };
            const next = [...entries.slice(0, index + 1), clone, ...entries.slice(index + 1)];
            setEntries(next);
          };

          const handleMove = (index: number, target: number) => {
            if (target < 0 || target >= entries.length) return;
            const next = [...entries];
            const [item] = next.splice(index, 1);
            if (!item) return;
            next.splice(target, 0, item);
            setEntries(next);
          };

          const handleRemove = (index: number) => {
            const next = entries.filter((_, idx) => idx !== index);
            if (next.length === 0) {
              // ensure at least one blank entry remains per schema requirement
              setEntries([createLorebookEntryDraft(0)]);
            } else {
              setEntries(next);
            }
          };

          return (
            <Stack gap={6}>
              <HStack justify="space-between" align="center">
                <HStack gap={3}>
                  <LuLibrary size={20} />
                  <VStack align="start" gap={0}>
                    <Heading size="md">Lore Entries</Heading>
                    <Text color="content.muted" fontSize="sm">
                      Entries are matched against chat history to inject additional context.
                    </Text>
                  </VStack>
                </HStack>
                <Button variant="outline" onClick={handleAdd}>
                  <LuPlus /> Add Entry
                </Button>
              </HStack>

              {entries.length === 0 ? (
                <EmptyState
                  icon={<LuLibrary />}
                  title="No entries yet"
                  description="Add lore entries to control how characters recall information."
                  actionLabel="Add Entry"
                  onActionClick={handleAdd}
                />
              ) : (
                <VStack align="stretch" gap={4}>
                  {entries.map((_entry, index) => (
                    <LorebookEntryCard
                      // tanstack form array key guideline: use index
                      // biome-ignore lint/suspicious/noArrayIndexKey: required until library provides stable keys
                      key={index}
                      form={form}
                      fields={`entries[${index}]`}
                      index={index}
                      total={entries.length}
                      onDuplicate={() => handleDuplicate(index)}
                      onRemove={() => handleRemove(index)}
                      onMoveUp={() => handleMove(index, index - 1)}
                      onMoveDown={() => handleMove(index, index + 1)}
                    />
                  ))}
                </VStack>
              )}
            </Stack>
          );
        }}
      </form.Field>
    );
  },
});
