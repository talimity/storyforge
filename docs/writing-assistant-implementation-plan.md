# Writing Assistant Implementation Plan

## Overview

This document outlines the implementation plan for a tiptap v3-based writing assistant editor component. The editor will support AI-generated text with logprobs metadata, hover interactions for alternative token selection, and contextual AI operations without any rich text formatting features.

## Core Requirements

1. **Plain text editing** with metadata attachment via custom marks
2. **AI-generated text tracking** with logprobs storage
3. **Hover interactions** showing alternative tokens from logprobs
4. **Context injection** for providing external data to AI operations
5. **Visual distinction** between user and AI-generated text

## Technical Stack

- **Editor**: tiptap v3 with minimal extensions
- **Floating UI**: Built-in tiptap v3 positioning system (replaces Tippy.js)
- **Framework**: React with TypeScript
- **State Management**: Editor state via tiptap, component state via React hooks

## Package Dependencies

```json
{
  "@tiptap/react": "^3.x",
  "@tiptap/pm": "^3.x",
  "@tiptap/core": "^3.x",
  "@tiptap/extension-document": "^3.x",
  "@tiptap/extension-text": "^3.x",
  "@tiptap/extension-paragraph": "^3.x",
  "@tiptap/extension-bubble-menu": "^3.x",
  "@floating-ui/react": "^0.x"
}
```

## Implementation Structure

### Phase 1: Core Editor Setup

#### 1.1 Custom Mark for AI-Generated Text

**File**: `apps/frontend/src/components/features/writing-assistant/marks/ai-generated-mark.ts`

```typescript
import { Mark } from '@tiptap/core'

interface LogprobData {
  token: string
  logprob: number
  bytes: number[] | null
}

interface AIGeneratedAttrs {
  logprobs: LogprobData[]
  topLogprobs: LogprobData[][]
  generatedAt: number
  modelId?: string
}

export const AIGeneratedMark = Mark.create<{ HTMLAttributes: Record<string, any> }>({
  name: 'aiGenerated',
  
  addOptions() {
    return {
      HTMLAttributes: {
        class: 'ai-generated-text',
        'data-ai': 'true'
      },
    }
  },

  addAttributes() {
    return {
      logprobs: {
        default: [],
        parseHTML: element => JSON.parse(element.getAttribute('data-logprobs') || '[]'),
        renderHTML: attributes => ({
          'data-logprobs': JSON.stringify(attributes.logprobs)
        })
      },
      topLogprobs: {
        default: [],
        parseHTML: element => JSON.parse(element.getAttribute('data-top-logprobs') || '[]'),
        renderHTML: attributes => ({
          'data-top-logprobs': JSON.stringify(attributes.topLogprobs)
        })
      },
      generatedAt: {
        default: Date.now(),
        parseHTML: element => parseInt(element.getAttribute('data-generated-at') || '0'),
        renderHTML: attributes => ({
          'data-generated-at': attributes.generatedAt
        })
      },
      modelId: {
        default: null,
        parseHTML: element => element.getAttribute('data-model-id'),
        renderHTML: attributes => attributes.modelId ? {
          'data-model-id': attributes.modelId
        } : {}
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-ai="true"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { ...this.options.HTMLAttributes, ...HTMLAttributes }, 0]
  },

  // Mark should be kept when content is split
  keepOnSplit: true,
})
```

#### 1.2 Hover Detection Plugin

**File**: `apps/frontend/src/components/features/writing-assistant/plugins/hover-detection-plugin.ts`

Using ProseMirror's Plugin API through `@tiptap/pm`:

