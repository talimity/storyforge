// example of a multi-event concern

// events
// const inventoryAddSpec: TimelineEventSpec<"inventory_add", { itemId: string }> = {
//   kind: "inventory_add",
//   latest: 1,
//   schema: z.object({ itemId: z.string() }),
//   parse: ({ payload }) => ({ version: 1, payload: inventoryAddSpec.schema.parse(payload) }),
//   toPrompt: (ev) => `Inventory → gained ${ev.payload.itemId}`,
// };
//
// const inventoryRemoveSpec: TimelineEventSpec<"inventory_remove", { itemId: string }> = {
//   kind: "inventory_remove",
//   latest: 1,
//   schema: z.object({ itemId: z.string() }),
//   parse: ({ payload }) => ({ version: 1, payload: inventoryRemoveSpec.schema.parse(payload) }),
//   toPrompt: (ev) => `Inventory → lost ${ev.payload.itemId}`,
// };
//
// // concern
// type InventoryState = { items: Set<string> };
//
// const inventoryConcern: TimelineConcernSpec<"inventory", "inventory_add" | "inventory_remove", InventoryState> = {
//   name: "inventory",
//   kinds: ["inventory_add", "inventory_remove"],
//   initial: () => ({ items: new Set() }),
//   step: (state, ev) => {
//     const next = { items: new Set(state.items) };
//     if (ev.kind === "inventory_add") next.items.add(ev.payload.itemId);
//     if (ev.kind === "inventory_remove") next.items.delete(ev.payload.itemId);
//     return next;
//   },
//   // optional hints: e.g., expose size after each change
//   hints: {
//     inventory_add: (s) => ({ size: s.items.size }),
//     inventory_remove: (s) => ({ size: s.items.size }),
//   },
// };
