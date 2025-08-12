/** biome-ignore-all lint/suspicious/noExplicitAny: This is a demo page */
import {
  Box,
  Card,
  Container,
  chakra,
  createListCollection,
  Fieldset,
  Heading,
  HStack,
  Input,
  Separator,
  Stack,
  Tabs,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import {
  LuBook,
  LuLayoutGrid,
  LuLayoutList,
  LuPlus,
  LuUsersRound,
} from "react-icons/lu";
import {
  Button,
  Checkbox,
  Field,
  Radio,
  RadioGroup,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  Switch,
} from "@/components/ui";
import { PageHeader, SimplePageHeader } from "@/components/ui/page-header";

export function ThemeDemoPage() {
  return (
    <Container>
      <SimplePageHeader
        title="Design System Demo"
        tagline="A demonstration of the StoryForge theme's materials, colors, and
        typography."
      />

      <MaterialExample />
      <TypographyExample />
      <CustomHeadingExample />
      <PageHeaderExamples />
      <InlineFormExample />
      <FormExample />
    </Container>
  );
}

// Example: Using the two-material system
function MaterialExample() {
  return (
    <Stack gap={6} p={8}>
      {/* Primary surface material (paper-like in light mode) */}
      <Card.Root layerStyle="surface">
        <Card.Body>
          <Heading size="lg" mb={4}>
            Primary Surface
          </Heading>
          <Text color="content.muted">
            This uses the primary surface material with subtle gradients and
            appropriate text colors.
          </Text>
        </Card.Body>
      </Card.Root>

      {/* Elevated primary surface */}
      <Card.Root layerStyle="surface" _hover={{ layerStyle: "interactive" }}>
        <Card.Body>
          <Heading size="lg" mb={4}>
            Primary Surface, with Interactive
          </Heading>
          <Text color="content.muted" mb={4}>
            This uses the primary surface material, with an layer style that
            applies a lift effect on hover to indicate interactivity.
          </Text>
        </Card.Body>
      </Card.Root>

      {/* Contrast material (leather-like in light mode) */}
      <Card.Root layerStyle="contrast">
        <Card.Body>
          <Heading size="lg" mb={4} color="contentContrast.emphasized">
            Contrast Surface
          </Heading>
          <Text color="contentContrast.muted">
            This uses the contrast material with inverted color relationships.
          </Text>
          <Button mt={4} colorPalette="accent">
            Gold Accent Button
          </Button>
        </Card.Body>
      </Card.Root>
    </Stack>
  );
}

// Example: Using text styles
function TypographyExample() {
  return (
    <Box p={8}>
      {/* Headings will inherit from global CSS */}
      <Heading as="h1" size="2xl">
        This is a Heading component
      </Heading>

      {/* Or you can explicitly use text styles */}
      <Text textStyle="heading" fontSize="3xl" mt={4}>
        3xl Text component with heading style
      </Text>

      {/* Body text with text style */}
      <Text textStyle="body" mt={4}>
        This is body text using the body text style.
      </Text>

      {/* Muted body text */}
      <Text textStyle="body-muted" mt={2}>
        This is muted body text for secondary content.
      </Text>
    </Box>
  );
}

// Alternative: Create custom heading components
export const StoryHeading = chakra("h2", {
  base: {
    fontFamily: "heading",
    color: "content.emphasized",
    fontWeight: "600",
    lineHeight: "1.2",
    mb: 4,
  },
  variants: {
    size: {
      sm: { fontSize: "lg" },
      md: { fontSize: "xl" },
      lg: { fontSize: "2xl" },
      xl: { fontSize: "3xl" },
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

// Usage
function CustomHeadingExample() {
  return (
    <>
      <StoryHeading size="xl">Chapter Title</StoryHeading>
      <StoryHeading size="lg">Section Title</StoryHeading>
      <StoryHeading size="md">Subsection</StoryHeading>
    </>
  );
}

function PageHeaderExamples() {
  return (
    <VStack gap={8} align="stretch">
      <Text mb={4}>Header with tabs only</Text>
      <Box layerStyle="surface" p={6}>
        <PageHeader.Root>
          <PageHeader.Title>Character Management</PageHeader.Title>
          <PageHeader.Tabs
            tabs={[
              {
                value: "characters",
                label: "Characters",
                icon: <LuUsersRound />,
              },
              { value: "scenarios", label: "Scenarios", icon: <LuBook /> },
            ]}
            defaultValue="characters"
            onChange={(value) => console.log("Tab changed:", value)}
          >
            <Tabs.Content value="characters">
              <Box p={4} bg="surface.subtle" borderRadius="md">
                <Text>Character content goes here...</Text>
              </Box>
            </Tabs.Content>
            <Tabs.Content value="scenarios">
              <Box p={4} bg="surface.subtle" borderRadius="md">
                <Text>Scenario content goes here...</Text>
              </Box>
            </Tabs.Content>
          </PageHeader.Tabs>
        </PageHeader.Root>
      </Box>

      <Text mb={4}>Header with views, sorts, and actions, but no tabs</Text>
      <Box layerStyle="surface" p={6}>
        <PageHeader.Root>
          <PageHeader.Title>Campaign Assets</PageHeader.Title>
          <PageHeader.Tagline>
            Manage images, audio, and other media files
          </PageHeader.Tagline>
          <PageHeader.Controls>
            <PageHeader.Sort
              options={[
                { value: "name", label: "Name" },
                { value: "date", label: "Date" },
                { value: "size", label: "Size" },
              ]}
              defaultValue="name"
              onChange={(value) => console.log("Sort changed:", value)}
            />
            <PageHeader.ViewModes
              options={[
                { value: "list", label: <LuLayoutList /> },
                { value: "grid", label: <LuLayoutGrid /> },
              ]}
              defaultValue="grid"
              onChange={(value) => console.log("View mode changed:", value)}
            />
            <Button size="sm">
              <LuPlus /> Upload Asset
            </Button>
          </PageHeader.Controls>
          <Box p={4} bg="surface.subtle" borderRadius="md">
            <Text>Asset grid/list would be rendered here...</Text>
          </Box>
        </PageHeader.Root>
      </Box>

      {/* Header with Tabs and Sorting */}
      <Text mb={4}>Header with tabs and sorting, but no actions</Text>
      <Box layerStyle="surface" p={6}>
        <PageHeader.Root>
          <PageHeader.Title>Asset Library</PageHeader.Title>
          <PageHeader.Tagline>
            Browse and organize your scenario resources
          </PageHeader.Tagline>
          <PageHeader.Tabs
            tabs={[
              { value: "images", label: "Images", badge: "24" },
              { value: "audio", label: "Audio", badge: "12" },
            ]}
            defaultValue="images"
            onChange={(value) => console.log("Tab changed:", value)}
          >
            <PageHeader.Controls>
              <PageHeader.Sort
                options={[
                  { value: "name", label: "Name" },
                  { value: "date", label: "Date" },
                  { value: "size", label: "Size" },
                ]}
                defaultValue="name"
                onChange={(value) => console.log("Sort changed:", value)}
              />
            </PageHeader.Controls>
            <Tabs.Content value="images">
              <Box p={4} bg="surface.subtle" borderRadius="md">
                <Text>Image assets sorted by selection...</Text>
              </Box>
            </Tabs.Content>
            <Tabs.Content value="audio">
              <Box p={4} bg="surface.subtle" borderRadius="md">
                <Text>Audio assets sorted by selection...</Text>
              </Box>
            </Tabs.Content>
          </PageHeader.Tabs>
        </PageHeader.Root>
      </Box>

      {/* Full-featured Header */}
      <Text mb={4}>Header with everything</Text>
      <Box layerStyle="surface" p={6}>
        <PageHeader.Root>
          <PageHeader.Title>Scenario Dashboard</PageHeader.Title>
          <PageHeader.Tagline>
            Overview of your scenario progress and assets
          </PageHeader.Tagline>
          <PageHeader.Tabs
            tabs={[
              { value: "overview", label: "Overview", badge: "5" },
              { value: "assets", label: "Assets" },
              { value: "settings", label: "Settings" },
            ]}
            defaultValue="overview"
            onChange={(value) => console.log("Tab changed:", value)}
          >
            <PageHeader.Controls>
              <PageHeader.Sort
                options={[
                  { value: "name", label: "Name" },
                  { value: "date", label: "Date" },
                  { value: "size", label: "Size" },
                ]}
                defaultValue="name"
                onChange={(value) => console.log("Sort changed:", value)}
              />
              <PageHeader.ViewModes
                options={[
                  { value: "list", label: <LuLayoutList /> },
                  { value: "grid", label: <LuLayoutGrid /> },
                ]}
                defaultValue="grid"
                onChange={(value) => console.log("View mode changed:", value)}
              />
              <Button variant="solid" colorPalette="primary">
                <LuPlus /> New Campaign
              </Button>
            </PageHeader.Controls>
            <Tabs.Content value="overview">
              <Box p={4} bg="surface.subtle" borderRadius="md">
                <Text>Overview content with campaign stats...</Text>
              </Box>
            </Tabs.Content>
            <Tabs.Content value="assets">
              <Box p={4} bg="surface.subtle" borderRadius="md">
                <Text>Asset management content...</Text>
              </Box>
            </Tabs.Content>
            <Tabs.Content value="settings">
              <Box p={4} bg="surface.subtle" borderRadius="md">
                <Text>Settings and configurations...</Text>
              </Box>
            </Tabs.Content>
          </PageHeader.Tabs>
        </PageHeader.Root>
      </Box>
    </VStack>
  );
}

function FormExample() {
  return (
    <Box p={8} bg="surface" minH="100vh">
      <VStack gap={8} maxW="800px" mx="auto">
        {/* Header */}
        <Box textAlign="center">
          <Heading size="2xl" mb={2}>
            Character Creation
          </Heading>
          <Text color="content.muted">
            Create a new character for your story
          </Text>
        </Box>

        {/* Main form card - using surface material */}
        <Card.Root layerStyle="surface" w="full">
          <Card.Body>
            <Stack gap={6}>
              {/* Basic Information Section */}
              <Box>
                <Heading as="h3" size="md" mb={4}>
                  Basic Information
                </Heading>

                <Stack gap={4}>
                  <Field label="Character Name" required>
                    <Input placeholder="Enter character name" />
                  </Field>

                  <Field label="Background Story">
                    <Textarea
                      placeholder="Tell us about your character's past..."
                      rows={4}
                    />
                  </Field>

                  <Field label="Character Class">
                    <SelectRoot
                      collection={createListCollection({
                        items: [
                          [
                            { id: "warrior", name: "Warrior" },
                            { id: "mage", name: "Mage" },
                            { id: "rogue", name: "Rogue" },
                            { id: "cleric", name: "Cleric" },
                          ],
                        ],
                      })}
                    >
                      <SelectTrigger
                        bg="surface.subtle"
                        borderColor="surface.border"
                        _hover={{ borderColor: "content.muted" }}
                      >
                        <SelectValueText placeholder="Choose a class" />
                      </SelectTrigger>
                    </SelectRoot>
                  </Field>
                </Stack>
              </Box>

              <Separator />

              {/* Preferences Section - using contrast material */}
              <Box layerStyle="contrast" p={5} borderRadius="md" mt={2}>
                <Heading
                  as="h3"
                  size="md"
                  mb={4}
                  color="contentContrast.emphasized"
                >
                  Gameplay Preferences
                </Heading>

                <Fieldset.Root size="lg" maxW="md">
                  <Stack>
                    <Fieldset.Legend color="contentContrast.emphasized">
                      Game Mode
                    </Fieldset.Legend>
                    <Fieldset.HelperText color="contentContrast.muted">
                      Choose your preferred game mode
                    </Fieldset.HelperText>
                  </Stack>
                  <Fieldset.Content>
                    <Field
                      label="Difficulty Level"
                      color="contentContrast"
                      helperText="Affects enemy strength and resource availability"
                      errorText="This is a required field"
                      invalid
                      orientation="vertical"
                    >
                      <RadioGroup defaultValue="normal" colorPalette="accent">
                        <HStack gap={4}>
                          <Radio value="easy" color={"contentContrast"}>
                            Easy
                          </Radio>
                          <Radio value="normal" color={"contentContrast"}>
                            Normal
                          </Radio>
                          <Radio value="hard" color={"contentContrast"}>
                            Hard
                          </Radio>
                        </HStack>
                      </RadioGroup>
                    </Field>

                    <Field label="Random Events" color="contentContrast">
                      <Switch colorPalette="accent" defaultChecked>
                        Enable Random Events
                      </Switch>
                    </Field>

                    <Checkbox colorPalette="accent" defaultChecked>
                      <Text color="contentContrast.muted">
                        Receive campaign notifications
                      </Text>
                    </Checkbox>
                  </Fieldset.Content>
                </Fieldset.Root>
              </Box>

              <Separator />

              {/* Button Examples Section */}
              <Box>
                <Heading as="h3" size="md" mb={4}>
                  Button Variants & Color Palettes
                </Heading>

                {/* Neutral buttons */}
                <Text fontSize="sm" color="content.muted" mb={2}>
                  Neutral palette, with variants
                </Text>
                <HStack gap={3} mb={4} flexWrap="wrap">
                  <Button variant="solid">Button</Button>
                  <Button variant="outline">Outline Button</Button>
                  <Button variant="ghost">Ghost Button</Button>
                </HStack>

                {/* Primary buttons */}
                <Text fontSize="sm" color="content.muted" mb={2}>
                  Primary palette, with variants
                </Text>
                <HStack gap={3} mb={4} flexWrap="wrap">
                  <Button colorPalette="primary" variant="solid">
                    Button
                  </Button>
                  <Button colorPalette="primary" variant="outline">
                    Outline Button
                  </Button>
                  <Button colorPalette="primary" variant="ghost">
                    Ghost Button
                  </Button>
                </HStack>

                {/* Secondary buttons */}
                <Text fontSize="sm" color="content.muted" mb={2}>
                  Secondary palette, with variants
                </Text>
                <HStack gap={3} mb={4} flexWrap="wrap">
                  <Button colorPalette="secondary" variant="solid">
                    Button
                  </Button>
                  <Button colorPalette="secondary" variant="outline">
                    Outline Button
                  </Button>
                  <Button colorPalette="secondary" variant="ghost">
                    Ghost Button
                  </Button>
                </HStack>

                {/* Accent buttons */}
                <Text fontSize="sm" color="content.muted" mb={2}>
                  Accent palette, with variants
                </Text>
                <HStack gap={3} mb={4} flexWrap="wrap">
                  <Button colorPalette="accent" variant="solid">
                    Button
                  </Button>
                  <Button colorPalette="accent" variant="outline">
                    Outline Button
                  </Button>
                  <Button colorPalette="accent" variant="ghost">
                    Ghost Button
                  </Button>
                </HStack>

                {/* Semantic actions */}
                <Text fontSize="sm" color="content.muted" mb={2}>
                  Semantic actions (success, danger, info)
                </Text>
                <HStack gap={3} mb={4} flexWrap="wrap">
                  <Button colorPalette="green" variant="solid">
                    Confirm
                  </Button>
                  <Button colorPalette="red" variant="solid">
                    Delete
                  </Button>
                  <Button colorPalette="blue" variant="solid">
                    More Info
                  </Button>
                </HStack>
              </Box>
            </Stack>
          </Card.Body>
        </Card.Root>

        {/* Form actions - fixed at bottom */}
        <Card.Root layerStyle="surface" w="full">
          <Card.Body>
            <HStack justify="space-between">
              <Button variant="ghost" colorPalette="neutral">
                Back to Library
              </Button>
              <HStack gap={3}>
                <Button variant="outline" colorPalette="neutral">
                  Save as Draft
                </Button>
                <Button colorPalette="primary" variant="solid">
                  Create Character
                </Button>
              </HStack>
            </HStack>
          </Card.Body>
        </Card.Root>
      </VStack>
    </Box>
  );
}

// Example: Inline form for quick actions
export function InlineFormExample() {
  return (
    <Box layerStyle="contrast" p={6} mx={12} my={4} borderRadius="md">
      <Heading size="sm" mb={3} color="contentContrast.emphasized">
        Quick Action
      </Heading>
      <HStack gap={3}>
        <Input variant="onContrast" placeholder="Enter command..." flex={1} />
        <Button colorPalette="accent" variant="solid" size="md">
          Execute
        </Button>
        <Button colorPalette="accent" variant="solid">
          Button
        </Button>
      </HStack>
    </Box>
  );
}
