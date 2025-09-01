import type { SqliteDatabase } from "@storyforge/db";
import { modelProfiles, providerConfigs } from "@storyforge/db";
import { eq } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";

export async function listProviders(db: SqliteDatabase) {
  return db.select().from(providerConfigs).orderBy(providerConfigs.name);
}

export async function getProviderById(db: SqliteDatabase, id: string) {
  const [results] = await db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.id, id))
    .limit(1);

  if (!results) {
    throw new ServiceError("NotFound", {
      message: `Provider with ID ${id} not found.`,
    });
  }

  return results;
}

export async function listModelProfiles(db: SqliteDatabase) {
  return db.select().from(modelProfiles).orderBy(modelProfiles.displayName);
}

export async function getModelProfileById(db: SqliteDatabase, id: string) {
  const [results] = await db
    .select()
    .from(modelProfiles)
    .where(eq(modelProfiles.id, id))
    .limit(1);

  if (!results) {
    throw new ServiceError("NotFound", {
      message: `Model profile with ID ${id} not found.`,
    });
  }

  return results;
}
