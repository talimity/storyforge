import { describe, expect, it } from "vitest";
import {
  coerceBoolean,
  coerceNumber,
  coerceOrder,
  coerceString,
} from "@/features/template-builder/services/param-coercion";

describe("param coercion utilities", () => {
  describe("coerceOrder", () => {
    it("should return valid order values unchanged", () => {
      expect(coerceOrder("asc")).toBe("asc");
      expect(coerceOrder("desc")).toBe("desc");
    });

    it("should use custom default for invalid values", () => {
      expect(coerceOrder("invalid", "asc")).toBe("asc");
      expect(coerceOrder("invalid", "desc")).toBe("desc");
      expect(coerceOrder(123, "asc")).toBe("asc");
    });

    it("should use desc as default when no custom default provided", () => {
      expect(coerceOrder("invalid")).toBe("desc");
      expect(coerceOrder(null)).toBe("desc");
      expect(coerceOrder(undefined)).toBe("desc");
    });
  });

  describe("coerceNumber", () => {
    it("should return valid numbers unchanged", () => {
      expect(coerceNumber(5, 10)).toBe(5);
      expect(coerceNumber(0, 10)).toBe(0);
      expect(coerceNumber(-5, 10)).toBe(-5);
    });

    it("should coerce numeric strings to numbers", () => {
      expect(coerceNumber("5", 10)).toBe(5);
      expect(coerceNumber("0", 10)).toBe(0);
      expect(coerceNumber("-5", 10)).toBe(-5);
    });

    it("should return default for non-numbers", () => {
      expect(coerceNumber("a", 10)).toBe(10);
      expect(coerceNumber(null, 10)).toBe(10);
      expect(coerceNumber(undefined, 10)).toBe(10);
      expect(coerceNumber({}, 10)).toBe(10);
    });

    it("should clamp to min/max bounds", () => {
      expect(coerceNumber(5, 10, 8, 12)).toBe(8); // Below min
      expect(coerceNumber(15, 10, 8, 12)).toBe(12); // Above max
      expect(coerceNumber(10, 10, 8, 12)).toBe(10); // Within bounds
    });

    it("should handle only min or only max", () => {
      expect(coerceNumber(5, 10, 8)).toBe(8); // Only min
      expect(coerceNumber(15, 10, undefined, 12)).toBe(12); // Only max
    });
  });

  describe("coerceString", () => {
    it("should return valid strings unchanged", () => {
      expect(coerceString("hello", "default")).toBe("hello");
      expect(coerceString("", "default")).toBe("");
    });

    it("should return default for non-strings", () => {
      expect(coerceString(123, "default")).toBe("default");
      expect(coerceString(null, "default")).toBe("default");
      expect(coerceString(undefined, "default")).toBe("default");
      expect(coerceString({}, "default")).toBe("default");
    });
  });

  describe("coerceBoolean", () => {
    it("should return valid booleans unchanged", () => {
      expect(coerceBoolean(true, false)).toBe(true);
      expect(coerceBoolean(false, true)).toBe(false);
    });

    it("should return default for non-booleans", () => {
      expect(coerceBoolean("true", false)).toBe(false);
      expect(coerceBoolean(1, false)).toBe(false);
      expect(coerceBoolean(null, true)).toBe(true);
      expect(coerceBoolean(undefined, true)).toBe(true);
    });
  });
});
