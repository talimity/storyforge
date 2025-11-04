import type { TaskKind } from "@storyforge/gentasks";
import type { ChatCompletionMessageRole } from "@storyforge/prompt-rendering";
import { createId } from "@storyforge/utils";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  generateSlotName,
  getDefaultMessageContent,
} from "@/features/template-builder/services/builder-utils";
import { validateDraft } from "@/features/template-builder/services/compile-draft";
import { getRecipeById } from "@/features/template-builder/services/recipe-registry";
import { syncSlotLayoutWithRecipe } from "@/features/template-builder/services/recipe-slot-layout";
import type { SlotBlockDraft } from "@/features/template-builder/services/template-import";
import type {
  AnyRecipeId,
  AttachmentLaneDraft,
  LayoutNodeDraft,
  SlotDraft,
  SlotLayoutDraft,
  TemplateDraft,
} from "@/features/template-builder/types";

export class SlotImportError extends Error {
  constructor(
    message: string,
    public kind: "conflict" | "unknown" = "unknown"
  ) {
    super(message);
    this.name = "SlotImportError";
  }
}

export interface TemplateBuilderState {
  layoutDraft: LayoutNodeDraft[];
  slotsDraft: Record<string, SlotDraft>;
  attachmentDrafts: Record<string, AttachmentLaneDraft>;
  editingNodeId: string | null;
  isDirty: boolean;

  // Actions
  initialize: (draft: TemplateDraft) => void;
  reset: () => void;
  markClean: () => void;

  // Layout Actions
  addMessageNode: (role: ChatCompletionMessageRole, index?: number) => void;
  updateMessageNode: (
    nodeId: string,
    updates: Partial<Omit<LayoutNodeDraft & { kind: "message" }, "id" | "kind">>
  ) => void;
  updateSlotNode: (
    nodeId: string,
    updates: Partial<Omit<LayoutNodeDraft & { kind: "slot" }, "id" | "kind">>
  ) => void;
  reorderNodes: (fromIndex: number, toIndex: number) => void;
  deleteNode: (nodeId: string, cleanupOrphanedSlots?: boolean) => void;

  // Slot Actions
  createSlotFromRecipe: (
    recipeId: AnyRecipeId | "custom",
    params?: Record<string, unknown>,
    index?: number
  ) => string; // Returns the slot name
  updateSlot: (slotName: string, updates: Partial<SlotDraft>) => void;

  // Attachment Actions
  setAttachmentDraft: (draft: AttachmentLaneDraft) => void;

  // Edit Mode Actions
  startEditingNode: (nodeId: string) => void;
  saveNodeEdit: (nodeId: string, nodeData: LayoutNodeDraft, slotData?: SlotDraft) => void;
  cancelNodeEdit: () => void;

  // Import Actions
  importSlotBlock: (
    block: SlotBlockDraft,
    options?: { insertionIndex?: number; overwrite?: boolean }
  ) => { slotName: string; mode: "added" | "overwritten" };
}

const makeInitialState = (): Pick<
  TemplateBuilderState,
  "layoutDraft" | "slotsDraft" | "attachmentDrafts" | "editingNodeId" | "isDirty"
> => ({
  layoutDraft: [],
  slotsDraft: {},
  attachmentDrafts: {},
  editingNodeId: null,
  isDirty: false,
});

const initialState = makeInitialState();

