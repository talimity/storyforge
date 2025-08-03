# StoryForge Backend - Package Notes

Note that most of this is not yet implemented. This is the planned structure.

## API Routes (Port 3001)

### HTTP API
- **Characters**: `/api/characters` - Full CRUD
- **Health**: `/health` - Simple health check

### WebSocket API
TBD

## Layout

- **engine**: Story execution engine; scenario orchestration, agent impl, context construction, persistence
- **shelf**: User data repositories; CRUD operations for characters, scenarios, lorebooks, API keys, etc.
- **inference**: LLM inference service; abstracts LLM provider details
- **db**: Database layer; Drizzle ORM with SQLite
- **api**: Fastify API handlers; HTTP for CRUD and WebSocket for scenario interaction

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

**Mock provider**: Pattern-based responses, configurable delays, streaming simulation, error testing

## Character Import System

- **TavernCard Support**: Import character cards in TavernCard v1 or v2 format (.png files)
- **Import Endpoint**: `POST /api/characters/import` - Accepts PNG files with embedded character data
- **Data Mapping**: Automatically maps TavernCard fields to internal schema:
  - `first_mes` + `alternate_greetings` → `character_greetings` table
  - `mes_example` → `character_examples` table
  - Original card data preserved in `original_card_data` JSON column
  - Card image stored as binary data in `card_image` BLOB column

## Utility Scripts

- **Test Import**: `pnpm test:import` - Upload test character card from `data/` folder
- **Database Query**: `pnpm db:query <command>` - Execute database operations
  - `characters` - Show all characters with greetings/examples
  - `select <table>` - Select all from table
  - `count <table>` - Count rows in table
  - `schema` - Show database schema
  - `raw "<sql>"` - Execute raw SQL
  - `help` - Show usage info
