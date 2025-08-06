# Backend Integration Testing Implementation (Simplified)

## Overview

Implement basic integration testing for the StoryForge backend to provide safety rails during AI-assisted development. Focus on testing tRPC procedures for Character and Scenario CRUD operations with minimal setup.

## Objectives

- **AI Agent Safety**: Provide fast feedback to Claude Code agents to catch regressions
- **Simple Integration Tests**: Test tRPC procedures end-to-end with real database
- **Isolated Test Database**: Use separate SQLite database to avoid interfering with development
- **Minimal Setup**: No CI, coverage tools, or complex infrastructure

## Implementation Plan

### Task 1: Setup Test Infrastructure

#### 1.1: Install Vitest
Add to `/apps/backend/package.json`:
```json
{
  "devDependencies": {
    "vitest": "^1.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

#### 1.2: Configure Vitest
Create `/apps/backend/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

#### 1.3: Create Test Database Setup
Create `/apps/backend/src/test/setup.ts`:
- Create isolated test database (`test.db`), configure database client to use it when in test mode
- Run migrations on test database
- Create tRPC caller factory for testing
- Database reset utilities

#### 1.4: Create Test Fixtures
Create `/apps/backend/src/test/fixtures.ts`:
- Load existing fixture character cards from `/apps/backend/data/` folder
- Parse SillyTavern cards into test data
- Seed character data into test database

### Task 2: Character Integration Tests

Create `/apps/backend/src/trpc/routers/characters.integration.test.ts`:

Test all character tRPC procedures:
- ✅ `characters.list()` - Returns seeded characters
- ✅ `characters.getById(id)` - Returns character with relations
- ✅ `characters.getById(invalid)` - Throws NOT_FOUND
- ✅ `characters.create(data)` - Creates new character
- ✅ `characters.update(id, data)` - Updates character
- ✅ `characters.update(invalid, data)` - Throws NOT_FOUND
- ✅ `characters.delete(id)` - Deletes character
- ✅ `characters.delete(invalid)` - Throws NOT_FOUND
- ✅ `characters.getImage(id)` - Returns image buffer

Test card import HTTP endpoint, since it is not exposed via tRPC:
- ✅ `POST /api/characters/import` - Imports character cards from PNG, using fixture cards

### Task 3: Scenario Integration Tests

Create `/apps/backend/src/trpc/routers/scenarios.integration.test.ts`:

Test all scenario tRPC procedures:
- ✅ `scenarios.list()` - Returns empty list initially
- ✅ `scenarios.list({status: 'active'})` - Filters by status
- ✅ `scenarios.create(data)` - Creates scenario with characters
- ✅ `scenarios.getById(id)` - Returns scenario with characters
- ✅ `scenarios.getById(invalid)` - Throws NOT_FOUND
- ✅ `scenarios.update(id, data)` - Updates scenario
- ✅ `scenarios.update(invalid, data)` - Throws NOT_FOUND
- ✅ `scenarios.delete(id)` - Deletes scenario
- ✅ `scenarios.delete(invalid)` - Throws NOT_FOUND
- ✅ `scenarios.assignCharacter(scenarioId, characterId, options)` - Assigns character
- ✅ `scenarios.assignCharacter(invalid, characterId, options)` - Throws NOT_FOUND
- ✅ `scenarios.unassignCharacter(scenarioId, characterId)` - Unassigns character
- ✅ `scenarios.reorderCharacters(scenarioId, orders)` - Reorders characters

## File Structure

```
apps/backend/src/
├── test/
│   ├── setup.ts           # Test database and tRPC setup
│   └── fixtures.ts        # Load character cards from data/
├── trpc/routers/
│   ├── characters.integration.test.ts
│   └── scenarios.integration.test.ts
└── vitest.config.ts
```

## Implementation Details

### Test Database Configuration
- Use `test.db` instead of `storyforge.db`
- Reset database before each test file
- Seed with character cards from `/apps/backend/data/`

### Test Pattern
```typescript
describe('characters router', () => {
  beforeEach(async () => {
    await resetTestDb();
    await seedCharacterFixtures();
  });

  it('should list all characters', async () => {
    const result = await caller.characters.list();
    expect(result.characters).toHaveLength(3); // Based on fixture count
  });

  it('should create new character', async () => {
    const newCharacter = await caller.characters.create({
      name: 'Test Character',
      description: 'A test character'
    });
    expect(newCharacter.name).toBe('Test Character');
  });
});
```

### Success Criteria
- [ ] Vitest runs successfully
- [ ] Test database isolated from development database
- [ ] Character fixtures loaded from existing data files
- [ ] All character tRPC procedures tested
- [ ] All scenario tRPC procedures tested
- [ ] `pnpm test` provides clear pass/fail feedback for AI agents
