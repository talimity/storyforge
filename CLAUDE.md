# StoryForge - AI Tabletop Roleplay Engine

This file provides guidance to Claude Code when working with code in this repository.

## About

StoryForge is an LLM-powered character roleplaying application that reimagines AI character chat interfaces as a tabletop RPG experience. The player is positioned as a director/dungeon master orchestrating multi-character scenarios rather than being locked into a single character role chatting with one other character. An agentic narrative engine generates turns by passsing inputs across multiple stages (Planner -> Screenplay -> Prose, or Dreamer -> Critic -> Writer) to improve the quality of the output.

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
- ✅ Basic Vite React frontend application (with shadcn/ui and Tailwind CSS)
- ✅ SQLite persistence layer (with Drizzle ORM)
- ❌ LLM inference architecture
  - ❌ Provider abstraction layer
  - ❌ LLM provider implementation (MVP: OpenAI-compatible /chat/completions API)
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

Project is still in validation phase. The goal is to build a working prototype that demonstrates the core idea of agentic narrative generation without getting bogged down in minutiae.

Important: Most of the code currently in this repository is scaffolding. Types, interfaces, and models you may see for Scenario, Turn, etc. are placeholder interfaces generated for a UI mockup. None of these types will be used in the final codebase, and they should not be used as a reference. As features are implemented, remove the placeholder types from /packages/shared/src/types/placeholders.ts and create individual files for each feature.

## Build & Test Commands

```bash
# Install dependencies
pnpm i

# Code quality
pnpm check # lint + typecheck
pnpm format # apply Prettier

# Build
pnpm build

# Dev servers
# ⚠️ IMPORTANT: If you use `pnpm dev` it will block your terminal.
# If you need to start the servers in the background, you MUST use the `devctl` helper:
devctl start      # Starts frontend/backend in the background
devctl status     # "running" | "stopped"
curl http://localhost:3001/health # Interact with the frontend or backend for your task
devctl logs 100   # Show last 100 lines of logs (default 30)
devctl restart    # Restart both dev servers (this should not be necessary in most cases)
devctl stop       # Stop both dev servers
```

## Stack

- **Frontend**: Vite + React + TypeScript + shadcn/ui + Tailwind CSS
- **Backend**: Fastify + TypeScript + Drizzle ORM + SQLite
- **Monorepo**: pnpm workspaces

## Monorepo Structure

```
storyforge
├── apps
│   ├── backend                # Fastify backend application (:3001)
│   │   ├── data               # Runtime data
│   │   ├── scripts            # Scripts for development tasks
│   │   └── src
│   │       ├── api            # Fastify API handlers
│   │       │   ├── http       # HTTP API (CRUD, etc.)
│   │       │   └── ws         # WebSocket API (scenario interaction)
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
│   │       └── types
│   ├── frontend               # Vite React app (:8080)
│   │   └── src
│   │       ├── components     # UI components
│   │       │   └── ui         # Design system components
│   │       ├── pages          # Route pages
│   │       ├── hooks          # React hooks
│   │       └── types          # Frontend-specific types
├── packages                   # Shared packages
│   └── shared                 # Currently, just TypeScript types
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
