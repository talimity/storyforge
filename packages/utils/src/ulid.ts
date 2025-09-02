import { monotonicFactory } from "ulid";

const ulid = monotonicFactory();

export const createId = ulid;