export const useTemplateBuilderStore = create<TemplateBuilderState>()(
  immer((set, _get) => ({
    ...initialState,

    initialize: (draft) =>
      set((state) => {
        state.layoutDraft = draft.layoutDraft;
        state.slotsDraft = draft.slotsDraft;
        state.attachmentDrafts = draft.attachmentDrafts;
        state.editingNodeId = null;
        state.isDirty = false;
      }),

    reset: () =>
      set((state) => {
        const fresh = makeInitialState();
        state.layoutDraft = fresh.layoutDraft;
        state.slotsDraft = fresh.slotsDraft;
        state.attachmentDrafts = fresh.attachmentDrafts;
        state.editingNodeId = fresh.editingNodeId;
        state.isDirty = fresh.isDirty;
      }),

    markClean: () =>
      set((state) => {
        state.isDirty = false;
      }),

    // Layout Actions
    addMessageNode: (role, index) =>
      set((state) => {
        const newNode: LayoutNodeDraft = {
          id: createId(),
          kind: "message",
          role,
          content: getDefaultMessageContent(role),
        };

        if (index !== undefined && index >= 0 && index < state.layoutDraft.length) {
          state.layoutDraft.splice(index, 0, newNode);
        } else {
          state.layoutDraft.push(newNode);
        }
        state.isDirty = true;
      }),

    updateMessageNode: (nodeId, updates) =>
      set((state) => {
        const node = state.layoutDraft.find((n) => n.id === nodeId);
        if (node && node.kind === "message") {
          Object.assign(node, updates);
          state.isDirty = true;
        }
      }),

    updateSlotNode: (nodeId, updates) =>
      set((state) => {
        const node = state.layoutDraft.find((n) => n.id === nodeId);
        if (node && node.kind === "slot") {
          const oldName = node.name;
          Object.assign(node, updates);

          // If the slot name changed, we need to update the slots object too
          if (updates.name && updates.name !== oldName) {
            const slot = state.slotsDraft[oldName];
            if (slot) {
              delete state.slotsDraft[oldName];
              state.slotsDraft[updates.name] = { ...slot, name: updates.name };
            }
          }
          state.isDirty = true;
        }
      }),

    reorderNodes: (fromIndex, toIndex) =>
      set((state) => {
        if (
          fromIndex < 0 ||
          fromIndex >= state.layoutDraft.length ||
          toIndex < 0 ||
          toIndex >= state.layoutDraft.length
        ) {
          return;
        }

        const [movedNode] = state.layoutDraft.splice(fromIndex, 1);
        state.layoutDraft.splice(toIndex, 0, movedNode);
        state.isDirty = true;
      }),

    deleteNode: (nodeId, cleanupOrphanedSlots = true) =>
      set((state) => {
        const nodeToDelete = state.layoutDraft.find((n) => n.id === nodeId);
        if (!nodeToDelete) return;

        // Remove the node from layout
        state.layoutDraft = state.layoutDraft.filter((n) => n.id !== nodeId);

        // If it was a slot reference and cleanup is enabled, check if we should remove the slot
        if (cleanupOrphanedSlots && nodeToDelete.kind === "slot") {
          const slotName = nodeToDelete.name;

          // Check if any remaining nodes reference this slot
          const hasRemainingReferences = state.layoutDraft.some(
            (node) => node.kind === "slot" && node.name === slotName
          );

          // If no remaining references, remove the slot
          if (!hasRemainingReferences && state.slotsDraft[slotName]) {
            delete state.slotsDraft[slotName];
          }
        }

        state.isDirty = true;
      }),

    // Slot Actions
    createSlotFromRecipe: (recipeId, params = {}, index) => {
      let slotName = "";
      set((state) => {
        const recipe = recipeId !== "custom" ? getRecipeById(recipeId) : undefined;
        console.log("createSlotFromRecipe: recipe", { recipeId, recipe });
        const baseName = recipe?.name || "custom_content";
        slotName = generateSlotName(state.slotsDraft, baseName);

        // Prepare the slot layout node
        const newNode: SlotLayoutDraft = {
          id: createId(),
          kind: "slot",
          name: slotName,
          omitIfEmpty: true,
        };

        const syncResult = recipe
          ? syncSlotLayoutWithRecipe({
              recipe,
              params,
              layoutDraft: newNode,
              mode: "overwrite",
            })
          : undefined;

        state.slotsDraft[slotName] = {
          recipeId: recipe?.id || "custom",
          name: slotName,
          priority: Object.keys(state.slotsDraft).length,
          params: syncResult?.coercedParams ?? params,
        };

        if (typeof index === "number" && index >= 0) {
          const boundedIndex = index > state.layoutDraft.length ? state.layoutDraft.length : index;
          state.layoutDraft.splice(boundedIndex, 0, newNode);
        } else {
          state.layoutDraft.push(newNode);
        }
        state.isDirty = true;
      });
      return slotName;
    },

    updateSlot: (slotName, updates) =>
      set((state) => {
        const slot = state.slotsDraft[slotName];
        if (slot) {
          // Don't allow changing the name through updateSlot
          const { name: _, ...safeUpdates } = updates;
          Object.assign(slot, safeUpdates);
          state.isDirty = true;
        }
      }),

    setAttachmentDraft: (draft) =>
      set((state) => {
        state.attachmentDrafts[draft.laneId] = structuredClone(draft);
        state.isDirty = true;
      }),

    // Edit Mode Actions
    startEditingNode: (nodeId) =>
      set((state) => {
        state.editingNodeId = nodeId;
      }),

    saveNodeEdit: (nodeId, nodeData, slotData) =>
      set((state) => {
        // Find the original node to detect renames
        const originalNode = state.layoutDraft.find((n) => n.id === nodeId);

        // Update the node
        const nodeIndex = state.layoutDraft.findIndex((n) => n.id === nodeId);
        if (nodeIndex !== -1) {
          state.layoutDraft[nodeIndex] = nodeData;
        }

        // If slot data is provided, handle slot updates and renames
        if (slotData) {
          // Check if this is a rename (slot node with different name)
          if (originalNode?.kind === "slot" && originalNode.name !== slotData.name) {
            // This is a rename - remove the old slot entry
            delete state.slotsDraft[originalNode.name];

            // Update all other layout nodes that reference the old name
            state.layoutDraft.forEach((node) => {
              if (node.kind === "slot" && node.name === originalNode.name && node.id !== nodeId) {
                node.name = slotData.name;
              }
            });
          }

          const recipe =
            slotData.recipeId !== "custom" ? getRecipeById(slotData.recipeId) : undefined;
          let resolvedParams = slotData.params;

          const updatedNode = state.layoutDraft[nodeIndex];
          if (recipe && updatedNode?.kind === "slot") {
            const result = syncSlotLayoutWithRecipe({
              recipe,
              params: slotData.params,
              layoutDraft: updatedNode,
              mode: "preserveMessages",
            });
            if (result) {
              resolvedParams = result.coercedParams;
            }
          }

          // Add/update the slot under the (possibly new) name
          state.slotsDraft[slotData.name] = {
            ...slotData,
            params: resolvedParams,
          };
        }

        state.editingNodeId = null;
        state.isDirty = true;
      }),

    cancelNodeEdit: () =>
      set((state) => {
        state.editingNodeId = null;
      }),

    importSlotBlock: (block, options) => {
      let result: { slotName: string; mode: "added" | "overwritten" } = {
        slotName: block.slot.name,
        mode: "added",
      };

      set((state) => {
        const insertionIndex = options?.insertionIndex;
        const overwrite = options?.overwrite ?? false;
        const targetName = block.slot.name;

        const slotExists = Boolean(state.slotsDraft[targetName]);

        if (slotExists && !overwrite) {
          throw new SlotImportError("A content block with this ID already exists.", "conflict");
        }

        const clonedSlot: SlotDraft = {
          recipeId: block.slot.recipeId,
          name: targetName,
          priority: block.slot.priority,
          params: structuredClone(block.slot.params),
        };

        if (typeof block.slot.budget === "number") {
          clonedSlot.budget = block.slot.budget;
        }

        if (block.slot.customSpec) {
          clonedSlot.customSpec = block.slot.customSpec;
        }

        const clonedLayout: SlotLayoutDraft = {
          id: createId(),
          kind: "slot",
          name: targetName,
          header: block.layout.header ? structuredClone(block.layout.header) : undefined,
          footer: block.layout.footer ? structuredClone(block.layout.footer) : undefined,
          omitIfEmpty: block.layout.omitIfEmpty,
        };

        if (slotExists && overwrite) {
          state.slotsDraft[targetName] = clonedSlot;

          state.layoutDraft.forEach((node) => {
            if (node.kind !== "slot") return;
            if (node.name !== targetName) return;

            node.header = clonedLayout.header ? structuredClone(clonedLayout.header) : undefined;
            node.footer = clonedLayout.footer ? structuredClone(clonedLayout.footer) : undefined;
            node.omitIfEmpty = clonedLayout.omitIfEmpty;
          });

          result = { slotName: targetName, mode: "overwritten" };
        } else {
          // Assign a default priority if the imported slot has an undefined priority
          if (typeof clonedSlot.priority !== "number") {
            clonedSlot.priority = Object.keys(state.slotsDraft).length;
          }

          state.slotsDraft[targetName] = clonedSlot;

          if (
            typeof insertionIndex === "number" &&
            insertionIndex >= 0 &&
            insertionIndex <= state.layoutDraft.length
          ) {
            state.layoutDraft.splice(insertionIndex, 0, clonedLayout);
          } else {
            state.layoutDraft.push(clonedLayout);
          }
        }

        state.isDirty = true;
      });

      return result;
    },
  }))
);

// Selectors (computed values)
export const getReferencedSlots = (state: TemplateBuilderState): Set<string> => {
  const referenced = new Set<string>();
  state.layoutDraft.forEach((node) => {
    if (node.kind === "slot") {
      referenced.add(node.name);
    }
  });
  return referenced;
};

export const getMissingSlots = (state: TemplateBuilderState): string[] => {
  const missing: string[] = [];
  state.layoutDraft.forEach((node) => {
    if (node.kind === "slot" && !state.slotsDraft[node.name]) {
      missing.push(node.name);
    }
  });
  return [...new Set(missing)]; // Remove duplicates
};

export const getUnreferencedSlots = (state: TemplateBuilderState): string[] => {
  const referenced = getReferencedSlots(state);
  return Object.keys(state.slotsDraft).filter((name) => !referenced.has(name));
};

export const getValidationErrors = (state: TemplateBuilderState, task: TaskKind): string[] => {
  return validateDraft({
    task: task,
    layoutDraft: state.layoutDraft,
    slotsDraft: state.slotsDraft,
    attachmentDrafts: state.attachmentDrafts,
  });
};
