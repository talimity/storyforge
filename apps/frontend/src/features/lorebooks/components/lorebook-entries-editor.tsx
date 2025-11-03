import {
  ButtonGroup,
  Center,
  IconButton,
  Input,
  InputGroup,
  Pagination,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { createId } from "@storyforge/utils";
import { useStore } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import { LuChevronLeft, LuChevronRight, LuLibrary, LuPlus, LuSearch } from "react-icons/lu";
import { Button, CloseButton, EmptyState } from "@/components/ui";
import { TabHeader } from "@/components/ui/tab-header";
import { withForm } from "@/lib/form/app-form";
import {
  createLorebookEntryDraft,
  type LorebookEntryFormValues,
  lorebookFormDefaultValues,
} from "./form-schemas";
import { LorebookEntryCard, LorebookEntryCardViewMode } from "./lorebook-entry-card";

export const LorebookEntriesEditor = withForm({
  defaultValues: lorebookFormDefaultValues,
  render: function Render({ form }) {
    const [editingId, setEditingId] = useState<Set<string>>(new Set<string>());
    const [matchedIds, setMatchedIds] = useState<Set<string> | null>(null);
    return (
      <form.AppField name="entries" mode="array">
        {(entriesField) => {
          const entries = entriesField.state.value ?? [];

          const handleAdd = () => entriesField.pushValue(createLorebookEntryDraft(entries.length));

          const handleDuplicate = (index: number) => {
            const source = entries[index];
            if (!source) return;
            const clone: LorebookEntryFormValues = {
              ...source,
              id: createId(),
              insertion_order: entries.length,
            };
            entriesField.pushValue(clone);
          };

          return (
            <Stack gap={6}>
              <TabHeader
                title="Lore Entries"
                description="Entries are matched against recent turns to inject relevant lore content."
                icon={LuLibrary}
                actions={
                  <Button variant="outline" onClick={handleAdd}>
                    <LuPlus /> Add Entry
                  </Button>
                }
              />

              <LorebookEntriesFilter form={form} onFilterChange={setMatchedIds} />

              {entries.length === 0 ? (
                <EmptyState
                  icon={<LuLibrary />}
                  title="No entries yet"
                  description="Add lore entries to control how characters recall information."
                  actionLabel="Add Entry"
                  onActionClick={handleAdd}
                />
              ) : matchedIds && matchedIds.size === 0 ? (
                <EmptyState
                  icon={<LuSearch />}
                  title="No matching entries"
                  description="No entries match the current filter."
                />
              ) : (
                <VStack align="stretch" gap={4}>
                  {entries.map((entry, idx) => {
                    if (matchedIds && !matchedIds.has(String(entry.id))) {
                      return null;
                    }

                    const LorebookEntryComponent = editingId.has(String(entry.id))
                      ? LorebookEntryCard
                      : LorebookEntryCardViewMode;
                    return (
                      <LorebookEntryComponent
                        // https://github.com/TanStack/form/issues/1561
                        // biome-ignore lint/suspicious/noArrayIndexKey: array fields break unless you specifically use index key
                        key={idx}
                        form={form}
                        fields={`entries[${idx}]` as const}
                        index={idx}
                        total={entries.length}
                        onDuplicate={() => handleDuplicate(idx)}
                        onRemove={() => entriesField.removeValue(idx)}
                        onMoveUp={() => idx > 0 && entriesField.moveValue(idx, idx - 1)}
                        onMoveDown={() =>
                          idx < entriesField.state.value.length - 1 &&
                          entriesField.moveValue(idx, idx + 1)
                        }
                        onEdit={() => setEditingId((prev) => new Set(prev).add(String(entry.id)))}
                        onDismiss={() =>
                          setEditingId((prev) => {
                            const next = new Set(prev);
                            next.delete(String(entry.id));
                            return next;
                          })
                        }
                      />
                    );
                  })}
                </VStack>
              )}
            </Stack>
          );
        }}
      </form.AppField>
    );
  },
});

const PAGE_SIZE = 20;

const LorebookEntriesFilter = withForm({
  defaultValues: lorebookFormDefaultValues,
  props: {
    onFilterChange: (_matchingIds: Set<string>) => {},
  },
  render: function Render(props) {
    "use no memo";
    // need to disable compiler as it does not play well with this combination
    // of tanstack form HOCs/mutable refs that are necessary to get this form
    // to perform well with very large lorebooks.

    const { form, onFilterChange } = props;
    // leave uncontrolled to avoid expensive re-rendering and filtering
    const [filterValue, setFilterValue] = useState("");
    const [page, setPage] = useState(1);
    const inputRef = useRef<HTMLInputElement>(null);
    const size = useStore(form.store, (s) => s.values.entries?.length ?? 0);

    const filteredSizeRef = useRef(size);

    // biome-ignore lint/correctness/useExhaustiveDependencies: react to new or deleted entries without subscribing to the whole array
    useEffect(() => {
      const matchingIds = new Set<string>();
      const filter = filterValue.trim().toLowerCase();
      const entries = form.getFieldValue("entries") ?? [];

      entries.forEach((entry) => {
        const { id, comment, content } = entry;
        if (
          !filter ||
          comment?.toLowerCase().includes(filter) ||
          content.toLowerCase().includes(filter)
        ) {
          matchingIds.add(String(id));
        }
      });

      const maxPage = Math.ceil(matchingIds.size / PAGE_SIZE);
      const clampedPage = Math.min(page, Math.max(1, maxPage));
      const start = (clampedPage - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const sliced = new Set<string>(Array.from(matchingIds).slice(start, end));

      filteredSizeRef.current = matchingIds.size;

      onFilterChange(sliced);
    }, [filterValue, form, page, size, onFilterChange]);

    const endElement = filterValue ? (
      <CloseButton
        size="xs"
        onClick={() => {
          setFilterValue("");
          setPage(1);
          inputRef.current?.focus();
          if (inputRef.current) {
            inputRef.current.value = "";
          }
        }}
        me="-2"
      />
    ) : undefined;

    return (
      <Stack>
        <InputGroup startElement={<LuSearch />} endElement={endElement}>
          <Input
            ref={inputRef}
            autoComplete="off"
            onBlur={(e) => setFilterValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setFilterValue(e.currentTarget.value);
              }
            }}
            placeholder="Filter entries..."
            size="sm"
          />
        </InputGroup>
        {filteredSizeRef.current > PAGE_SIZE && (
          <Center>
            <Pagination.Root
              count={filteredSizeRef.current}
              pageSize={PAGE_SIZE}
              page={page}
              onPageChange={(e) => setPage(e.page)}
            >
              <Stack direction="column" align="center">
                <Text fontSize="xs" asChild>
                  <Pagination.PageText format="long" />
                </Text>
                <ButtonGroup variant="ghost" size="xs">
                  <Pagination.PrevTrigger asChild>
                    <IconButton>
                      <LuChevronLeft />
                    </IconButton>
                  </Pagination.PrevTrigger>

                  <Pagination.Items
                    render={(page) => (
                      <IconButton variant={{ base: "ghost", _selected: "outline" }}>
                        {page.value}
                      </IconButton>
                    )}
                  />

                  <Pagination.NextTrigger asChild>
                    <IconButton>
                      <LuChevronRight />
                    </IconButton>
                  </Pagination.NextTrigger>
                </ButtonGroup>
              </Stack>
            </Pagination.Root>
          </Center>
        )}
      </Stack>
    );
  },
});
