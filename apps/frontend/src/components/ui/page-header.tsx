import {
  Badge,
  Box,
  type Container,
  createListCollection,
  Flex,
  Heading,
  type HeadingProps,
  HStack,
  SegmentGroup,
  Spacer,
  type StackProps,
  Tabs,
  type TabsRootProps,
  Text,
  type TextProps,
} from "@chakra-ui/react";
import {
  Children,
  cloneElement,
  isValidElement,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
} from "react";
import { LuArrowUpDown } from "react-icons/lu";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";

// Root component that manages layout
interface PageHeaderRootProps extends PropsWithChildren {
  containerProps?: {
    maxW?: string;
    py?: React.ComponentProps<typeof Container>["py"];
  };
}

function PageHeaderRoot({ children, containerProps }: PageHeaderRootProps) {
  const childArray = Children.toArray(children).filter((child) => isValidElement(child));

  // Find key components
  const title = childArray.find((child) => child.type === PageHeaderTitle) as
    | ReactElement<PageHeaderTitleProps>
    | undefined;

  const tagline = childArray.find((child) => child.type === PageHeaderTagline) as
    | ReactElement<PageHeaderTaglineProps>
    | undefined;

  const controls = childArray.find((child) => child.type === PageHeaderControls) as
    | ReactElement<PageHeaderControlsProps>
    | undefined;

  const tabs = childArray.find((child) => child.type === PageHeaderTabs) as
    | ReactElement<PageHeaderTabsProps>
    | undefined;

  const otherChildren = childArray.filter(
    (child) =>
      !(
        isValidElement(child) &&
        (child.type === PageHeaderTitle ||
          child.type === PageHeaderTagline ||
          child.type === PageHeaderControls ||
          child.type === PageHeaderTabs)
      )
  );

  useEffect(() => {
    if (title) {
      document.title = `${title.props.children} - StoryForge`;
    } else {
      document.title = "StoryForge";
    }
  }, [title]);

  // If we have tabs, render standard layout (tabs will handle controls internally)
  if (tabs) {
    return (
      <Box {...containerProps} data-testid="page-header">
        {title}
        {tagline}
        {tabs}
        {otherChildren}
      </Box>
    );
  }

  // If we have controls but no tabs, create optimized layout with wrapping
  if (controls && title) {
    // Clone title without bottom margin when we have a tagline
    const titleWithAdjustedSpacing = tagline
      ? cloneElement(title, { ...title.props, mb: 0 })
      : title;

    return (
      <Box {...containerProps} data-testid="page-header">
        <Flex wrap="wrap" align="flex-start" gap={4} mb={4}>
          {/* Group title and tagline together */}
          <Box flex="1 1 auto" minW="0">
            {titleWithAdjustedSpacing}
            {tagline}
          </Box>
          {/* Controls wrap when needed - no top padding when wrapped */}
          <Box
            flex="0 0 auto"
            pt={{ base: 0, md: title.props.py || "6" }}
            alignSelf={{ base: "stretch", md: "start" }}
            w={{ base: "full", md: "auto" }}
          >
            {controls}
          </Box>
        </Flex>
        {otherChildren}
      </Box>
    );
  }
  // Standard layout without controls
  return (
    <Box {...containerProps} mb={8} data-testid="page-header">
      {children}
    </Box>
  );
}

// Title component
interface PageHeaderTitleProps extends HeadingProps {
  children: ReactNode;
}

function PageHeaderTitle({ children, size = "3xl", py = "6", ...props }: PageHeaderTitleProps) {
  return (
    <Heading size={size} py={py} {...props}>
      {children}
    </Heading>
  );
}

// Tagline component
interface PageHeaderTaglineProps extends TextProps {
  children: ReactNode;
}

function PageHeaderTagline({ children, ...props }: PageHeaderTaglineProps) {
  return (
    <Text color="content.muted" mb={4} {...props}>
      {children}
    </Text>
  );
}

// Sort selector component
interface SortOption {
  value: string;
  label: string;
}

interface PageHeaderSortProps {
  options: SortOption[];
  value?: string;
  onChange?: (value: string) => void;
  label?: ReactNode;
}

