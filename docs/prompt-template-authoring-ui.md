## Core Architecture: Recipe-Driven Slot System

### 1. **Slot Recipe Library**

Each task type has a curated set of slot recipes. These are **not** generic AST builders, but purpose-built React components that understand their specific use case:

```typescript
export interface RecipeDefinition {
  id: SlotRecipeId;
  name: string;
  task: TaskKind;
  description?: string;
  parameters: RecipeParamSpec[];
  /**
   * Transform the user's parameter values into a complete SlotSpec
   * that can be used by the prompt renderer engine
   */
  toSlotSpec(params: Record<string, unknown>): SlotSpec;
  /**
   * Optional: Available variables that can be used in template_string parameters
   * These will be shown as hints in the UI
   */
  availableVariables?: Array<{
    name: string;
    description: string;
    example?: string;
  }>;
}

export interface RecipeParamSpec {
  key: string;
  label: string;
  type: "number" | "select" | "toggle" | "template_string";
  defaultValue?: unknown;
  help?: string;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string | number | boolean }>;
}
```

### 2. **Pre-Built Recipes for turn_generation**

```typescript
const TURN_GEN_RECIPES = {
  timeline: {
    id: 'timeline',
    name: 'Timeline',
    task: "turn_generation",
    description: 'Recent turns with optional intent annotations',
    parameters: [
      { key: 'maxTurns', type: 'number', label: 'Max Turns', defaultValue: 8, min: 1, max: 20 },
      { key: 'order', type: 'select', label: 'Order', defaultValue: 'desc',
        options: [{label: 'Newest First', value: 'desc'}, {label: 'Oldest First', value: 'asc'}] },
      { key: 'includeLayers', type: 'toggle', label: 'Include Planning Layers', defaultValue: false },
      { key: 'includeIntents', type: 'toggle', label: 'Show Player Intents', defaultValue: true },
      { key: 'turnTemplate', type: 'template_string', label: 'Turn Format',
        defaultValue: '[{{item.turnNo}}] {{item.authorName}}: {{item.content}}' },
      { key: 'intentTemplate', type: 'template_string', label: 'Intent Format',  
        defaultValue: '(Player Intent: {{ctx.currentIntent}})' },
      { key: 'budget', type: 'token_budget', label: 'Token Budget', defaultValue: 900 }
    ],
    availableVariables: [
      {
        name: "item.turnNo",
        description: "The turn number in the scenario",
        example: "5",
      },
      {
        name: "item.authorName",
        description: "Name of the character or narrator who created this turn",
        example: "Alice",
      },
      {
        name: "item.authorType",
        description: "Type of author (character or narrator)",
        example: "character",
      },
      {
        name: "item.content",
        description: "The text content of the turn",
        example: "She walked through the forest, listening to the birds.",
      },
    ],
    toSlotSpec: (params) => {
      // This generates the complex forEach with nested if/else for timeline entries
      // but users never see this complexity
      return {
        priority: params.priority ?? 0,
        budget: { maxTokens: params.budget },
        plan: [/* Complex DSL here */]
      };
    }
  },
  
  characters: {
    id: 'characters',
    name: 'Character Roster',
    description: 'Character descriptions with optional examples',
    parameters: [
      { key: 'includeExamples', type: 'toggle', label: 'Include Writing Examples', defaultValue: false },
      { key: 'maxCharacters', type: 'number', label: 'Max Characters', defaultValue: 6 },
      { key: 'format', type: 'select', label: 'Format',
        options: [
          {label: 'Prose', value: 'prose'},
          {label: 'Markdown List', value: 'markdown'},
          {label: 'XML Tags', value: 'xml'}
        ]},
      { key: 'budget', type: 'token_budget', label: 'Token Budget', defaultValue: 600 }
    ]
  },
  
  summaries: {
    id: 'summaries',
    name: 'Chapter Summaries',
    description: 'Previous chapter summaries for context',
    parameters: [
      { key: 'maxChapters', type: 'number', label: 'Max Chapters', defaultValue: 3 },
      { key: 'budget', type: 'token_budget', label: 'Token Budget', defaultValue: 500 }
    ]
  },
  
  intent: {
    id: 'intent',
    name: 'Current Intent',
    description: 'Player\'s current intent/constraint',
    parameters: [
      { key: 'showConstraint', type: 'toggle', label: 'Include Constraint', defaultValue: true }
    ]
  },
  
  custom_message: {
    id: 'custom_message',
    name: 'Custom Message',
    description: 'Add a custom message',
    parameters: [
      { key: 'role', type: 'select', label: 'Role',
        options: [{label: 'System', value: 'system'}, {label: 'User', value: 'user'}]},
      { key: 'content', type: 'template_string', label: 'Content', defaultValue: '' }
    ]
  }
};
```

### 3. **Template Builder UI**

The main editor would have three panels:

```tsx
function TemplateEditor({ templateId }: { templateId?: string }) {
  const [template, setTemplate] = useState<TemplateDraft>(defaultTemplate);
  
  return (
    <Stack spacing={4}>
      {/* Template Metadata */}
      <TemplateMetadataSection />
      
      <LayoutBuilder
        layout={template.layout}
        slots={template.slots}
        onLayoutChange={handleLayoutChange}
        onSlotAdd={handleSlotAdd}
      />
      
      <Box>
        {selectedNode ? (
          <NodeConfigurator
            node={selectedNode}
            onChange={handleNodeChange}
          />
        ) : (
          <EmptyState>Select a slot or message to configure</EmptyState>
        )}
      </Box>
      
      <TemplatePreview
        template={template}
        sampleData={getSampleData(template.task)}
      />
    </Stack>
  );
}
```

