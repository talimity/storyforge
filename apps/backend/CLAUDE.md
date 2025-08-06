# StoryForge Backend - Package Notes

Note that most of this is not yet implemented. This is the planned structure.

## Web API

Web API is served on port 3001. The API is built with Fastify and tRPC and includes trpc-to-openapi to expose most tRPC procedures as RESTful endpoints.

A few functions (anything involving file uploads or SSE) must use Fastify routes directly, but tRPC is used for most API interactions.

### tRPC/OpenAPI Routes
- **Characters**:
  - tRPC: `/trpc/characters.*`
  - OpenAPI: `/api/characters`
  - CRUD operations for characters, including import from SillyTavern character cards
- **Scenarios**:
  - tRPC: `/trpc/scenarios.*`
  - OpenAPI: `/api/scenarios`
  - CRUD operations for scenarios, and assignments of characters to scenarios
- **LLM Provider Debug**:
  - tRPC: `/trpc/debug.*`
  - OpenAPI: `/api/debug`
  - Intended for testing LLM providers, listing models, and rendering prompts in lieu of a full UI
- **Health**: `/health` - Simple health check

### WebSocket API
TBD, for realtime scenario interaction and agent updates.

## Layout

- **engine**: Story execution engine; scenario orchestration, agent impl, context construction, persistence
- **shelf**: User data repositories; CRUD operations for characters, scenarios, lorebooks, API keys, etc.
- **inference**: LLM inference service; abstracts LLM provider details
- **db**: Database layer; Drizzle ORM with SQLite
- **trpc**: All tRPC procedures and OpenAPI schema generation

## LLM Inference Architecture

**Flow**: `GenerationContext` → `GenerationContextAdapter` → `ChatCompletionRequest` → `LLMProvider` → API payload

- **GenerationContext**: Narrative-aware sections (system/reference/history/task) + parameters + model
- **ChatCompletionRequest**: Standard `{messages: ChatMessage[], parameters, model}` - provider-agnostic
- **GenerationContextAdapter**: Converts narrative contexts to standardized chat messages
- **LLMProvider interface**: `generate()`, `generateStream()`, `listModels()`, `renderPrompt()`

**Providers**: OpenRouter, DeepSeek, Mock

**Debug endpoints** (`/api/debug/`):
- `GET /models?provider=X&filter=Y` - List available models
- `POST /completion` - Test completions with custom sections/parameters/streaming
- `GET /render-prompt?provider=X&model=Y` - Show full transformation pipeline

## Utility Scripts

- **Test Import**: `pnpm test:import` - Upload test character card from `data/` folder
- **Database Query**: `pnpm db:query <command>` - Execute database operations
  - `characters` - Show all characters with greetings/examples
  - `select <table>` - Select all from table
  - `count <table>` - Count rows in table
  - `schema` - Show database schema
  - `raw "<sql>"` - Execute raw SQL
  - `help` - Show usage info

## Patterns

When adding a new domain object (e.g., character, scenario), follow these steps:
1. **Database Schema**: Create a new table in `db/schema/` and add a migration in `db/migrations/`.
2. **Repositories**: 
  - Create a new repository in `db/` extending `BaseRepository`.
  - Does the entity have child entities? Evaluate...
    - Entities that are **aggregate members** (cannot exist without parent, no external references) stay in the parent repository
    - Entities that are **associated aggregate roots** (have their own lifecycle, referenced by multiple aggregates, or have complex relationships) get their own repository
3. **Contracts**: Define tRPC contracts for reads and writes in the `api` package.
4. **Services**:
  - For simple content entities, create a service in `shelf/`.
  - For complex entities part of the story engine, create a service in `engine/`.
  - If database and API contract shapes are not identical, create a `*.transforms.ts` file for transformations.
    - Do not write a validation layer; almost everything can be validated by the Zod contracts.
    - Any business logic should be in the service layer. 
5. **tRPC Procedures**: Add new tRPC procedures in `trpc/` for CRUD operations.
  - Include OpenAPI metadata in the procedure definition.
  - Procedures MUST NOT contain business logic.
