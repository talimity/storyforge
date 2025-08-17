# Scenario Player UI Specification

## Overview

The Scenario Player represents a fundamental shift in user experience from the main StoryForge application. When a user enters a scenario, the interface transforms from a CRUD web application layout into an immersive, game-like experience designed specifically for interactive storytelling and character roleplay. Exiting the scenario is akin to returning to the main menu of a game, switching to a different mode rather than navigating to another tab or page.

### Core Philosophy

- **Immersive Experience**: The scenario player should feel like entering a game rather than navigating a web application
- **Spatial Design**: Generous whitespace and clean presentation prioritize the narrative content
- **Context-Aware Interface**: UI elements adapt to the storytelling context and user needs
- **Progressive Disclosure**: Advanced features are accessible but not overwhelming

## Layout Architecture

### 1. Top Navigation Bar

**Unique to Scenario Player**: This bar does not appear in the main application and serves as the primary indicator that the user has entered the scenario experience.

**Components**:
- **Back Button** (top-left): Returns user to the main library, exiting the scenario
- **Scenario Title**: Displays current scenario name and chapter information
- **Meta Toolbar** (top-right): Contains actions not directly related to the narrative, such as:
  - Scenario Player settings (font size, theme, interface preferences)
  - Export turn history
  - Statistics (turn count, character interactions)
  - Scenario help/documentation link
  - and so forth.
    - This is not the place for items related to characters, narrative control, chapter/scene management, or turn generation.
    - Saving is not necessary as the scenario state is automatically persisted.

**Behavior**:
- Always visible during scenario play
- Provides clear exit path back to main application
- May include scenario status indicators (e.g., Scenario title, chapter title, current turn)

### 2. Sidebar Widget System

**Transformation from Main App**: The normal navigation sidebar becomes a collapsible widget toolbar containing scenario-specific controls.

**Widget Categories**:

#### Characters Widget
- **Purpose**: Manage characters participating in the scenario
- **Features**:
  - Character roster with status indicators (Present, Inactive [e.g., not currently in the scene], etc.)
  - Character switching controls for player control
  - Add/remove characters from scenario
  - Quick character profile access

#### Scenario Control Widget
- **Purpose**: Manage the scenario's environmental and narrative state
- **Features**:
  - Scene description editor
  - Atmosphere controls (e.g., mood, tone; impacts LLM generation)
  - Location/setting management, possibly supporting setting a scene background image
  - Scene transition controls

#### Generation Settings Widget
- **Purpose**: Real-time configuration of LLM and generation parameters
- **Features**:
  - Model parameter adjustments (temperature, top-p, etc.)
  - Response length controls
  - Style/tone preferences
  - Provider/model selection

Note: eventually we will assign each character their own model profile/agent workflow; this might be the place to manage those assignments and tweak agents' characterization.

#### Chapter/Scene Management Widget
- **Purpose**: Narrative structure and context management
- **Features**:
  - Chapter break initiation
  - Turn history summarization triggers
  - Context window management
  - Scene bookmark creation
  - Turn export/sharing tools

Note: Chapter/Scene are used somewhat interchangeably; it's not clear if we need both concepts. Chapters are more about narrative structure and giving defined places for us to summarize and prune context (so they are a key data structure) while scenes are more about the current setting and character interactions, and might just some fields in the chapter data structure.

**Interaction Model**:
- Widgets can be expanded/collapsed individually
- State persistence across scenario sessions
- Drag-and-drop reordering of widget priority
- Quick access toolbar for frequently used functions

### 3. Turn History Display

**Central Focus**: The narrative content occupies the majority of screen real estate with generous margins and whitespace.

**Design Principles**:
- **Whitespace Priority**: Content is framed by empty space, not confined by sidebars
- **Character Visual Integration**: Space reserved for character sprites/avatars in gutters
- **Customizable Presentation**: Support for background themes, typography choices
- **Temporal Navigation**: Easy scrolling through turn history with chapter markers

**Content Presentation**:
- Turn numbering and timestamps in the gutter
  - Probably should be optional
- Character attribution with visual indicators
- Narrative vs. character text differentiation
  - 'Narrator' is essentially an omniscient character; turns can be owned by them and appear distinctly
- Player vs. AI-generated content distinction
  - If a turn was generated from a player's described intent rather than direct input, the intent appears as a small note above the AI-generated response
  - Player intent is not a separate turn, but rather the impetus for that turn's generation. It should be minimally intrusive to the narrative flow, so perhaps just an icon for the intent type (e.g., "Plot Twist", "Character Focus") with a tooltip for details.
  - If the player directly controls a character, no intent note is needed, but we decorate that turn to indicate it was player-controlled