### 4. **Layout Builder Component**

```tsx
function LayoutBuilder({ layout, slots, onLayoutChange, onSlotAdd }) {
  return (
    <VStack spacing={2} align="stretch">
      <Heading size="md">Template Structure</Heading>
      
      {/* Draggable list of layout nodes */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="layout">
          {(provided) => (
            <VStack {...provided.droppableProps} ref={provided.innerRef}>
              {layout.map((node, index) => (
                <Draggable key={node.id} draggableId={node.id} index={index}>
                  {(provided) => (
                    <LayoutNodeCard
                      node={node}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </VStack>
          )}
        </Droppable>
      </DragDropContext>
      
      {/* Add new elements */}
      <Menu>
        <MenuButton as={Button} leftIcon={<Plus />}>
          Add Element
        </MenuButton>
        <MenuList>
          <MenuItem onClick={() => onAddMessage()}>Message Block</MenuItem>
          <MenuItem onClick={() => onAddSlot()}>Slot Reference</MenuItem>
          <MenuItem onClick={() => onAddSeparator()}>Separator</MenuItem>
        </MenuList>
      </Menu>
      
      {/* Slot Library */}
      <Divider my={4} />
      <Heading size="sm">Available Slots</Heading>
      <SimpleGrid columns={2} spacing={2}>
        {Object.values(RECIPES[template.task]).map(recipe => (
          <Button
            key={recipe.id}
            size="sm"
            variant="outline"
            onClick={() => onSlotAdd(recipe)}
            isDisabled={slots[recipe.id] !== undefined}
          >
            {recipe.name}
            {slots[recipe.id] && <CheckIcon ml={2} />}
          </Button>
        ))}
      </SimpleGrid>
    </VStack>
  );
}
```

### 5. **Slot Configuration**

When a slot is selected:

```tsx
function SlotConfigurator({ slot, recipe, onChange }) {
  const [params, setParams] = useState(slot.params);
  
  return (
    <VStack spacing={4} align="stretch">
      <Heading size="md">{recipe.name}</Heading>
      <Text color="gray.600">{recipe.description}</Text>
      
      {/* Priority (all slots have this) */}
      <Field label="Priority" help="Lower numbers fill first">
        <NumberInput
          value={slot.priority}
          onChange={(val) => onChange({ ...slot, priority: val })}
          min={0}
          max={10}
        />
      </Field>
      
      {/* Recipe-specific parameters */}
      {recipe.parameters.map(param => (
        <RecipeParameterField
          recipe={recipe}
          key={param.key}
          param={param}
          value={params[param.key]}
          onChange={(val) => setParams({ ...params, [param.key]: val })}
        />
      ))}
      
      {/* Headers/Footers (optional) */}
      <Accordion allowToggle>
        <AccordionItem>
          <AccordionButton>Headers & Footers</AccordionButton>
          <AccordionPanel>
            <VStack spacing={2}>
              <Field label="Header">
                <Input placeholder="e.g., 'Recent scene:'" />
              </Field>
              <Field label="Footer">
                <Input placeholder="e.g., '---'" />
              </Field>
            </VStack>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
      
      {/* Escape hatch: View generated DSL */}
      <Accordion allowToggle>
        <AccordionItem>
          <AccordionButton>Advanced: View DSL</AccordionButton>
          <AccordionPanel>
            <Code>{JSON.stringify(recipe.generateSlot(params), null, 2)}</Code>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </VStack>
  );
}
```

NOTE: A simpler version of the above component can be used to configure Message and Separator layout nodes, but the idea is the same; click something in Layout panel to modify its properties.

### 6. Recipe Parameter Field

Each slot recipe gets a simple form based on its parameters:

```tsx
function RecipeParameterField({ recipe, key, param, value, onChange }) {
  return (
    <Field key={param.key} label={param.label} help={param.help}>
      {param.type === 'number' && (
        <NumberInput 
          value={value ?? param.defaultValue}
          onChange={(val) => onChange(param.key, val)}
          min={param.min}
          max={param.max}
        />
      )}
      {param.type === 'select' && (
        <Select
          value={value ?? param.defaultValue}
          onChange={(val) => onChange(param.key, val)}
        >
          {param.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      )}
      {param.type === 'template_string' && (
        <TemplateStringEditor
          value={value ?? param.defaultValue}
          onChange={(val) => onChange(param.key, val)}
          availableVariables={getVariablesForRecipe(recipe)} // uses registry
        />
      )}
      {/* ... other param types */}
    </Field>
  );
}
```

### 7. **Template String Editor**

For parameters of type `template_string`:

```tsx
function TemplateStringEditor({ value, onChange, availableVars }) {
  const [showVars, setShowVars] = useState(false);
  
  return (
    <VStack align="stretch">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        fontFamily="mono"
        placeholder="Use {{variable}} for interpolation"
      />
      <HStack>
        <Button size="xs" onClick={() => setShowVars(!showVars)}>
          {showVars ? 'Hide' : 'Show'} Variables
        </Button>
      </HStack>
      {showVars && (
        <Box bg="gray.50" p={2} borderRadius="md">
          <Text fontSize="xs" fontFamily="mono">
            Available: {availableVars.join(', ')}
          </Text>
        </Box>
      )}
    </VStack>
  );
}
```

### 7. **Escape Hatches**

1. **"Custom Slot" Recipe**: A special recipe that just exposes a JSON editor
2. **"Import from JSON"**: Can paste a full template JSON
3. **"Export to JSON"**: Can export the current template for version control
4. **"Eject from Recipe"**: Converts a recipe to custom JSON (one-way)
