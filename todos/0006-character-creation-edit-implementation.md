# Character Creation/Edit Page Implementation Plan

## Overview

This plan outlines the implementation of a basic character creation and edit page for StoryForge. The implementation focuses on essential fields (name, portrait image, description, and the new 'card type' field) while following established patterns and DLS principles.

## Requirements Summary

- **Limited scope**: Name, portrait image, description, and card type only
- **Card type**: New enum field with values: character (default), group, persona, scenario  
- **Purpose**: Placeholder for testing functions, primary character addition remains through import
- **UI/UX**: Follow existing DLS two-material system and form patterns

## Implementation Tasks

### Phase 1: Schema and Database Changes

#### Task 1.1: Define Card Type Enum Schema
**File**: `packages/api/src/contracts/character.ts`

Add card type enum validation:
```typescript
export const cardTypeSchema = z.enum(["character", "group", "persona", "scenario"]);
export type CardType = z.infer<typeof cardTypeSchema>;
```

Update existing character schemas to include cardType:
- Add to `characterSchema`
- Add to `createCharacterSchema` (optional, defaults to "character")
- Add to `updateCharacterSchema` (optional)
- Add to response schemas

**Dependencies**: None
**Estimated effort**: 30 minutes

#### Task 1.2: Update Database Schema
**File**: `packages/db/src/schema/characters.ts`

Add cardType field to characters table:
```typescript
cardType: text("card_type")
  .$type<"character" | "group" | "persona" | "scenario">()
  .notNull()
  .default("character"),
```

**Dependencies**: Task 1.1
**Estimated effort**: 15 minutes

#### Task 1.3: Generate and Apply Database Migration
**Commands**: 
- `pnpm db:generate` - Generate migration file
- Review generated SQL migration
- `pnpm db:migrate` - Apply migration

**Expected Migration**:
```sql
ALTER TABLE `characters` ADD `card_type` text DEFAULT 'character' NOT NULL;
```

**Dependencies**: Task 1.2
**Estimated effort**: 15 minutes

### Phase 2: API Contract Updates

#### Task 2.1: Update API Contracts
**Files**: 
- `packages/api/src/contracts/character.ts`

Ensure all character schemas include cardType field:
- `characterSchema` - include in response
- `createCharacterSchema` - optional field with default
- `updateCharacterSchema` - optional field for updates

**Dependencies**: Task 1.1
**Estimated effort**: 20 minutes

#### Task 2.2: Update tRPC Procedures
**File**: `apps/backend/src/trpc/routers/characters.ts`

Update procedures to handle cardType:
- `create` procedure - ensure cardType is processed
- `update` procedure - ensure cardType can be updated
- Existing procedures should work without changes due to default value

**Dependencies**: Task 2.1
**Estimated effort**: 30 minutes

### Phase 3: Frontend Components

#### Task 3.1: Create Character Form Component
**File**: `apps/frontend/src/components/features/character/character-form.tsx`

Create reusable form component with:
- Name field (required, text input)
- Description field (required, textarea)
- Portrait image field (optional, file upload with preview)
- Card type field (required, select dropdown with default "character")

**Form Structure** (following DLS principles):
```jsx
<Card.Root layerStyle="surface" w="full" maxW="800px">
  <Card.Body>
    <Stack gap={6}>
      {/* Basic Information Section */}
      <Stack gap={4}>
        <Heading size="md">Basic Information</Heading>
        <Field label="Name" required>
          <Input placeholder="Character name" />
        </Field>
        <Field label="Card Type" helperText="Specify the nature of this character card">
          <SelectRoot>
            <SelectTrigger>
              <SelectValueText placeholder="Select card type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="character">Character</SelectItem>
              <SelectItem value="group">Group</SelectItem>
              <SelectItem value="persona">Persona</SelectItem>
              <SelectItem value="scenario">Scenario</SelectItem>
            </SelectContent>
          </SelectRoot>
        </Field>
        <Field label="Description" required>
          <Textarea placeholder="Character description" rows={4} />
        </Field>
      </Stack>

      {/* Portrait Section */}
      <Separator />
      <Stack gap={4}>
        <Heading size="md">Portrait Image</Heading>
        <Field label="Portrait" helperText="Upload a PNG or JPEG image (max 10MB)">
          {/* File upload component similar to character-import */}
        </Field>
      </Stack>
    </Stack>
  </Card.Body>
</Card.Root>
```

**Validation**:
- Client-side validation for required fields
- File type/size validation for images
- Convert images to data URIs for API submission

**Dependencies**: Task 2.2
**Estimated effort**: 3 hours

#### Task 3.2: Create Character Creation Page
**File**: `apps/frontend/src/pages/character-create.tsx`

Create page with:
- Page header with "Create Character" title
- Character form component
- Save/Cancel actions
- Success/error handling with toast notifications
- Navigation back to character library on success

