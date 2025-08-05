# StoryForge - AI Tabletop Roleplay Engine

This file provides guidance to Claude Code when working with code in this repository.

## About

StoryForge is an LLM-powered character roleplaying application that reimagines AI character chat interfaces as a tabletop RPG experience. The player is positioned as a director/dungeon master orchestrating multi-character scenarios rather than being locked into a single character role chatting with one other character. An agentic narrative engine generates turns by passsing inputs across multiple stages (Planner -> Screenplay -> Prose, or Dreamer -> Critic -> Writer) to improve the quality of the output.

### Build & Test Commands

```bash
# Code quality
pnpm check # lint + typecheck
pnpm lint # just lint
pnpm typecheck # just typecheck

# Remember to rebuild when changing contracts in packages/api
pnpm build

# Dev servers
# ⚠️ IMPORTANT: If you use `pnpm dev` it will block your terminal.
# If you need to start the servers in the background, you MUST use the `devctl` helper:
devctl start      # Starts frontend/backend in the background
devctl status     # "running" | "stopped"
# Query the backend API (always use `timeout` to avoid hanging)
timeout 10 curl http://localhost:3001/trpc/router.procedure?input={...} # tRPC
timeout 10 curl http://localhost:3001/api/resource/action?param=value # REST adapter
devctl logs 100   # Show last n lines of dev server logs (default 30)
devctl restart    # Restart both dev servers (this should not be necessary in most cases)
devctl stop       # Stop both dev servers
```

### Vision

- **Agentic narrative engine**: Turns are managed by a narrative engine that handles character actions, scene management, and AI interactions
- **Flexible role management**: Player can act as any character, all characters, or only the narrator
- **Event-driven narratives**: Player-prompted events force the narrative engine to generate new turns

### Technical Choices

- **Single-user desktop application** - Not a hosted web service or commercial product
- **Bring your own AI models** - Players run their own LLMs locally or use cloud APIs
- **TypeScript/Node.js focused** - Priority on type safety for maintainability
- **Monorepo with pnpm** - All code in a single repository for easier management

## Current Status

- ✅ Monorepo structure with pnpm
- ✅ Basic Fastify backend application
- ✅ tRPC for API contracts and routers
- ✅ OpenAPI schema generation via trpc-to-openapi
- ✅ Basic Vite React frontend application (with shadcn/ui and Tailwind CSS)
- ✅ SQLite persistence layer (with Drizzle ORM)
- ✅ LLM inference architecture
  - ✅ Provider abstraction layer
  - ✅ LLM provider implementation (MVP: OpenAI-compatible /chat/completions API)
  - ❌ Provider/model registry
- ❌ Scenario runtime
  - ❌ Prompt template rendering
  - ❌ Narrative engine (agent-turn state machine)
  - ❌ Scenario state persistence
- ❌ API
  - ✅ Character CRUD / SillyTavern character import
  - ❌ Scenario CRUD
  - ❌ Prompt templates CRUD
  - ❌ Agent workflow management
  - ❌ Model / LLM provider management
  - ❌ Scenario runtime API (likely WebSocket)
- ❌ UI
  - ❌ Library
    - ❌ Characters
    - ❌ Scenarios
    - ❌ Prompt templates
  - ❌ Scenario player
    - ❌ Editor (setup, character assignment)
    - ❌ Runner (turn display, input, state feedback)
  - ❌ Settings
    - ❌ API key configuration
    - ❌ Model configuration
    - ❌ Agent workflow configuration
- ❌ Electron wrapper (for desktop app)
- ❌ Mobile

## Stack

- **Frontend**: Vite + React + shadcn/ui + Tailwind CSS
- **Backend**: Fastify + tRPC + Drizzle ORM + SQLite
- **Monorepo**: pnpm workspaces

## Monorepo Structure

```
storyforge
├── apps
│   ├── backend                # Fastify backend application (:3001)
│   │   ├── data               # Runtime data
│   │   ├── scripts            # Scripts for development tasks
│   │   └── src
│   │       ├── db             # Drizzle ORM database layer
│   │       │   ├── base.repository.ts # Base CRUD repo
│   │       │   ├── migrations
│   │       │   └── schema
│   │       ├── engine         # Story engine
│   │       │   ├── agents     # Agent workflows
│   │       │   ├── context    # Context building
│   │       │   ├── scenario   # Scenario runtime / orchestration
│   │       │   └── turns      # Turn generation
│   │       ├── inference      # LLM inference layer
│   │       │   └── providers  # LLM provider implementations
│   │       ├── shelf          # User data management (simple CRUD)
│   │       │   ├── character
│   │       │   └── scenario
│   │       └── trpc           # API handlers
│   │           └── routers    # tRPC routers
│   ├── frontend               # Vite React app (:8080)
│   │   └── src
│   │       ├── components     # UI components
│   │       │   └── ui         # Design system components
│   │       ├── pages          # Route pages
│   │       ├── hooks          # React hooks
│   │       └── types          # Frontend-specific types
├── packages                   # Shared packages
│   ├── api                    # API contracts and types
│   │   └── src
│   │       ├── contracts      # tRPC contracts / Zod schemas
│   │       └── types
│   └── shared                 # Leftover shared types - do not use these
```

## Code Style Guidelines

- **TypeScript Code**:
  - Strict mode enabled
  - Explicit `any` usage is not permitted
  - Casting via `as` is to be avoided unless absolutely necessary
    - Write a type guard function or a type assertion function instead (e.g. `isCharacter(obj: unknown): obj is Character`)
    - You can use Zod's `parse` method to do this for you on unknown inputs
  - Try to minimize nested structures
    - Use intermediate variables to clarify complex expressions (this also reduces the need for comments)
    - Return early to avoid deep nesting in functions
  - Don't write classes with only static methods, just use a module
- **Imports**:
  - Place native Node.js modules first, then third-party libraries, then local imports
  - Use absolute imports with `@/` path mapping for clarity
- **Naming conventions**:
  - Files: kebab-case
  - Identifiers: camelCase for functions/variables, PascalCase for classes/components

### Comments Policy

When in doubt, just don't write the comment.

- **Self-documenting code first** - Use expressive identifiers for functions and variables to make the code self-explanatory
- **Comments must add value** - Document edge cases, workarounds, or solutions that do not follow the obvious path
- **Use JSDoc for public APIs** - Document functions, classes, and interfaces that are at the boundary of your module
  - You don't need to add JSDoc annotations for parameters or return types if they are trivial

### Other tips

Use the `context7` tool to look up documentation for any GitHub repository. You may wish to do this to ensure you have up-to-date documentation for new libraries like Tailwind v4 or for any libaries you are not familiar with.
