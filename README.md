## About

StoryForge uses language models to let users play with and direct semi-autonomous characters in a pseudo-tabletop RPG context. It's similar to popular applications like Character.AI and SillyTavern, but moves away from the *chat* paradigm, which gives models too much freedom to make mistakes. Instead, StoryForge tries to provide a more structured and controlled environment for the model to interact with the story.

The vision is something akin a turn-based/text-based version of The Sims, which places AI-driven characters in a scenario together and tries to draw forth entertaining emergent interactions between them. Players can influence the story directly or indirectly by providing narrative constraints, overriding character actions, or injecting chaos. Character agents have access to tool calls to roll dice, modify attributes and inventory, and track long-term goals.

### Key Concepts

- Turn-based timeline (1 turn = 1 character's action); turns are nodes in a rooted tree, and the path from the root to the "anchor" leaf is the "active timeline"
- Branching as a first-class concept; rewinding or switching timelines to explore alternative paths should be as low-friction as possible
- Player can interact directly or indirectly; interactions are modeled as "Intent" to influence the story in some way, with each Intent kind generating a different set of "Effects"
- An Intent can be a story constraint, a vague request for a character to do something, or direct control over a character's actions
- LLM interface happens via "generative tasks", such as Turn Generation or Chapter Summarization, for which the player can define custom workflows and prompt templates; a workflow can trigger multiple LLM calls, such as using a more strong logical model for a reasoning-focused "Draft" step chained to a simpler but more creative model for a "Prose" step.

### Technical Choices

- **Single-user desktop application**: Stack runs locally; NOT a hosted service so no need for auth, scaling, process management, etc.
- **Typescript throughout**: For rapid development and shared code reuse while enforcing sound types
- **Bring-your-own-model**: No built-in text inference; player configures cloud AI providers or their own local models
- **pnpm Monorepo**: Project is split into multiple packages to encourage code reuse and separation of concerns
