# StoryForge - AI Tabletop Roleplay Engine

This file provides guidance to Claude Code when working with code in this repository.

## About

StoryForge is an LLM-powered character roleplaying application that reimagines AI character chat interfaces as a tabletop RPG experience. The player is positioned as a director/dungeon master orchestrating multi-character scenarios rather than being locked into a single character role chatting with one other character. An agentic narrative engine generates turns by passing inputs across multiple stages (Planner -> Screenplay -> Prose, or Dreamer -> Critic -> Writer) to improve the quality of the output.

### Build & Test Commands

```bash
# Code quality
pnpm lint
pnpm typecheck
pnpm check # both

# Run tests (backend, integration-only)
pnpm test

# Remember to rebuild when changing contracts in packages/api
pnpm build

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

## Current Status

- ✅ Monorepo with pnpm
- ✅ Fastify, Drizzle with SQLite, and tRPC setup
- ✅ OpenAPI schema generation via trpc-to-openapi
- ❌ Vite React frontend application
- ✅ LLM inference architecture
  - ✅ Provider abstraction layer
  - ✅ LLM provider implementation
    - ✅ OpenRouter Chat Completion
    - ✅ DeepSeek Chat Completion
    - ❌ OpenAI-compat Chat Completion (OpenAI, llama.cpp, vllm, etc.)
  - ❌ Provider/model registry
- ❌ Story engine
  - ❌ Scenario runtime (read input, generate-with-agents, present, loop)
  - ❌ Context construction (build context from turn history, chara data, prompt templates, and agent config)
  - ❌ Turn generation (agent workflow executor)
    - ❌ Dummy workflow (no behavior, agent just sends input to LLM verbatim)
    - ❌ Dreamer -> Critic -> Writer workflow
    - ❌ Planner -> Screenplay -> Prose workflow
    - ❌ Convert hardcoded workflows to custom node graph
  - ❌ Scenario runtime manager (scenario lifecycle/input orchestration)
  - ❌ Persistence
    - ❌ Chapter repo (groups turns into chapters, which can be summarized and pruned from context)
    - ❌ Turn repo (stores turns with metadata, can be queried by scenario runtime)
  - ❌ LLM input/output transforms
    - ❌ Regex (trim unwanted content from LLM output)
    - ❌ Structured output (parse LLM YAML/JSON output to structured, typed data for another agent)
  - ❌ Events
    - ❌ Turn events (e.g. turn started, turn completed)
    - ❌ Agent events (e.g. workflow start, agent input, agent output, agent error, wokflow complete)
- ❌ Shelf (user content management)
  - ✅ Characters / SillyTavern character import
  - ✅ Scenario CRUD / character assignment
  - ❌ LLM provider creds and config
  - ❌ Prompt templates
  - ❌ Assets (chara images, scene backgrounds, CSS themes)
  - ❌ Regex templates (e.g., 'Convert straight quotes to curly quotes')
  - ❌ Agent workflows
  - ❌ Settings (simple KV store, mostly for UI state and prefs)
- ❌ tRPC API
  - ✅ Character shelf
  - ✅ Scenario shelf
  - ❌ Scenario interact
  - ❌ Prompt templates shelf
  - ❌ LLM providers
  - ❌ Asset upload and management
  - ❌ Regex templates
  - ❌ Agent workflows
  - ❌ Settings
- ❌ Frontend
  - ❌ Scaffolding
    - ❌ Vite + React
    - ❌ DaisyUI 5
    - ❌ Tailwind 4
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
  - ❌ Mobile affordances
- ❌ Packaging
  - ❌ just use docker

## Stack

- **Frontend**: Vite + React + DaisyUI 5 + Tailwind 4
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
│   │       └── ...            # Nothing, all placeholder currently
└── packages                   # Shared packages
    └── api                    # API contracts and types
        └── src
            ├── contracts      # tRPC contracts / Zod schemas
            └── types
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
- **Classes and Interfaces**:
    - Prefer plain functions and objects over classes
    - Start with interfaces when you need to define a contract
    - Use classes only when you need to maintain state or implement polymorphism or inheritance
      - Avoid inheritance in general
    - Never write a class that only contains static members
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

### Other Tips

Use the `context7` tool to look up documentation for any GitHub repository. You may wish to do this to ensure you have up-to-date documentation for new libraries like Tailwind v4 or for any libraries you are not familiar with.
