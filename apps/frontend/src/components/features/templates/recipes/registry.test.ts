import { describe, expect, it } from "vitest";
import { getRecipeById, getRecipesForTask, isValidRecipeId } from "./registry";

describe("recipe registry", () => {
  it("should return recipes for turn_generation task", () => {
    const recipes = getRecipesForTask("turn_generation");

    expect(recipes).toHaveLength(2);
    expect(recipes.map((r) => r.id)).toContain("timeline_basic");
    expect(recipes.map((r) => r.id)).toContain("characters_basic");
  });

  it("should return empty array for unknown task", () => {
    const recipes = getRecipesForTask("unknown_task" as any);
    expect(recipes).toHaveLength(0);
  });

  it("should retrieve recipe by ID", () => {
    const recipe = getRecipeById("timeline_basic");
    expect(recipe).toBeDefined();
    expect(recipe?.name).toBe("Timeline");
    expect(recipe?.task).toBe("turn_generation");

    const unknownRecipe = getRecipeById("unknown_recipe" as any);
    expect(unknownRecipe).toBeUndefined();
  });

  it("should validate recipe IDs", () => {
    expect(isValidRecipeId("timeline_basic")).toBe(true);
    expect(isValidRecipeId("characters_basic")).toBe(true);
    expect(isValidRecipeId("unknown_recipe")).toBe(false);
    expect(isValidRecipeId("")).toBe(false);
  });
});
