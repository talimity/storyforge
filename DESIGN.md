# AI Tabletop Roleplay Engine - Design Document

## Project Vision

An LLM-powered character roleplaying application that moves beyond traditional 1-on-1 AI chat paradigms toward a tabletop RPG experience where the user acts as director/dungeon master rather than a single character participant.

## Core Concept

### Traditional AI Chat vs. Tabletop Director Model

**Traditional AI Chat Apps (Character.AI, Chai, etc.):**
- Rigid 1-on-1 roleplay: {{user}} chats with {{char}}
- User locked into single character role
- Simple chat history context
- Direct human-assistant conversation mapping

**This Application:**
- User as director/DM controlling scenario flow
- Multiple characters interact independently
- User can assume any character role temporarily or remain director
- Characters abstracted from human/assistant chat roles
- Event-driven narrative with user-prompted twists and challenges

## Key Innovations

### 1. Flexible Role Management
- Load multiple characters into scenarios using existing "character card" format
- User can play any character, multiple characters, or no characters
- Seamless transition between director mode and character participation
- Characters can interact amongst themselves while user orchestrates events

### 2. Agentic Narrative Engine
Instead of single-model generation, each turn uses multiple specialized agents:

**Planner Agent:**
- Receives full scenario history
- Thinks in-character about current state and desired actions
- Generates internal monologue and strategic planning
- Runs on larger models with full context

**Screenplay Agent:**
- Takes history + planner output
- Writes terse dialogue and action descriptions
- Focuses on structure and pacing
- Uses condensed context for efficiency

**Prose Agent:**
- Converts screenplay to final narrative prose
- Handles style and voice consistency
- Operates on recent context only
- Can use smaller/cheaper models

**Ranking Agent:**
- Evaluates multiple generation attempts
- Selects best narrative direction
- Enables parallel generation with quality control

### 3. Context Management Strategy
- **Full Context:** Planner agents get complete scenario history
- **Condensed Context:** Screenplay summaries instead of full prose
- **Recent Context:** Prose agents work with immediate history
- **Aggressive Pruning:** Maintain performance without losing narrative coherence

## Technical Problems Being Solved

### Current AI Roleplay Issues:
1. **State Tracking:** Models forget narrative details across long contexts
2. **Context Bloat:** Expensive token usage with large conversation histories
3. **Prose Quality:** "Slop" writing from poor training data
4. **Instruction Juggling:** Models struggle balancing style, voice, and consistency

### Agentic Solutions:
1. **Specialized Agents:** Each agent has focused responsibilities
2. **Layered Context:** Different agents get appropriate context depth
3. **Quality Control:** Ranking and selection mechanisms
4. **Parallel Processing:** Multiple attempts with best selection

## User Experience Flow

1. **Library Management:**
   - Import and organize character cards (SillyTavern format compatibility)
   - Create and save scenarios for reuse
   - Configure API keys and agent settings
   - Manage lorebooks and world-building content

2. **Scenario Setup:**
   - Select characters from library to add to scenario
   - Define scenario parameters and setting
   - Set initial conditions and context

3. **Director Mode:**
   - Prompt events and narrative twists
   - Control pacing and story direction
   - Introduce challenges and complications
   - Observe character interactions

4. **Character Participation:**
   - Step into any character role when desired
   - Override AI-generated turns manually
   - Let AI handle character when stuck
   - Seamless role switching

5. **Turn Management:**
   - Turn-based structure maintains clear boundaries
   - Edit previously generated content
   - Review and modify turn history
   - Control narrative flow

## Technical Architecture Goals

### Core Requirements:
- Character card loading and management
- Scenario creation and persistence
- Turn-based narrative engine
- Manual turn override capabilities
- Turn history viewing and editing
- Multi-agent orchestration system
- Central library system for characters, scenarios, API configs, agent customizations, lorebooks
- Immersive in-scenario UI with visual storytelling elements