- Characters' portrait images can be displayed in the gutter. Perhaps the most recent character to act appears, while others are shown using their avatar icons.
- Turn text rendered using Chakra's `<Prose>` component, which renders Markdown.

**Turn Interaction**: Kebab menu for each turn with options like:
- Edit turn text
- Copy turn content
- Delete turn
- View generation metadata (e.g., LLM model used, parameters, inputs, workflow execution graph)

**Mobile Considerations**:
- Widget system collapses into drawer/modal interface, and only the turn history display is visible
- Turn history scrolls vertically with character sprites appearing as floating icons

Note: Eventually, branching will be supported. This will follow the Character.ai model of 'swipes', where (either by literally swiping or clicking a right arrow) the player can regenerate that turn, which creates a new node in the turn history graph. We'll solve for this later, but it will be a key feature of the turn history display.

### 4. Input Panel System

**Visual Distinction**: Rendered in `contrast` layerStyle to clearly separate input area from narrative content.

**Core Architecture**:

#### Multi-Modal Input System
The input panel supports different interaction paradigms based on player preference and scenario needs:

**Direct Character Control Mode**:
- Player assumes direct control of a specific character (including Narrator)
- Input is used verbatim as character's turn
- Character selection dropdown

This is essentially the 'roleplay' mode, similar to how SillyTavern and other AI roleplay chat interfaces work, though players can switch characters at any time.

**Story Constraint Mode**:
- Player provides high-level narrative direction or constraints
- AI determines which character responds and how
- Constraint type selection (plot development, character focus, tone direction)
- Constraint strength/specificity controls

**Quick Actions Mode**:
- One-click story advancement options for players feeling stuck or lazy
- Button-based interface: "Plot Twist", "Surprise Me", "Focus on [Character]", "Jump Ahead", etc.
- Customizable action palette?

#### Panel Layout
- **Primary Text Area**: Large, comfortable typing space
  - Use Chakra `autoresizable`
- **Mode Selector**: Toggle between input modes via segmented control
  - "Direct Control": Shows character selector and text area
  - "Story Constraints": Shows constraint type selector and text area
  - "Quick Actions": Displays action palette buttons instead of text area

Integrate Generate button into text area to avoid cluttering the interface with too many buttons.

### 5. Modal Sheet Workflow

This pattern lets players open deep-editing views (character edit, model/agent workflow edit, etc.) without having to exit the scenario player (and unmount the component).

| Goal                                   | Rationale                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Keep the ScenarioPlayer mounted        | Preserves history scroll position, widget state, and unsent input drafts.                                     |
| Provide focused, full-height workspace | Complex forms (e.g., character editor) need more room than a pop-over but shouldn’t feel like a page-change. |
| Offer escapable, stacked interactions  | Users may open nested sheets (e.g., Character → Prompt). Each layer must be dismissible in LIFO order.        |

#### 1. Invocation

* **Entry points**

  * “Edit” buttons in widgets or turn kebab menus
  * Keyboard shortcut (`E` while a character is selected)
* **API**

  ```ts
  const openSheet = useSheet();
  openSheet(<CharacterEditor id="123" />);
  ```

  `useSheet()` pushes a component onto a central sheet stack.

#### 2. Appearance & Behavior

* **Presentation**
  * Slides in from the **right** on desktop (width `min(480px, 80vw)`)
  * On mobile, slides **up** from bottom (`100%` width)
  * Underlay dims (`backdrop-blur-sm bg-black/40`) and traps focus
* **Header**
  * Title + optional subtitle
  * Close (✕) button at top-right; Escape key closes
* **Body**
  * Scrollable vertically; sheet itself occupies full height
* **Footer (optional)**
  * Sticky action bar for *Save / Cancel* or *Regenerate* buttons

#### 3. Stacking Rules

1. **Push** new sheets onto the stack.
2. **Dismiss** with Close / ESC / backdrop-click (unless `disableBackdropClose`).
3. **Return focus** to the element that triggered the sheet.
4. Limit to **3 levels**; deeper pushes replace the topmost sheet.

#### 4. Persistence & Dirty-State
* On attempt to close with unsaved changes:
  * Prompt “Discard changes?” (we already have useUnsavedChangesProtection hook)
* We will need to solve for updating scenario entities when they are changed in a sheet. React Query may be able to help with this, but we need to ensure that character widgets are correctly subscribed to the queries.
Focus is trapped inside the sheet until it is dismissed.

#### 5. Theming & Layering

* Sheets live in the **modal layer** (`z-index` above widgets, below toasts).
* Draw semi-transparent backgrounds to visually separate from the Turn History content.

#### 6. Example Use-Cases

