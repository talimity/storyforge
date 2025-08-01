# AI Tabletop Roleplay Engine

## Project Vision

An LLM-powered character roleplaying application that moves beyond traditional 1-on-1 AI chat paradigms toward a tabletop RPG experience where the user acts as director/dungeon master rather than a single character participant.

## Core Concept

### Traditional AI Chat vs. Tabletop Director Model

**Traditional AI Chat Apps (Character.AI, SillyTavern, etc.):**

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

- Load multiple characters into scenarios using popular SillyTavern "character card v2" format
- User can play any character, multiple characters, or no characters
- Seamless transition between director mode and character participation
- AI-driven characters can interact amongst themselves while user orchestrates events

### 2. Agentic Narrative Engine

Instead of single-model generation, each turn can use multiple specialized agents:

Example Agent Workflow:

**Planner Agent:**

- Receives full scenario history
- Thinks, in-character, about current state and desired actions
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

The idea is that each agent can be more specialized and narrowly focused, which avoids the issue where increasingly large models and more expensive are needed to juggle style instructions, characterization, logical consistency, and narrative flow in a single pass, and even then only partially.

This is just one example; agent workflows should be flexible. Another flow might be Dreamer -> Critic -> Writer, where an iterative process refines the product through multiple passes.

### 3. Context Management Strategy

- Layered context for different agents
- Specialized context depth based on agent role
- Separation of narrative presentation from model context; each agent may receive different context layers
- Avoid long-context degradation by slicing scenarios into chapters, which can be summarized and pruned