**Actions Pattern**:
```jsx
<HStack justify="space-between" w="full">
  <Button variant="ghost" onClick={() => navigate("/characters")}>
    Cancel
  </Button>
  <Button 
    colorPalette="primary" 
    onClick={handleSave}
    loading={isCreating}
    disabled={!isValid}
  >
    Create Character
  </Button>
</HStack>
```

**Dependencies**: Task 3.1
**Estimated effort**: 2 hours

#### Task 3.3: Create Character Edit Page
**File**: `apps/frontend/src/pages/character-edit.tsx`

Create page with:
- Dynamic route parameter for character ID
- Pre-populated character form
- Update/Cancel/Delete actions
- Error handling for not found characters
- Loading states during data fetch

**Differences from create page**:
- Uses `getById` query to fetch existing character data
- Uses `update` mutation instead of `create`
- Includes delete functionality
- Pre-fills form fields with existing data

**Dependencies**: Task 3.1
**Estimated effort**: 2.5 hours

#### Task 3.4: Add Routing
**File**: `apps/frontend/src/router.tsx`

Add new routes:
```jsx
{
  path: "/characters/create",
  element: <CharacterCreatePage />
},
{
  path: "/characters/:id/edit", 
  element: <CharacterEditPage />
}
```

**Dependencies**: Tasks 3.2, 3.3
**Estimated effort**: 15 minutes

#### Task 3.5: Update Character Library Navigation
**File**: `apps/frontend/src/pages/character-library.tsx`

Updates:
- Add "Create New Character" action to SplitButton (replace alert with navigation)
- Add edit action to character cards (modify CharacterCard component)

**Character Card Updates**:
- Add edit button/action to character cards
- Navigate to edit page on edit action

**Dependencies**: Task 3.4  
**Estimated effort**: 45 minutes

### Phase 4: Testing and Quality Assurance

#### Task 4.1: Test Character Creation Flow
**Test scenarios**:
- Create character with all fields
- Create character with minimal required fields  
- Create character with image upload
- Validation error handling
- API error handling
- Navigate back to library after creation

**Dependencies**: Task 3.5
**Estimated effort**: 1 hour

#### Task 4.2: Test Character Edit Flow  
**Test scenarios**:
- Edit existing character data
- Update character image
- Update card type
- Delete character
- Handle not found characters
- Validation during updates

**Dependencies**: Task 4.1
**Estimated effort**: 1 hour

#### Task 4.3: Run Code Quality Checks
**Commands**:
- `pnpm lint` - Check code style
- `pnpm typecheck` - Verify TypeScript
- `pnpm test` - Run integration tests

**Dependencies**: Task 4.2
**Estimated effort**: 30 minutes

## Design Language System (DLS) Implementation Notes

### Two-Material System Application

1. **Form Container**: Use `layerStyle="surface"` for main form cards (paper-like appearance)
2. **Section Separators**: Use `<Separator />` between logical form sections
3. **Color Palette**: Use `content.*` tokens for text, `primary` palette for primary actions
4. **Interactive Elements**: Follow existing button and input patterns

### Form Layout Principles

1. **Consistent Spacing**: `<Stack gap={6}>` for major sections, `<Stack gap={4}>` for field groups
2. **Field Structure**: Always use `<Field>` wrapper with proper labels and helper text
3. **Responsive Design**: Forms max width 800px, responsive button layouts
4. **Loading States**: Use Button `loading` prop and disabled states appropriately

### File Upload Implementation

Follow the drag-and-drop pattern from character-import.tsx:
- Dashed border drop zone
- File preview with remove capability  
- Validation feedback
- Progress indicators

## Risk Assessment

### Low Risk
- Database schema changes (simple column addition)
- API contract updates (additive changes)
- Form component implementation (well-established patterns)

### Medium Risk  
- File upload integration (complex but following existing patterns)
- Navigation and routing updates (potential for breaking existing flows)

### Mitigation Strategies
- Thorough testing of existing functionality after changes
- Incremental implementation with testing at each phase
- Follow established patterns from existing codebase
- Use TypeScript for compile-time error detection

## Success Criteria

1. ✅ Character creation form allows creating characters with name, description, image, and card type
2. ✅ Character edit form allows updating existing characters  
3. ✅ Card type field properly validates and stores enum values
4. ✅ Image upload works with proper validation and preview
5. ✅ Navigation flows work seamlessly with character library
6. ✅ All code follows DLS principles and existing patterns
7. ✅ No regressions in existing character import functionality
8. ✅ Code passes lint, typecheck, and test suites

## Estimated Total Effort: ~12 hours

This plan provides a comprehensive roadmap for implementing basic character creation and editing functionality while maintaining consistency with the existing StoryForge codebase and design system.