```typescript
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { EditorView } from '@tiptap/pm/view'

export interface HoverState {
  hoveredPos: number | null
  hoveredMark: any | null
}

export const hoverDetectionPlugin = (onHoverChange: (state: HoverState) => void) => {
  return new Plugin({
    key: new PluginKey('hoverDetection'),
    
    props: {
      handleDOMEvents: {
        mouseover: (view: EditorView, event: MouseEvent) => {
          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })
          
          if (pos && pos.pos) {
            const $pos = view.state.doc.resolve(pos.pos)
            const marks = $pos.marks()
            const aiMark = marks.find(mark => mark.type.name === 'aiGenerated')
            
            onHoverChange({
              hoveredPos: pos.pos,
              hoveredMark: aiMark,
            })
          }
          
          return false
        },
        
        mouseleave: () => {
          onHoverChange({
            hoveredPos: null,
            hoveredMark: null,
          })
          return false
        }
      }
    }
  })
}
```

### Phase 2: Floating UI Integration

#### 2.1 Alternative Token Tooltip

**File**: `apps/frontend/src/components/features/writing-assistant/components/alternative-token-tooltip.tsx`

Using tiptap v3's BubbleMenu as a base for floating UI:

```typescript
import { BubbleMenu, Editor } from '@tiptap/react'
import { useCallback, useState } from 'react'

interface AlternativeTokenTooltipProps {
  editor: Editor
  hoveredMark: any | null
}

export const AlternativeTokenTooltip: React.FC<AlternativeTokenTooltipProps> = ({
  editor,
  hoveredMark
}) => {
  const shouldShow = useCallback(() => {
    return !!hoveredMark && hoveredMark.attrs.topLogprobs?.length > 0
  }, [hoveredMark])
  
  const handleAlternativeSelect = (alternative: LogprobData) => {
    // Implementation for replacing token with alternative
    // Uses editor commands to update the mark
  }
  
  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      tippyOptions={{
        placement: 'top',
        offset: [0, 10],
      }}
    >
      <div className="alternative-tokens-menu">
        {hoveredMark?.attrs.topLogprobs?.map((alt: LogprobData, idx: number) => (
          <button
            key={idx}
            onClick={() => handleAlternativeSelect(alt)}
            className="alternative-token-option"
          >
            {alt.token}
            <span className="logprob">{(Math.exp(alt.logprob) * 100).toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </BubbleMenu>
  )
}
```

### Phase 3: Main Editor Component

#### 3.1 Writing Assistant Editor

**File**: `apps/frontend/src/components/features/writing-assistant/writing-assistant-editor.tsx`

```typescript
import { useEditor, EditorContent } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Text from '@tiptap/extension-text'
import Paragraph from '@tiptap/extension-paragraph'
import { Extension } from '@tiptap/core'
import { AIGeneratedMark } from './marks/ai-generated-mark'
import { hoverDetectionPlugin } from './plugins/hover-detection-plugin'
import { AlternativeTokenTooltip } from './components/alternative-token-tooltip'

export interface WritingAssistantContext {
  [key: string]: unknown
}

interface WritingAssistantEditorProps {
  content?: string
  onChange?: (content: string) => void
  context?: WritingAssistantContext
  onAIAction?: (action: string, selectedText: string, context: WritingAssistantContext) => void
}

// Custom extension to add hover detection
const HoverExtension = Extension.create({
  name: 'hover',
  
  addProseMirrorPlugins() {
    return [
      hoverDetectionPlugin((state) => {
        // Store hover state for tooltip
        this.storage.hoverState = state
      })
    ]
  }
})

export const WritingAssistantEditor: React.FC<WritingAssistantEditorProps> = ({
  content = '',
  onChange,
  context = {},
  onAIAction
}) => {
  const [hoveredMark, setHoveredMark] = useState(null)
  
  const editor = useEditor({
    extensions: [
      Document,
      Text,
      Paragraph,
      AIGeneratedMark,
      HoverExtension.configure({
        onHoverChange: (state) => setHoveredMark(state.hoveredMark)
      })
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'writing-assistant-editor'
      }
    }
  })
  
  const handleAIAction = (action: string) => {
    if (!editor) return
    
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to)
    
    onAIAction?.(action, selectedText, context)
  }
  
  return (
    <div className="writing-assistant-container">
      <EditorContent editor={editor} />
      {editor && (
        <>
          <AlternativeTokenTooltip editor={editor} hoveredMark={hoveredMark} />
          <AIActionMenu editor={editor} onAction={handleAIAction} />
        </>
      )}
    </div>
  )
}
```

