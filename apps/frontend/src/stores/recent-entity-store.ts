import { create } from "zustand";
import type { PersistStorage } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";

export type RecentEntityDomain = "templates" | "workflows" | "lorebooks";

export interface RecentEntityEntry {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly accessedAt: number;
}

interface RecentEntityState {
  readonly entries: Record<RecentEntityDomain, RecentEntityEntry[]>;
  readonly register: (domain: RecentEntityDomain, entry: RecentEntityEntry) => void;
  readonly clearDomain: (domain: RecentEntityDomain) => void;
}

const createDefaultEntries = (): Record<RecentEntityDomain, RecentEntityEntry[]> => ({
  templates: [],
  workflows: [],
  lorebooks: [],
});

const STORAGE_NAME = "storyforge-recent-entities";
const MAX_ENTRIES = 10;

type PersistedRecentEntityState = Pick<RecentEntityState, "entries">;

const storage: PersistStorage<PersistedRecentEntityState> | undefined =
  typeof window === "undefined"
    ? undefined
    : createJSONStorage<PersistedRecentEntityState>(() => window.localStorage);

export const useRecentEntityStore = create<RecentEntityState>()(
  persist(
    (set) => ({
      entries: createDefaultEntries(),
      register: (domain, entry) =>
        set((state) => {
          const current = state.entries[domain] ?? [];
          const filtered = current.filter((existing) => existing.id !== entry.id);
          const nextEntries = [entry, ...filtered]
            .sort((a, b) => b.accessedAt - a.accessedAt)
            .slice(0, MAX_ENTRIES);

          return {
            entries: {
              ...state.entries,
              [domain]: nextEntries,
            },
          };
        }),
      clearDomain: (domain) =>
        set((state) => ({
          entries: {
            ...state.entries,
            [domain]: [],
          },
        })),
    }),
    {
      name: STORAGE_NAME,
      storage,
      partialize: (state) => ({ entries: state.entries }),
    }
  )
);

interface RegisterRecentEntityOptions {
  readonly domain: RecentEntityDomain;
  readonly id: string;
  readonly name: string;
  readonly path: string;
}

export function useRegisterRecentEntity() {
  const register = useRecentEntityStore((state) => state.register);

  return ({ domain, id, name, path }: RegisterRecentEntityOptions) => {
    register(domain, {
      id,
      name,
      path,
      accessedAt: Date.now(),
    });
  };
}

const EMPTY_RECENT_ENTRIES: RecentEntityEntry[] = [];

export function useRecentEntities(domain?: RecentEntityDomain) {
  return useRecentEntityStore((state) => {
    if (!domain) return EMPTY_RECENT_ENTRIES;
    return state.entries[domain] ?? EMPTY_RECENT_ENTRIES;
  });
}
