# Prompt Template UI Implementation Plan

## Overview

This document outlines the implementation plan for scaffolding the UI for the prompt template library and template builder screens, based on the prompt template engine specification and authoring UI design.

## Phase 1: Data Layer & API Foundation

### 1.1 Database Schema
- Create `packages/db/src/schema/prompt-templates.ts`:
  - Table: `promptTemplates` with fields: id, name, task, version, layout (JSON), slots (JSON), responseFormat (JSON), responseTransforms (JSON), createdAt, updatedAt
  - Include proper indexing on task and name for efficient queries

### 1.2 API Layer
- Create `apps/backend/src/api/routers/templates.ts`:
  - `list` - Get all templates with optional filtering by task
  - `getById` - Get single template
  - `create` - Create new template with validation
  - `update` - Update existing template
  - `delete` - Delete template
  - `duplicate` - Clone template with new name
  - `import` - Import template from JSON
  - `export` - Export template to JSON

### 1.3 Contracts & Validation
- Add template schemas to `packages/schemas/src/contracts/templates.ts`
- Include validation for PromptTemplate structure matching the DSL spec

## Phase 2: Template Library Page

### 2.1 Template Card Component
- Create `apps/frontend/src/components/features/templates/template-card.tsx`:
  - Display template name, task type badge, version
  - Show slot count and priority order preview
  - Actions: Edit, Duplicate, Export, Delete
  - Similar design to CharacterCard but more compact

### 2.2 Library Page Implementation
- Update `apps/frontend/src/pages/template-library.tsx`:
  - Grid/List view toggle (stored in localStorage)
  - Filter by task type (turn_generation, chapter_summarization, writing_assistant)
  - Search by name
  - Import from JSON button
  - Create from scratch vs. from recipe options
  - Empty state with helpful prompts

## Phase 3: Template Builder Core Components

### 3.1 Layout Builder
- Create `apps/frontend/src/components/features/templates/builder/layout-builder.tsx`:
  - Draggable layout nodes using @dnd-kit/sortable
  - Visual representation of messages, slots, and separators
  - Add element menu (Message, Slot Reference, Separator)
  - Inline editing for simple message content
  - Visual indicators for slot references

### 3.2 Slot Manager
- Create `apps/frontend/src/components/features/templates/builder/slot-manager.tsx`:
  - List of configured slots with priority indicators
  - Add slot from recipe gallery
  - Custom slot option for advanced users
  - Slot status badges (configured, referenced in layout)
  - Priority reordering with drag-and-drop

### 3.3 Recipe Gallery
- Create `apps/frontend/src/components/features/templates/builder/recipe-gallery.tsx`:
  - Modal/drawer with categorized recipes by task
  - Recipe preview with description and parameters
  - "Add to Template" action
  - Search/filter capabilities

## Phase 4: Slot Configuration Components

### 4.1 Recipe-Based Slot Editor
- Create `apps/frontend/src/components/features/templates/builder/recipe-slot-editor.tsx`:
  - Dynamic form based on RecipeParamSpec
  - Parameter-specific input components:
    - NumberInput with min/max constraints
    - Select for predefined options
    - Switch for toggles
    - TemplateStringEditor for templated content
  - Real-time preview of generated SlotSpec
  - Budget allocation slider

### 4.2 Template String Editor
- Create `apps/frontend/src/components/features/templates/builder/template-string-editor.tsx`:
  - Monaco editor or CodeMirror for syntax highlighting
  - Variable autocomplete based on task context
  - Variable reference panel showing available variables
  - Live preview with sample data
  - Syntax validation

### 4.3 Custom Slot Editor
- Create `apps/frontend/src/components/features/templates/builder/custom-slot-editor.tsx`:
  - JSON editor for advanced users
  - Schema validation against SlotSpec type
  - Convert from recipe option
  - Documentation panel with DSL reference

## Phase 5: Template Form & Pages

### 5.1 Template Form Component
- Create `apps/frontend/src/components/features/templates/template-form.tsx`:
  - Three-panel layout:
    - Left: Layout builder
    - Center: Selected element configuration
    - Right: Slot manager
  - Template metadata (name, task, version)
  - Response format configuration
  - Response transforms editor (optional)
  - Form validation with react-hook-form and zod

### 5.2 Create/Edit Pages
- Update `apps/frontend/src/pages/template-create.tsx`:
  - Template type selection (task)
  - Start from: Blank, Recipe-based starter, Import JSON
  - Guided setup wizard for beginners
  
- Update `apps/frontend/src/pages/template-edit.tsx`:
  - Load existing template
  - Version increment on save
  - Unsaved changes protection
  - Preview with mock data

## Phase 6: Preview & Testing

### 6.1 Template Preview Component
- Create `apps/frontend/src/components/features/templates/template-preview.tsx`:
  - Render template with sample task context
  - Show generated ChatCompletionMessage[]
  - Token count estimation
  - Budget allocation visualization
  - Fill order animation

### 6.2 Mock Data Provider
- Create `apps/frontend/src/components/features/templates/mock-data.ts`:
  - Sample data for each TaskKind
  - Configurable scenarios (empty history, full context, etc.)
  - Data source preview panel

## Phase 7: Additional Features

### 7.1 Recipe Extensions
- Expand recipe library with more slot types:
  - Chapter summaries
  - Character roster
  - Intent/constraint
  - Step outputs
  - Custom instructions

### 7.2 Template Versioning
- Version history viewer
- Diff view between versions
- Rollback capability

### 7.3 Template Sharing
- Export/Import via JSON
- Template validation on import
- Template marketplace preparation

## Implementation Order

1. Start with Recipe Gallery and existing recipe implementations
2. Build Template Card and Library page
3. Implement Layout Builder with drag-and-drop
4. Add Slot Manager and configuration
5. Create Template Form integrating all components
6. Add Preview functionality
7. Implement API and database layer
8. Connect frontend to backend
9. Add advanced features

## UI/UX Patterns to Follow

- Use existing form patterns from CharacterForm and ScenarioForm
- Maintain consistent use of Card.Root for sections
- Follow color palette conventions (primary for main actions, neutral for meta)
- Use layerStyle="surface" for main containers
- Implement unsaved changes protection
- Add loading skeletons for async operations
- Include helpful tooltips and documentation links

## Key Dependencies

- @dnd-kit/sortable for drag-and-drop
- Monaco Editor or CodeMirror for code editing
- React Hook Form + Zod for form management
- Existing UI components from @/components/ui

## Architecture Notes

### Recipe System
The recipe system is already partially implemented in the frontend with:
- `RecipeDefinition` interface in `contracts.ts`
- Sample recipes like `timeline-recipe.ts` and `characters-recipe.ts`
- Parameter coercion utilities

### Component Structure
Following the existing patterns:
- Feature components in `apps/frontend/src/components/features/templates/`
- UI components in `apps/frontend/src/components/ui/`
- Pages in `apps/frontend/src/pages/`
- tRPC queries and mutations for API communication

### Form Management
Use the same patterns as Character and Scenario forms:
- react-hook-form with zodResolver
- Field components from @/components/ui
- Unsaved changes protection hook
- Card.Root containers with proper spacing

### State Management
- Local form state with react-hook-form
- Template draft state during editing
- Recipe gallery state for selection
- Preview state for mock data rendering