### Phase 4: AI Action Integration

#### 4.1 Context Menu for AI Actions

**File**: `apps/frontend/src/components/features/writing-assistant/components/ai-action-menu.tsx`

Using BubbleMenu for context-sensitive AI actions:

```typescript
import { BubbleMenu, Editor } from '@tiptap/react'

interface AIActionMenuProps {
  editor: Editor
  onAction: (action: string) => void
}

const AI_ACTIONS = [
  { id: 'rewrite', label: 'Rewrite', icon: '✏️' },
  { id: 'expand', label: 'Expand', icon: '📝' },
  { id: 'shorten', label: 'Shorten', icon: '✂️' },
  { id: 'change-tense', label: 'Change Tense', icon: '⏰' },
  { id: 'change-perspective', label: 'Change Perspective', icon: '👁️' },
]

export const AIActionMenu: React.FC<AIActionMenuProps> = ({ editor, onAction }) => {
  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor }) => {
        // Show when text is selected
        const { from, to } = editor.state.selection
        return from !== to
      }}
      tippyOptions={{
        placement: 'top-start',
        offset: [0, 10],
      }}
    >
      <div className="ai-action-menu">
        {AI_ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            className="ai-action-button"
          >
            <span className="icon">{action.icon}</span>
            <span className="label">{action.label}</span>
          </button>
        ))}
      </div>
    </BubbleMenu>
  )
}
```

### Phase 5: Playground Page

#### 5.1 Testing Environment

**File**: `apps/frontend/src/pages/writing-assistant-playground.tsx`

```typescript
import { useState } from 'react'
import { WritingAssistantEditor, WritingAssistantContext } from '@/components/features/writing-assistant/writing-assistant-editor'

export const WritingAssistantPlayground: React.FC = () => {
  const [content, setContent] = useState('<p>Start typing or use AI actions...</p>')
  const [context, setContext] = useState<WritingAssistantContext>({
    turnHistory: [],
    characterName: 'Test Character',
    scenarioContext: 'A mystical forest'
  })
  
  const handleAIAction = async (action: string, selectedText: string, context: WritingAssistantContext) => {
    console.log('AI Action:', { action, selectedText, context })
    
    // Mock AI response with logprobs
    const mockResponse = {
      text: 'This is AI generated text',
      logprobs: [
        { token: 'This', logprob: -0.1, bytes: null },
        { token: ' is', logprob: -0.2, bytes: null },
        // ... more tokens
      ],
      topLogprobs: [
        [
          { token: 'This', logprob: -0.1, bytes: null },
          { token: 'That', logprob: -0.5, bytes: null },
          { token: 'It', logprob: -0.8, bytes: null },
        ],
        // ... alternatives for each token
      ]
    }
    
    // Apply AI-generated text with mark
    // Implementation would use editor commands to insert marked text
  }
  
  return (
    <div className="playground-container">
      <h1>Writing Assistant Playground</h1>
      
      <div className="context-panel">
        <h2>Context</h2>
        <textarea
          value={JSON.stringify(context, null, 2)}
          onChange={(e) => {
            try {
              setContext(JSON.parse(e.target.value))
            } catch {}
          }}
        />
      </div>
      
      <div className="editor-panel">
        <WritingAssistantEditor
          content={content}
          onChange={setContent}
          context={context}
          onAIAction={handleAIAction}
        />
      </div>
      
      <div className="output-panel">
        <h2>Current Content</h2>
        <pre>{content}</pre>
      </div>
    </div>
  )
}
```

### Phase 6: Styling

#### 6.1 CSS Module

**File**: `apps/frontend/src/components/features/writing-assistant/writing-assistant.module.css`

