export const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