function PageHeaderSort({
  options,
  value,
  onChange,
  label = <LuArrowUpDown />,
}: PageHeaderSortProps) {
  const collection = useMemo(() => createListCollection({ items: options }), [options]);
  const currentValue = value ?? options[0]?.value ?? "";
  const isDisabled = options.length === 0;

  return (
    <HStack>
      <Text fontWeight="medium" fontSize="sm">
        {label}
      </Text>
      <SelectRoot
        width="40"
        collection={collection}
        value={currentValue ? [currentValue] : []}
        onValueChange={(details) => {
          const nextValue = details.value[0];
          if (!nextValue) return;
          onChange?.(nextValue);
        }}
        disabled={isDisabled}
      >
        <SelectTrigger>
          <SelectValueText placeholder="Select sort" />
        </SelectTrigger>
        <SelectContent portalled>
          {options.map((option) => (
            <SelectItem key={option.value} item={option}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </HStack>
  );
}

// View mode selector component
interface ViewModeOption {
  value: string;
  label: ReactNode;
}

interface PageHeaderViewModesProps {
  options: ViewModeOption[];
  value?: string;
  onChange?: (value: string) => void;
}

function PageHeaderViewModes({ options, value, onChange }: PageHeaderViewModesProps) {
  if (options.length === 0) {
    return null;
  }
  const fallbackValue = value ?? options[0]?.value ?? "";

  return (
    <SegmentGroup.Root
      value={fallbackValue}
      onValueChange={
        onChange
          ? (details) => {
              const nextValue = details.value;
              if (nextValue) {
                onChange(nextValue);
              }
            }
          : undefined
      }
    >
      <SegmentGroup.Indicator />
      <SegmentGroup.Items items={options} />
    </SegmentGroup.Root>
  );
}

// Controls wrapper component
interface PageHeaderControlsProps extends StackProps {
  children: ReactNode;
}

function PageHeaderControls({ children, ...props }: PageHeaderControlsProps) {
  return (
    <HStack gap={4} flexShrink={0} {...props}>
      {children}
    </HStack>
  );
}

// Tabs wrapper component
interface TabConfig {
  value: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  badgeColorPalette?: React.ComponentProps<typeof Badge>["colorPalette"];
}

interface PageHeaderTabsProps extends Pick<TabsRootProps, "lazyMount" | "unmountOnExit"> {
  tabs: TabConfig[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  children?: ReactNode;
}

function PageHeaderTabs({ tabs, defaultValue, onChange, children, ...rest }: PageHeaderTabsProps) {
  // Extract any Controls from children to place them in the tab list
  const childArray = Children.toArray(children);
  const controls = childArray.find(
    (child) => isValidElement(child) && child.type === PageHeaderControls
  ) as ReactElement<PageHeaderControlsProps> | undefined;

  const tabContents = childArray.filter(
    (child) => isValidElement(child) && child.type === Tabs.Content
  );

  return (
    <Tabs.Root
      size="lg"
      defaultValue={defaultValue || tabs[0]?.value}
      onValueChange={onChange ? (details) => details.value && onChange(details.value) : undefined}
      {...rest}
    >
      <Tabs.List>
        {tabs.map((tab) => (
          <Tabs.Trigger key={tab.value} value={tab.value}>
            {tab.icon}
            {tab.label}
            {tab.badge && (
              <Badge colorPalette={tab.badgeColorPalette || "gray"} size="xs">
                {tab.badge}
              </Badge>
            )}
          </Tabs.Trigger>
        ))}
        {controls && (
          <>
            <Spacer />
            <HStack pos="relative" bottom="2" gap="4">
              {controls.props.children}
            </HStack>
          </>
        )}
      </Tabs.List>
      {tabContents}
    </Tabs.Root>
  );
}

export const PageHeader = {
  Root: PageHeaderRoot,
  Title: PageHeaderTitle,
  Tagline: PageHeaderTagline,
  Controls: PageHeaderControls,
  Sort: PageHeaderSort,
  ViewModes: PageHeaderViewModes,
  Tabs: PageHeaderTabs,
};

export const SimplePageHeader = ({
  title,
  tagline,
  actions,
  children,
}: PropsWithChildren<{
  title: PageHeaderTitleProps["children"];
  tagline?: PageHeaderTaglineProps["children"];
  actions?: ReactNode;
}>) => (
  <>
    <PageHeader.Root>
      <PageHeader.Title>{title}</PageHeader.Title>
      {tagline && <PageHeader.Tagline>{tagline}</PageHeader.Tagline>}
      {actions && <PageHeader.Controls>{actions}</PageHeader.Controls>}
      {children}
    </PageHeader.Root>
  </>
);
