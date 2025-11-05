# Storyforge
> The horribly generic name will be changed eventually.

This is a locally-hosted character roleplaying/storytelling frontend similar to SillyTavern, RisuAI, et al.

You can use it as an LLM RP chat interface if you want. However it's more geared towards letting the player act as a game master or director of semi-autonomous characters, and will be developed in that direction.

The eventual goal is an experience closer to a text-based sandbox RPG than a roleplay chat app. For now it mostly just feels like a chat app, though.

---

**Note:** Nothing is production ready yet. There is no documentation. Expect most features to be unpolished or incomplete, and a lot of bad UI.

LLM provider support is very limited, though the OpenAI-compatible interface covers most local and cloud-hosted models.

---

<!-- TOC -->
* [Storyforge](#storyforge)
  * [Features](#features)
    * [Implemented](#implemented)
    * [Planned](#planned)
  * [Installation](#installation)
    * [Prerequisites](#prerequisites)
    * [Steps](#steps)
  * [Usage](#usage)
    * [Caveats](#caveats)
<!-- TOC -->

## Features

### Implemented
- **Turn-based narrative generation**
  - Player can act as any character, via different interaction modes:
    - Directly control character
    - Guide/instruct character
    - Narrator directives
    - Unguided continue
  - Branching system with scenario graph visualization
  - Swipes/regenerations
  - Set up party scenarios with many characters
  - Organize scenarios into chapters, with auto-summarization
    - Summaries can replace turns from earlier chapters to reduce prompt length
- **Character/Scenario/Lorebook library management**
  - Create characters, scenarios, and lorebooks
  - Import characters and lorebooks from SillyTavern/Chub
  - Import chats from SillyTavern
  - Auto-cropped avatars from card images
  - Customizable character dialogue colors
- **Prompt template system**
  - Drag-and-drop layout editor
  - `{{variable}}` interpolation, `{{#if expr}}` conditional blocks
  - Depth-based prompt injections for lore entries
  - Budgeting system to manage context length
  - Template normalization for compatibility with any supported LLM provider
- **Workflow system**
  - Allows chaining multiple LLM calls with different templates, models, generation settings
    - e.g., run a draft/planner step, pass its outputs to a prose writer step
  - Workflows can be assigned globally, per-scenario, or per-character
  - Test workflows and prompts against actual scenarios without invoking API calls
- **Model/provider abstraction layer**
  - Current adapters: OpenAI-compatible, OpenRouter, Deepseek Platform
    - OpenAI-compatible tested with vllm, sglang, tabbyapi local models. I've not tested with actual OpenAI yet but it probably works.
  - Chat completion is recommended but text completion endpoints work if you provide a jinja template
- **Event-sourced timeline state** 
  - (Only backend implemented for now) Beyond turns, state changes are recorded as discrete events in an append-only log
  - Allows for future features like character attributes/inventories/statuses etc that remain temporally consistent across branching, rewinds, regenerations, etc
- **Reasonably mobile-friendly UI**

### Planned
- **Writing Assist mode**
  - Invoke general purpose writing assist commands in various contexts (in character editor, to rewrite a turn, to suggest next actions, etc)
  - Scratchpad for freeform co-writing with LLM
- **Character stat tracking**
  - **Scene presence**: Flag as present/absent/incapacitated to control turn selection
  - **Goals**: Track short-term and long-term goals for each character
  - **Relationships**: Model relationships between characters or factions
  - **Attributes and collections** Model arbitrary scalars (health, money, sanity, whatever) or collections (inventory, languages, skills, etc)
  - **(maybe) Secrets**: Track what each character knows about others, hide specific paragraphs in descriptions or turns from characters who don't know them yet
- **Scenario state**
  - **World state**: Track global variables (time of day, weather, location states, etc)
  - **Scenes/locations**: Use scene transitions to change background descriptions, available characters, atmosphere, etc
- **Asset management**
  - Store images, themes, etc associated with characters or scenarios
- **Theme customization**
- **Expanded provider support**: Anthropic, Gemini, Grok
- **Packaging and releases**: Docker image, npm package, Electron build

## Installation

No releases available yet.

### Prerequisites
- NodeJS 22+
- pnpm

### Steps
1. Clone repository
    ```bash
    git clone https://github.com/talimity/storyforge.git
    cd storyforge
    ```
2. Install dependencies
    ```bash
    pnpm install
    ```
3. Build
    ```bash
    pnpm build
    pnpm build:frontend
    ```
4. Migrate database
    ```bash
    pnpm --filter=db db:migrate
    ```
5. Start (via Vite preview server)
    ```bash
    pnpm start
    ```
6. Open your browser to `http://localhost:4173`

---

**Note:** You must run the migration step any time you pull new changes, there is no automatic database migration.

---

## Usage

To get started, you first need to set up an LLM inference provider and a model profile, from the Models page.

There is no onboarding or starter data yet, so you will need to create a prompt template and a workflow to do anything useful. The workflow can have a single step that uses your new prompt template and whatever model you set up.

After that, you can proceed to import characters and create a scenario (or import a SillyTavern chat) and start playing.

### Caveats

While functional enough that I can use it regularly, it's not intended for public use at this time. Character and scenario data should be stable, but prompt templates and especially workflows are likely to change without backwards compatibility in mind.

Always back up the database before pulling new changes, there is no backup system yet. The default SQLite database is stored at `./data/storyforge.db`. You must copy the .db, .wal and .shm files together to have a consistent backup.