### Technology Constraints:
- **Boring and Reliable:** Use established, well-documented technologies
- **Single User:** Bring-your-own-API-key desktop/local application
- **Not a Product:** Personal tool, not commercial service
- **Familiar Stack:** TypeScript, Express, SQLite, React
- **No Experimentation:** Focus on functionality, not learning new frameworks
- **Mobile Consideration:** Frontend should be mobile-responsive, not broken on mobile devices

### Implementation Priorities:
1. **Phase 1:** Basic infrastructure (database, API, frontend scaffold)
2. **Phase 2:** Character and scenario management
3. **Phase 3:** Simple single-agent turn generation
4. **Phase 4:** Multi-agent narrative engine
5. **Phase 5:** Advanced features and refinements

## Success Criteria

The application succeeds when:
- Characters can be loaded and managed easily
- Scenarios can be created and modified
- Turn-based narrative flows naturally
- User can seamlessly switch between director and character roles
- Agentic system produces higher quality, more consistent narrative than single-model approaches
- Context management keeps token costs reasonable while maintaining story coherence

## Non-Goals

- Web service or hosted solution
- Multi-user functionality
- Commercial viability
- Framework experimentation
- Mobile applications
- Real-time collaboration features

## Visual Storytelling & UI Design

### Immersive Scenario Experience
The in-scenario UI is critical for storytelling immersion and goes beyond basic chat interfaces:

**Current Priority:**
- Visually appealing turn presentation
- Mobile-responsive design
- Intuitive navigation between director and character modes
- Clean, readable typography for narrative text

**Future Agentic Visual Control:**
- **Dynamic Backgrounds:** Agents select or generate scene-appropriate backgrounds
- **Character Sprites:** Emotion-based character sprite selection
- **Visual Novel Elements:** "Paper doll" sprite positioning (3-4 characters max)
- **Scene Composition:** Agents control character placement based on interactions
- **Atmospheric Control:** Lighting, mood, and visual effects driven by narrative context

### Design Philosophy
- **Immersion Over Efficiency:** UI should enhance storytelling, not just display data
- **Agent-Driven Presentation:** Visual elements controlled by narrative agents
- **Progressive Enhancement:** Start with solid text-based experience, layer visual elements

## Data Architecture Considerations

### Multi-Layer Turn Storage
Unlike traditional chat apps that reuse conversation history for both model input and user presentation, this system requires storing multiple data layers:

**Turn Structure (Preliminary):**
```
Turn {
  id: string
  scenario_id: string
  sequence: number
  timestamp: datetime
  
  // Agent Outputs (stored separately)
  planner_output: string      // Internal monologue, state analysis
  screenplay_output: string   // Terse dialogue and actions
  prose_output: string       // Final narrative presentation
  
  // Metadata
  active_character: string
  turn_type: 'character' | 'director' | 'system'
  user_edited: boolean
  
  // Visual Control (future)
  background_id?: string
  character_positions?: object
  mood_tags?: string[]
}
```

**Key Data Architecture Questions:**
1. **Turn Granularity:** What constitutes a discrete "turn"? Single character action? Complete scene?
2. **Context Reconstruction:** How to efficiently rebuild context for different agent types?
3. **Version Control:** How to handle user edits while preserving agent outputs?
4. **Cross-References:** How to link characters, scenarios, and lorebook entries?
5. **Agent State:** Where to store agent-specific context and memory?

**Storage Requirements:**
- **Characters:** Library with metadata, traits, relationships
- **Scenarios:** Templates, active sessions, configuration
- **Turns:** Multi-layer agent outputs, presentation data, metadata
- **Lorebooks:** World-building, rules, context injection points
- **Agent Configs:** Model assignments, prompt templates, parameters
- **API Configs:** Provider settings, keys, rate limits
- **Visual Assets:** Backgrounds, sprites, generated images

### Database Design Priorities
1. **Efficient Context Queries:** Fast retrieval of relevant turn history for agents
2. **Flexible Schema:** Accommodate evolving agent architectures
3. **User Edit Tracking:** Preserve both original and modified content
4. **Cross-Scenario Sharing:** Characters and lorebooks usable across scenarios
5. **Performance:** SQLite optimization for complex narrative queries