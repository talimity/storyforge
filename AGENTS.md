# StoryForge - AI Tabletop Roleplay Engine

This file provides guidance to AI agents when working with code in this repository.

## About

StoryForge uses language models to let users direct semi-autonomous characters in a pseudo-tabletop RPG context. It's similar to popular applications like Character.AI and SillyTavern, but moves away from the *chat* paradigm, which gives models too much freedom to make mistakes. Instead, StoryForge tries to provide a more structured and controlled environment for the model to interact with the story.

The vision is something akin a turn-based/text-based version of The Sims, which places AI-driven characters in a scenario together and tries to draw forth entertaining emergent interactions between them. Players can influence the story directly or indirectly by providing narrative constraints, overriding character actions, or injecting chaos. Character agents have access to tool calls to roll dice, modify attributes and inventory, and track long-term goals.

### Key Concepts

- Turn-based timeline (1 turn = 1 character's action); turns are nodes in a rooted tree, and the path from the root to the "anchor" leaf is the "active timeline"
- Timelines can be branched at any point to explore alternate story paths
- Player can interact directly or indirectly; interactions are modeled as "Intent" to influence the story in some way, with each Intent kind generating a different set of "Effects"
- LLM interface happens via "generative tasks", such as Turn Generation or Chapter Summarization, for which the player can define custom workflows and prompt templates
- Woorkflows can trigger multiple LLM calls, such as using a stronger model for a reasoning-focused "Draft" step chained to a simpler but more creative model for a "Prose" step 

### Build & Test Commands

```bash
# ⚠️ IMPORTANT: DO NOT pass `-w` after any of these commands. To scope a command to a specific package, use `pnpm --filter=backend [script]` instead.

# Rebuild type declarations with after changing shared packages
pnpm build
# Run typechecker and Biome linter (uses TS native preview, so fast enough to run against entire monorepo)
pnpm lint
# Run tests 
pnpm test
```

### Sqlite Migrations
```bash
pnpm --filter=db db:generate --name=descriptive-name # Generate sqlite migration with drizzle-kit 
```

### Technical Choices

- **Single-user desktop application**: Stack runs locally; NOT a hosted service so no need for auth, scaling, process management, etc.
- **Bring-your-own-model**: No built-in text inference; player configures cloud AI providers or their own local models
- **pnpm Monorepo**: Project is split into multiple packages to encourage code reuse and separation of concerns, and possibly allow for different clients

## Stack

- **Language**: TypeScript
- **Backend**: Fastify/tRPC, ESM
- **Frontend**: React 19/Vite
- **Database**: SQLite/Drizzle ORM
- **Schemas**: Zod v4

## Monorepo Structure

```
storyforge
├── apps
│   ├── backend                # Fastify/tRPC backend application (:3001)
│   └── frontend               # React SPA with Vite (:8080)
├── docs                       # Specification and design documents
└── packages                   # Shared packages
    ├── config                 # Configuration management
    ├── contracts              # Shared types and Zod schemas for data contracts/interfaces 
    │── db                     # Drizzle ORM database layer
    │── gentasks               # Generative task and workflow runner implementations
    ├── inference              # Adapters for inference APIs
    ├── prompt-rendering       # Prompt template rendering engine
    ├── timeline-events        # Reducers and event schemas for timeline state
    ├── utils                  # Isomorphic utility functions
    └── yolo-onnx              # Wrapper for yolo-v8n face detection via ONNX runtime
```

## Code Style Guidelines

- **Type soundness**:
  - 🚫 Type casting (`... as SomeType`) is STRONGLY DISCOURAGED; consider:
    - `function assertSomeType(value: unknown): asserts value is SomeType`, or...
    - `function isSomeType(value: unknown): value is SomeType`, or...
    - A zod schema
    - (`as const` *narrows* inferred types, so it's allowed)
  - 🚫 Non-null assertions (`!`) are FORBIDDEN by linter
    - Use `assertDefined` from @storyforge/utils
  - 🚫 Explicit `any` is FORBIDDEN by linter
- **Classes and Interfaces**:
  - Prefer modules and functions over classes
    - Polymorphism: use TS interfaces
    - Use classes only when you need to share mutable state/resources
- **Comments**:
  - Add TSDocs for all public API functions/methods, and complex logic
  - Add inline comments for complex code, to note edge cases, or to mark sections of a multi-step procedure
  - Update outdated comments when modifying code
  - Never remove existing comments when refactoring
- **General**:
  - All filenames use kebab-case
  - Keep modules small; aggressively split up large modules
  - Minimize nested structures
    - Return early to avoid deep nesting in functions
  - Look for patterns in existing code and follow them
  - Avoid propagating `null` from sqlite all the way down to frontend
    - `stripNulls` from @storyforge/utils can help with this
    - There is a lot of `?? null` coalescing; try to remove it when you see it

## Other Important Reminders

### BEFORE starting a task
- You MUST examine files from adjacent features to get a sense of the overall project structure
- You MUST check the `docs/` folder for anything that seems relevant to your feature, to better understand its architecture and design decisions
- You MUST check for `types.ts` files nearby or in shared packages you'll rely on, to better understand their APIs
- If working in frontend, also refer to its [AGENTS.md](apps/frontend/AGENTS.md) for additional frontend-specific guidelines

### DURING work on a task
- You MUST `pnpm build` any time you are making changes across packages
  - Run it against the entire repo, incremental builds are fast
- You MUST follow existing conventions and patterns as much as possible
- You MUST run `build`/`lint`/`test` commands before a task can be considered finished

### At ALL TIMES
- You MUST NOT run any blocking commands. 
  - That includes watch mode! DO NOT add `-w` flags to any of the `pnpm` commands
  - (You don't need to specify `-w` to run a command against the entire workspace, pnpm does that by default)
- 🚨 You MUST NOT mutate the git state under any circumstances, including the staging area. 
