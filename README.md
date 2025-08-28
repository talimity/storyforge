# StoryForge - AI Tabletop Roleplay Engine

## About

StoryForge is an LLM-powered character roleplaying application that reimagines AI character chat interfaces as a tabletop RPG experience. The player is positioned as a director/dungeon master orchestrating multi-character scenarios rather than being locked into a single character role chatting with one other character. An agentic narrative engine generates turns by passing inputs across multiple stages (Planner -> Screenplay -> Prose, or Dreamer -> Critic -> Writer) to improve the quality of the output.

### Vision

- **Agentic narrative engine**: Turns are managed by a narrative engine that handles character actions, scene management, and AI interactions
- **Flexible role management**: Player can act as any character, all characters, or only the narrator
- **Event-driven narratives**: Player-prompted events force the narrative engine to generate new turns

### Technical Choices

- **Single-user desktop application** - Not a hosted web service or commercial product, stack runs locally
- **Bring your own API key** - Players provide cloud inference API keys or local models
- **TypeScript/Node.js focused** - Shared codebase between backend and frontend
