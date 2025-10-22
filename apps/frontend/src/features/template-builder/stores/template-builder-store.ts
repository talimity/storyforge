import type { TaskKind } from "@storyforge/gentasks";
import type { AttachmentLaneSpec, ChatCompletionMessageRole } from "@storyforge/prompt-rendering";
import { createId } from "@storyforge/utils";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { cloneLoreAttachmentValues } from "@/features/template-builder/services/attachments/lore";
import type { LoreAttachmentLaneDraft } from "@/features/template-builder/services/attachments/types";
import {
  generateSlotName,
  getDefaultMessageContent,
} from "@/features/template-builder/services/builder-utils";
import { validateDraft } from "@/features/template-builder/services/compile-draft";
import { getRecipeById } from "@/features/template-builder/services/recipe-registry";
import type {
  AnyRecipeId,
  AttachmentLaneDraft,
  LayoutNodeDraft,
  SlotDraft,
  TemplateDraft,
} from "@/features/template-builder/types";

function cloneAttachmentDrafts(
  source: Record<string, AttachmentLaneDraft>
): Record<string, AttachmentLaneDraft> {
  const clone: Record<string, AttachmentLaneDraft> = {};
  for (const [laneId, draft] of Object.entries(source)) {
    clone[laneId] = cloneAttachmentDraft(draft);
  }
  return clone;
}

function cloneAttachmentDraft(draft: AttachmentLaneDraft): AttachmentLaneDraft {
  if (draft.type === "lore") {
    return cloneLoreAttachmentDraft(draft);
  }
  return draft;
}

function cloneLoreAttachmentDraft(draft: LoreAttachmentLaneDraft): LoreAttachmentLaneDraft {
  return {
    laneId: draft.laneId,
    type: draft.type,
    values: cloneLoreAttachmentValues(draft.values),
    spec: cloneAttachmentSpec(draft.spec),
  };
}

function cloneAttachmentSpec(spec: AttachmentLaneSpec): AttachmentLaneSpec {
  return {
    ...spec,
    budget: spec.budget ? { ...spec.budget } : undefined,
    payload: spec.payload ? { ...spec.payload } : undefined,
    groups: spec.groups?.map((group) => ({
      ...group,
      payload: group.payload ? { ...group.payload } : undefined,
    })),
  };
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
        state.attachmentDrafts = cloneAttachmentDrafts(draft.attachmentDrafts);
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
        const baseName = recipe?.name || "custom_content";
        slotName = generateSlotName(state.slotsDraft, baseName);

        // Create the slot
        state.slotsDraft[slotName] = {
          recipeId: recipe?.id || "custom",
          name: slotName,
          priority: Object.keys(state.slotsDraft).length,
          params,
        };

        // Add a reference to the layout
        const newNode: LayoutNodeDraft = {
          id: createId(),
          kind: "slot",
          name: slotName,
          omitIfEmpty: true,
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
        state.attachmentDrafts[draft.laneId] = cloneAttachmentDraft(draft);
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

          // Add/update the slot under the (possibly new) name
          state.slotsDraft[slotData.name] = slotData;
        }

        state.editingNodeId = null;
        state.isDirty = true;
      }),

    cancelNodeEdit: () =>
      set((state) => {
        state.editingNodeId = null;
      }),
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
