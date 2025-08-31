# StoryForge - AI Tabletop Roleplay Engine

This file provides guidance to Claude Code when working with code in this repository.

## About

StoryForge is an LLM-powered character roleplaying application that reimagines AI character chat interfaces as a tabletop RPG experience. The player is positioned as a director/dungeon master orchestrating multi-character scenarios rather than being locked into a single character role chatting with one other character. An agentic narrative engine generates turns by passing inputs across multiple stages (Planner -> Screenplay -> Prose, or Dreamer -> Critic -> Writer) to improve the quality of the output.

### Build & Test Commands

```bash
# Code quality
pnpm check # lint/format/fix imports with biome + typecheck
# Run tests (backend, integration-only)
pnpm test
# Remember to rebuild types after changing shared packages
pnpm build

# Remember to generate migrations when changing database schema in packages/db
pnpm db:generate # Drizzle migration generation
pnpm db:migrate --name=descriptive-name # Run migrations against the database

# Dev servers
# ⚠️ IMPORTANT: If you use `pnpm dev` it will block your terminal.
# If you need to start the servers in the background, you MUST use the `devctl` helper:
devctl start      # Starts frontend/backend in the background
devctl status     # "running" | "stopped"
devctl logs 100   # Show last n lines of dev server logs (default 30)
devctl restart    # Restart both dev servers (this should not be necessary in most cases)
devctl stop       # Stop both dev servers
```

### Vision

- **Agentic narrative engine**: Turns are managed by a narrative engine that handles character actions, scene management, and AI interactions
- **Flexible role management**: Player can act as any character, all characters, or only the narrator
- **Event-driven narratives**: Player-prompted events force the narrative engine to generate new turns

### Technical Choices

- **Single-user desktop application** - Not a hosted web service or commercial product, stack runs locally
- **Bring your own API key** - Players provide cloud inference API keys or local models
- **TypeScript/Node.js focused** - Nothing exotic, shared code for easier consistency
- **Monorepo with pnpm** - To facilitate shared code and possible multiple frontends

## Stack

- **Frontend**: Vite + React + Chakra UI v3
- **Backend**: Fastify + tRPC + Drizzle ORM + SQLite
- **Shared Packages**: Configuration, Database layer, API contracts
- **Monorepo**: pnpm workspaces

## Monorepo Structure

```
storyforge
├── apps
│   ├── backend                # Fastify/tRPC backend application (:3001)
│   └── frontend               # React SPA with Vite (:8080)
├── docs                       # Specification and design documents
└── packages                   # Shared packages
    ├── config                 # Configuration management
    │── db                     # Drizzle ORM database layer
    ├── inference              # Adapters for inference APIs
    ├── prompt-rendering       # Prompt template rendering engine
    ├── schemas                # Zod runtime schemas and types
    ├── utils                  # Isomorphic utility functions
    └── yolo-onnx              # YOLOv8 ONNX wrapper for face detection
```

## Code Style Guidelines

- **TypeScript Code**:
  - Strict mode enabled
  - Explicit `any` usage is forbidden
  - Casting via `as` is strongly discouraged
    - Instead: assertion guard functions (e.g. `assertIsCharacter(obj: unknown): asserts obj is Character`)
      - Use `assertDefined` from utils instead of `!` operator
    - Instead: write a Zod schema and use `parse`/`safeParse`
  - Minimize nested structures
    - Use intermediate variables to make expressions clearer
    - Return early to avoid deep nesting in functions
- **Classes and Interfaces**:
    - Prefer modules/functions over classes
    - Polymorphism: use TS interfaces
    - Use classes only when you need to share state/behavior
    - Never write a class that only contains static members
- **Imports**:
  - Run `pnpm check` to auto-sort imports
  - Use `@/` for absolute imports within apps
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

## Tools
Several MCP utilities are available to help you with conducting research, troubleshooting, or testing.

- **context7** - Retrieves docs from any GitHub repository
  - We're using new versions of many libraries so use this often instead of relying on outdated memory.
- **chakra-ui** - Docs and examples for specific Chakra UI components
- **react-icons-mcp** - Search for icons from the react-icons library
- **GlobTool/GrepTool**: Fast code analysis and pattern detection

IMPORTANT: Always delegate research tasks to an agent using dispatch_agent. Avoid invoking the tools directly. Similarly, if you need to analyze many files in the codebase to understand some architecture or broad structure, ask an agent to do this for you and return a summary.
