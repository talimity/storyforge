import { describe, expect, it } from "vitest";
import { makeScopedRegistry } from "./scoped-registry.js";
import type { SourceRegistry, SourceSpec } from "./types.js";

function makeTestRegistry<Ctx, S extends SourceSpec>(): SourceRegistry<Ctx, S> {
  return {
    resolve: () => undefined,
    list: () => [],
  };
}

type EmptyRegistry = { [k: string]: never };

describe("scoped registry - reserved sources", () => {
  it("resolves $item, $index and $parent with path", () => {
    const ctx = {};
    const base = makeTestRegistry<typeof ctx, EmptyRegistry>();
    const parent = { item: { name: "Parent" }, index: 3 };
    const child = { item: { name: "Child" }, index: 1 };
    // Create a wrapper with parent frame, then extend with child
    const reg1 = makeScopedRegistry(base, { frames: [parent] });
    const reg2 = makeScopedRegistry(reg1, { frames: [parent, child] });

    // TODO: this works but values of `resolve` are inferred as `undefined`
    // because `makeScopedRegistry` returns the type of the original registry
    // without the extra scoped resolvers.
    const itemName = reg2.resolve({ source: "$item", args: { path: "name" } }, ctx);
    const index = reg2.resolve({ source: "$index" }, ctx);
    const parentName = reg2.resolve({ source: "$parent", args: { level: 1, path: "name" } }, ctx);

    expect(itemName).toBe("Child");
    expect(index).toBe(1);
    expect(parentName).toBe("Parent");
  });

  it("resolves $globals and $ctx with path", () => {
    const ctx = { globals: { worldName: "Aethermoor" }, foo: { bar: 42 } };
    const base = makeTestRegistry<typeof ctx, EmptyRegistry>();
    const reg = makeScopedRegistry(base, { frames: [] });

    const world = reg.resolve({ source: "$globals", args: { path: "worldName" } }, ctx);
    const bar = reg.resolve({ source: "$ctx", args: { path: "foo.bar" } }, ctx);

    expect(world).toBe("Aethermoor");
    expect(bar).toBe(42);
  });
});
