# StoryForge - AI Tabletop Roleplay Engine

This file provides guidance to AI agents when working with code in this repository.

## About

StoryForge uses language models to let users play with and direct semi-autonomous characters in a pseudo-tabletop RPG context. It's similar to popular applications like Character.AI and SillyTavern, but moves away from the *chat* paradigm, which gives models too much freedom to make mistakes. Instead, StoryForge tries to provide a more structured and controlled environment for the model to interact with the story.

The vision is something akin a turn-based/text-based version of The Sims, which places AI-driven characters in a scenario together and tries to draw forth entertaining emergent interactions between them. Players can influence the story directly or indirectly by providing narrative constraints, overriding character actions, or injecting chaos. Character agents have access to tool calls to roll dice, modify attributes and inventory, and track long-term goals.

### Key Concepts

- Turn-based timeline (1 turn = 1 character's action); turns are nodes in a rooted tree, and the path from the root to the "anchor" leaf is the "active timeline"
- Branching as a first-class concept; rewinding or switching timelines to explore alternative paths should be as low-friction as possible
- Player can interact directly or indirectly; interactions are modeled as "Intent" to influence the story in some way, with each Intent kind generating a different set of "Effects"
- An Intent can be a story constraint, a vague request for a character to do something, or direct control over a character's actions
- LLM interface happens via "generative tasks", such as Turn Generation or Chapter Summarization, for which the player can define custom workflows and prompt templates; a workflow can trigger multiple LLM calls, such as using a more strong logical model for a reasoning-focused "Draft" step chained to a simpler but more creative model for a "Prose" step. 

### Build & Test Commands

```bash
# Rebuild type declarations after changing shared packages
# ⚠️ IMPORTANT: DO NOT pass `-w`, it will run the build in watch mode and block your terminal.
pnpm build
# Lint, fix imports, and check for type errors
# ⚠️ IMPORTANT: DO NOT pass `-w`, it will run tsc in watch mode and block your terminal.
pnpm check
# Run tests
# ⚠️ IMPORTANT: DO NOT pass `-w`, it will run vitest in watch mode and block your terminal. 
pnpm test

# Remember to generate migrations when changing database schema in packages/db
pnpm db:generate # Drizzle migration generation
pnpm db:migrate --name=descriptive-name # Run migrations against the database

# Dev servers
# If you need to start the servers in the background, you MUST use the `devctl` helper:
devctl start      # Starts frontend/backend in the background
devctl status     # "running" | "stopped"
devctl logs 100   # Show last n lines of dev server logs (default 30)
devctl restart    # Restart both dev servers (this should not be necessary in most cases)
devctl stop       # Stop both dev servers
```

Again, DO NOT use `-w` flags for any of these commands. If you're trying to run a command in a specific workspace, use `pnpm --filter=frontend build`. `-w` is not valid for pnpm and will instead trigger blocking watch mode which is not what you want.

### Technical Choices

- **Single-user desktop application**: Stack runs locally; NOT a hosted service so no need for auth, scaling, process management, etc. 
- **Typescript throughout**: For rapid development and shared code reuse while enforcing sound types
- **Bring-your-own-model**: No built-in text inference; player configures cloud AI providers or their own local models
- **pnpm Monorepo**: Project is split into multiple packages to encourage code reuse and separation of concerns

## Stack

- **Backend**: Fastify, tRPC
- **Frontend**: React 19/Vite
- **Database**: Drizzle ORM
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
    ├── utils                  # Isomorphic utility functions
    └── yolo-onnx              # YOLOv8 ONNX wrapper for face detection
```

## Code Style Guidelines

- **TypeScript Code**:
  - Strict mode enabled
  - Explicit `any` usage is forbidden
  - Casting via `as` is strongly discouraged
    - Alternative: assertion guard functions (e.g. `assertIsCharacter(obj: unknown): asserts obj is Character`)
      - Use `assertDefined` from utils instead of `!` operator
    - Alternative: write a Zod schema and use `parse`/`safeParse`
  - Minimize nested structures
    - Use intermediate variables to make expressions clearer
    - Return early to avoid deep nesting in functions
- **Classes and Interfaces**:
    - Prefer modules and functions over classes
    - Polymorphism: use TS interfaces
    - Use classes only when you need to share state/behavior
    - Never write a class that only contains static members
- **Imports**:
  - Run `pnpm check` (no flags) to automatically sort and remove unused imports
  - Never deep import from other packages
- **Naming conventions**:
  - Files: kebab-case
  - Identifiers: camelCase for functions/variables, PascalCase for classes/components

### Comments Policy

When in doubt, skip the comment.

- **Self-documenting code first** - Use expressive identifiers for functions and variables to make the code self-explanatory
- **Comments must add value** - Do add comments for edge cases, workarounds, or solutions that don't follow the obvious path
- **Use JSDoc for public APIs** - Document functions, classes, and interfaces that are at the boundary of your module
  - Skip parameter/return type JSDoc if the name and type make it obvious

## Other Important Reminders

### BEFORE starting a task
- You MUST examine files from adjacent features to get a sense of the overall project structure
- You SHOULD check the `docs/` folder for anything that seems relevant to your feature, to better understand its architecture and design decisions
- You SHOULD check for `types.ts` files nearby or in shared packages you'll rely on, to better understand their APIs
- You MUST refer to package-specific AGENTS.md files for the app you're working in, if applicable:
  - [Backend](apps/backend/AGENTS.md)
  - [Frontend](apps/frontend/AGENTS.md)

### DURING work on a task
- You MUST `pnpm build` any time you are making changes across packages
- You MUST follow existing conventions and patterns as much as possible
- You SHOULD run checks and address diagnostics incrementally; it will be easier than fixing dozens of errors at the end
- You MUST run the build and check commands before a task can be considered finished

### At ALL TIMES
- You MUST NOT run any blocking commands. 
  - That includes watch mode! DO NOT add `-w` flags to any of the build or code quality commands.
