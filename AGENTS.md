# StoryForge - AI Tabletop Roleplay Engine

This file provides guidance to AI agents when working with code in this repository.

## About

StoryForge uses language models to let users direct semi-autonomous characters in a pseudo-tabletop RPG context. It's similar to popular applications like Character.AI and SillyTavern, but moves away from the *chat* paradigm, which gives models too much freedom to make mistakes. Instead, StoryForge tries to provide a more structured and controlled environment for the model to interact with the story.

The vision is something akin a turn-based/text-based version of The Sims, which places AI-driven characters in a scenario together and tries to draw forth entertaining emergent interactions between them. Players can influence the story directly or indirectly by providing narrative constraints, overriding character actions, or injecting chaos. Character agents have access to tool calls to roll dice, modify attributes and inventory, and track long-term goals.

### Key Concepts

- Turn-based timeline (1 turn = 1 character's action); turns are nodes in a rooted tree, and the path from the root to the "anchor" leaf is the "active timeline"
- Branching as a first-class concept; rewinding or switching timelines to explore alternative paths should be as low-friction as possible
- Player can interact directly or indirectly; interactions are modeled as "Intent" to influence the story in some way, with each Intent kind generating a different set of "Effects"
- An Intent can be a story constraint, a vague request for a character to do something, or direct control over a character's actions
- LLM interface happens via "generative tasks", such as Turn Generation or Chapter Summarization, for which the player can define custom workflows and prompt templates; a workflow can trigger multiple LLM calls, such as using a more strong logical model for a reasoning-focused "Draft" step chained to a simpler but more creative model for a "Prose" step. 

### Build & Test Commands

```bash
# ⚠️ IMPORTANT: DO NOT pass `-w` after any of these commands. They should be run as-is from the workspace root.
# To scope a command to a specific package, use `pnpm --filter=package [script]` instead.

# Rebuild type declarations with after changing shared packages (slow; uses `tsc`)
pnpm build
# Run typechecker and linter (fast; uses beta Typescript-Go native compiler)
pnpm lint
# Run tests 
pnpm test
```

### Sqlite Migrations
```bash
# Remember to generate migrations when changing database schema in packages/db
pnpm --filter=db db:generate --name=descriptive-name # Drizzle migration generation
pnpm --filter=db db:migrate # Run migrations against the database
```

### Technical Choices

- **Single-user desktop application**: Stack runs locally; NOT a hosted service so no need for auth, scaling, process management, etc. 
- **Typescript throughout**: For rapid development and shared code reuse while enforcing sound types
- **Bring-your-own-model**: No built-in text inference; player configures cloud AI providers or their own local models
- **pnpm Monorepo**: Project is split into multiple packages to encourage code reuse and separation of concerns

## Stack

- **Backend**: Fastify/tRPC
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
  - 🚫 Explicit `any` usage is FORBIDDEN
  - 🚫 Type casting (`... as SomeType`) is FORBIDDEN
    - Use a type guard: `function isSomeType(value: unknown): value is SomeType`, or...
    - Use an `asserts` guard: `function assertSomeType(value: unknown): asserts value is SomeType`, or...
    - Use Zod.
    - (Note that `as const` is not casting, it *narrows* inferred types so it is fine to use)
  - 🚫 Non-null assertions (`!`) are FORBIDDEN
    - Use Zod, `assertDefined` from the utils package, or an `asserts` guard.
- **Classes and Interfaces**:
  - Prefer modules and functions over classes
    - Polymorphism: use TS interfaces
    - Use classes only when you need to share state/behavior
- **Naming conventions**:
  - Files: kebab-case
  - Identifiers: camelCase for functions/variables, PascalCase for classes/components
- **Comments**:
  - Only leave inline comments to note edge cases or to explain why a non-obvious implementation strategy was chosen 
  - Do leave JSDoc comments for a module's public API
- **General**:
  - Minimize nested structures
    - Return early to avoid deep nesting in functions
  - Look for patterns in existing code and follow them 

## Other Important Reminders

### BEFORE starting a task
- You MUST examine files from adjacent features to get a sense of the overall project structure
- You MUST check the `docs/` folder for anything that seems relevant to your feature, to better understand its architecture and design decisions
- You MUST check for `types.ts` files nearby or in shared packages you'll rely on, to better understand their APIs

### DURING work on a task
- You MUST `pnpm build` any time you are making changes across packages
- You MUST follow existing conventions and patterns as much as possible
- You MUST run `pnpm lint` and address diagnostics incrementally; it will be easier than fixing dozens of errors at the end
- You MUST NOT use `any` casts (the linter will outright fail them)
- You MUST run build/check commands before a task can be considered finished

### At ALL TIMES
- You MUST NOT run any blocking commands. 
  - That includes watch mode! DO NOT add `-w` flags to any of the build or code quality commands.
  - If you think you want `-w` to filter the pnpm workspace, you actually want `pnpm --filter=package [script]` instead
- You MUST NEVER stage, unstage, reset, commit, push, stash, or make any changes whatsoever to the git worktree under any circumstances. 