| Sheet                | Trigger                     | Primary Actions         |
| -------------------- | --------------------------- | ----------------------- |
| **Character Editor** | Character widget → “Edit”   | Save, Duplicate, Delete |
| **Prompt Template**  | Character editor sidebar    | Save, Test-Generate     |
| **Turn Metadata**    | Turn kebab menu → “Details” | Copy Raw Prompt         |

> **Note:** Because sheets are decoupled components, future backend-heavy editors (e.g., “Context Inspector”) can be lazy-loaded, improving initial ScenarioPlayer performance.

## Interaction Model

### State Management
- **Scenario State**: Current characters, scene, chapter, turn history
- **UI State**: Widget visibility, panel configuration, user preferences
- **Session State**: Temporary settings, draft inputs, undo history

### Navigation Paradigm
- **Scenario-Centric**: All navigation happens within the scenario context
- **Persistent Context**: User never loses their place in the narrative
- **Widget-Based**: Narrative controls are always accessible via the side panel.
- **Sheet-Based**: Tasks that require a full-screen focus (like character editing) use modal sheets to keep the user in the scenario player

### Responsive Behavior
- **Desktop**: Full widget sidebar, expanded input panel, character sprites
- **Tablet**: Collapsible sidebar, compact input panel
- **Mobile**: Drawer-based widgets, minimal chrome, focus on content

## Technical Considerations

### Example Component Hierarchy
```
ScenarioPlayerLayout
├── TopBar
│   ├── BackButton
│   ├── ScenarioHeader
│   └── MetaToolbar
├── WidgetPanel
│   ├── CharacterListWidget
│   ├── ScenarioControlWidget
│   ├── SettingsWidget
│   └── ChapterWidget
├── TurnHistory
│   ├── TurnList
│   ├── Turn
│   └── TurnGutter
└── IntentPanel
    ├── ModeSelector
    ├── PlayerInput
    └── ActionPalette
```

Sheets are loaded using a new `useSheet` hook which can simply load the existing CharacterForm, etc.

### Frontend Performance Considerations
- **Lazy Loading**: Turn history loads incrementally, bottom-up
- **State Optimization**: Minimal re-renders during typing and interaction

## Implementation Status

### Completed Architecture Improvements (2025-08-12)

#### Component Architecture
The scenario player has been refactored to follow a clean, modular architecture:

**Component Hierarchy**:
```
PlayerShell                      // Layout shell with navigation
├── PlayerPage                   // Main player orchestrator
│   ├── TurnHistory             // Timeline display with pagination
│   └── IntentPanel             // Input management
│       ├── DirectControlPanel  // Direct character control
│       ├── StoryConstraintsPanel // Story guidance
│       └── QuickActionsPanel  // Quick action buttons
└── PlayerWidgetSidebar         // Character/tool selector
```

#### Data Layer Improvements
- **Custom Hooks**: Created dedicated hooks for data management
  - `useScenarioEnvironment`: Centralized bootstrap data fetching with caching
  - `useScenarioTimeline`: Timeline pagination with deduplication support
  - `useScenarioIntent`: Intent/turn mutations with optimistic updates
- **State Management Strategy**:
  - React Query for server state (environment, timeline, mutations)
  - Zustand for ephemeral client state (selected character)
  - Component state for UI-specific concerns

#### Key Improvements Delivered
1. **Reduced complexity**: From 5 useEffects to minimal conditional logic
2. **Eliminated duplication**: Single bootstrap query shared across components
3. **Clean separation**: Business logic moved to hooks, UI stays pure
4. **Pagination ready**: Timeline supports infinite scroll with cursor-based pagination
5. **Modular intent panels**: Each input mode as a separate component

#### Timeline Data Management
- Prepared for paginated timeline fetching with overlap deduplication
- Auto-loading on scroll near top of history
- Maintains full timeline in memory for smooth scrolling
- Turn numbering computed from `depthFromAnchor`

### Pending Implementation
- Backend timeline query implementation (currently stubbed)
- Real intent processing pipeline
- Swipe navigation between timeline branches
- Chapter navigation UI
- Modal sheet workflow for editors

## Future Enhancements

### Accessibility
- **Keyboard Navigation**: Complete keyboard access to all functions
- **Screen Reader Support**: Full semantic markup for narrative content
- **Text Scaling**: Readable typography at all zoom levels

### Customization
- **Theme System**: User-created visual themes for different story types
  - We can use Chakra's ThemeProvider to let users just specify color scale overrides, which our semantic tokens will automatically pick up.
- **Layout Preferences**: Adjustable panel sizes and positions
- **Widget Extensions**: Plugin system for custom scenario tools
  - Agent workflows may be able to define Options that appear in the widget sidebar, allowing for custom scenario tools to be added by the agent workflow developer.
- **Export Options**: Markdown, JSON (our format), SillyTavern export, etc.