```css
.writing-assistant-editor {
  min-height: 200px;
  padding: 1rem;
  border: 1px solid var(--chakra-colors-surface-border);
  border-radius: var(--chakra-radii-md);
  font-family: var(--chakra-fonts-mono);
}

/* AI Generated Text Styling */
.ai-generated-text {
  background: linear-gradient(
    90deg,
    rgba(147, 51, 234, 0.1) 0%,
    rgba(79, 70, 229, 0.1) 100%
  );
  border-bottom: 1px dotted var(--chakra-colors-primary-400);
  cursor: pointer;
  transition: background 0.2s;
}

.ai-generated-text:hover {
  background: linear-gradient(
    90deg,
    rgba(147, 51, 234, 0.2) 0%,
    rgba(79, 70, 229, 0.2) 100%
  );
}

/* Alternative Tokens Menu */
.alternative-tokens-menu {
  background: var(--chakra-colors-surface);
  border: 1px solid var(--chakra-colors-surface-border);
  border-radius: var(--chakra-radii-md);
  padding: 0.5rem;
  box-shadow: var(--chakra-shadows-lg);
}

.alternative-token-option {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.alternative-token-option:hover {
  background: var(--chakra-colors-surface-muted);
}

.logprob {
  font-size: 0.875rem;
  color: var(--chakra-colors-content-muted);
  margin-left: 0.5rem;
}

/* AI Action Menu */
.ai-action-menu {
  display: flex;
  gap: 0.25rem;
  background: var(--chakra-colors-surface);
  border: 1px solid var(--chakra-colors-surface-border);
  border-radius: var(--chakra-radii-md);
  padding: 0.25rem;
  box-shadow: var(--chakra-shadows-lg);
}

.ai-action-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--chakra-radii-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.ai-action-button:hover {
  background: var(--chakra-colors-surface-muted);
  border-color: var(--chakra-colors-surface-border);
}
```

## Integration Points

### Backend Integration

The writing assistant will integrate with the existing inference architecture:

1. **Workflow Definition**: Create `writing_assistant` task kind in `packages/schemas`
2. **Prompt Templates**: Define templates for each AI action (rewrite, expand, etc.)
3. **Context Registry**: Implement source registry to resolve context data
4. **Streaming Support**: Handle token-by-token streaming with logprobs

### Token Streaming Protocol

```typescript
interface StreamingToken {
  token: string
  logprob: number
  topLogprobs: Array<{
    token: string
    logprob: number
    bytes: number[] | null
  }>
}

// Apply tokens as they arrive
editor.chain()
  .insertContent(token.token)
  .addMark('aiGenerated', {
    logprobs: [token],
    topLogprobs: [token.topLogprobs],
    generatedAt: Date.now(),
    modelId: modelProfile.id
  })
  .run()
```

## Testing Strategy

1. **Unit Tests**: Test mark creation, attribute storage, plugin behavior
2. **Integration Tests**: Test editor with mock AI responses
3. **E2E Tests**: Test full flow from action trigger to token application
4. **Performance Tests**: Ensure smooth performance with large documents

## Migration Path

Since this is a new feature, no migration is needed. However, the component should be designed to be easily integrated into existing UI surfaces:

1. Player intent panel text input
2. Character description editor
3. Scenario description editor
4. Template string editor (future)

## Open Questions

1. **Token Boundaries**: How to handle partial word tokens when replacing alternatives?
2. **Undo/Redo**: Should AI generation be a single undo step or token-by-token?
3. **Context Limits**: How much context to send with each AI request?
4. **Logprobs Storage**: Should we persist logprobs in the database or just in memory?

## References

- [Tiptap v3 Documentation](https://tiptap.dev/docs)
- [Creating Custom Marks](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/mark)
- [ProseMirror Plugins](https://tiptap.dev/docs/editor/core-concepts/prosemirror)
- [BubbleMenu Extension](https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu)
- [Floating UI in Tiptap](https://tiptap.dev/docs/ui-components/utils-components/floating-element)