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
pnpm build # tsc -b against entire project
pnpm build:frontend # Vite build

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
- ✅ Shared packages (config, db, api)
- ✅ Vite React frontend application
- ✅ LLM inference architecture
  - ✅ Provider abstraction layer
  - ✅ LLM provider implementation
    - ✅ OpenRouter Chat Completion
    - ✅ DeepSeek Chat Completion
    - ❌ OpenAI-compat Chat Completion (OpenAI, llama.cpp, vllm, etc.)
  - ❌ Model registry (add models and specify which provider to use)
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
  - ❌ LLM provider configuration
  - ❌ Model registry
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
- ✅ Frontend
  - ✅ Scaffolding
    - ✅ Vite + React
    - ✅ Chakra UI v3
  - ❌ Library
    - ❌ Characters
      - ✅ Character list (very basic)
      - ✅ Character card with actions
      - ✅ Character import workflow
      - ❌ Character editor
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

- **Frontend**: Vite + React + Chakra UI v3
- **Backend**: Fastify + tRPC + Drizzle ORM + SQLite
- **Shared Packages**: Configuration, Database layer, API contracts
- **Monorepo**: pnpm workspaces

## Monorepo Structure

```
storyforge
├── apps
│   ├── backend                # Fastify backend application (:3001)
│   │   ├── data               # Fixtures, test characters
│   │   ├── scripts            # Scripts for development tasks
│   │   └── src
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
│   │       ├── test           # Integration tests
│   │       └── trpc           # API handlers
│   │           └── routers    # tRPC routers
│   ├── frontend               # Vite React app (:8080)
│   │   └── src
│   │       ├── components     # Reusable components, by feature
│   │       ├── lib            # Client utilities
│   │       └── pages          # Page components
└── packages                   # Shared packages
    ├── api                    # API contracts and types
    │   └── src
    │       ├── contracts      # tRPC contracts / Zod schemas  
    │       └── types
    ├── config                 # Configuration management
    │   └── src
    │       └── index.ts       # Config/environment loader
    └── db                     # Database layer
        └── src
            ├── migrations     # Database migrations
            ├── repositories   # Data access layer
            ├── schema         # Database schema definitions
            └── client.ts      # Database client
```

## Code Style Guidelines

- **TypeScript Code**:
  - Strict mode enabled
  - Explicit `any` usage is forbidden
  - Casting via `as` is strongly discouraged
    - Instead: type guard or assertion guard (e.g. `assertIsCharacter(obj: unknown): asserts obj is Character`)
    - Instead: use Zod's `parse` for complex, structured data validation
  - Minimize nested structures
    - Use intermediate variables to make expressions clearer
    - Return early to avoid deep nesting in functions
- **Classes and Interfaces**:
    - Prefer functions and objects over classes
    - Polymorphism: use interfaces for type contracts, not classes
    - Use classes only when you need to share state/behavior
    - Rethink architectures that rely on inheritance
    - Never write a class that only contains static members
- **Imports**:
  - Run `pnpm lint` to auto-sort imports
  - Use `@/` for absolute imports in frontend
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
- **playwright** - Control a browser to validate frontend functionality

IMPORTANT: Always delegate research tasks or playwright validation to an agent using dispatch_agent. Avoid invoking the tools directly. Similarly, if you need to analyze many files in the codebase to understand some architecture or broad structure, ask an agent to do this for you and return a summary.
