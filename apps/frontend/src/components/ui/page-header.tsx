import {
  Badge,
  Box,
  type Container,
  Flex,
  Heading,
  type HeadingProps,
  HStack,
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
  createContext,
  isValidElement,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface PageHeaderRegistrationData {
  title: string;
  tagline?: string;
}

interface PageHeaderContextValue {
  register: (id: symbol, data: PageHeaderRegistrationData) => void;
  unregister: (id: symbol) => void;
  current: PageHeaderRegistrationData | null;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: PropsWithChildren) {
  const [registry, setRegistry] = useState<Map<symbol, PageHeaderRegistrationData>>(new Map());

  const register = useCallback((id: symbol, data: PageHeaderRegistrationData) => {
    setRegistry((previous) => {
      const current = previous.get(id);
      if (current && current.title === data.title && current.tagline === data.tagline) {
        return previous;
      }
      const next = new Map(previous);
      next.set(id, data);
      return next;
    });
  }, []);

  const unregister = useCallback((id: symbol) => {
    setRegistry((previous) => {
      if (!previous.has(id)) {
        return previous;
      }
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const current = useMemo(() => {
    let active: PageHeaderRegistrationData | null = null;
    registry.forEach((value) => {
      active = value;
    });
    return active;
  }, [registry]);

  const value = useMemo<PageHeaderContextValue>(
    () => ({
      register,
      unregister,
      current,
    }),
    [current, register, unregister]
  );

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function useCurrentPageHeader() {
  const context = useContext(PageHeaderContext);
  return context?.current;
}

function usePageHeaderRegistration() {
  return useContext(PageHeaderContext);
}

function extractTextFromNode(node: ReactNode): string | undefined {
  if (node === null || node === undefined || typeof node === "boolean") {
    return undefined;
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    const combined = node
      .map((child) => extractTextFromNode(child))
      .filter((value): value is string => value !== undefined)
      .join("");
    return combined.length > 0 ? combined : undefined;
  }

  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    return extractTextFromNode(element.props.children);
  }

  return undefined;
}

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

  const registerContext = usePageHeaderRegistration();
  const registrationIdRef = useRef<symbol | null>(null);

  const titleText = extractTextFromNode(title?.props.children);
  const taglineText = extractTextFromNode(tagline?.props.children);

  const register = registerContext?.register;
  const unregister = registerContext?.unregister;

  useEffect(() => {
    if (!register || !unregister) {
      return;
    }

    if (!registrationIdRef.current) {
      registrationIdRef.current = Symbol("page-header");
    }

    const id = registrationIdRef.current;
    if (!id) {
      return;
    }

    if (titleText && titleText.trim().length > 0) {
      register(id, {
        title: titleText,
        tagline: taglineText?.trim().length ? taglineText : undefined,
      });
    } else {
      unregister(id);
    }

    return () => {
      unregister(id);
    };
  }, [register, unregister, taglineText, titleText]);

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
        <Flex wrap="wrap" align="center" gap={4} mb={4}>
          {/* Group title and tagline together */}
          <Box flex="1 1 auto" minW="0">
            {titleWithAdjustedSpacing}
            {tagline}
          </Box>
          {/* Controls wrap when needed - no top padding when wrapped */}
          <Box flex="1" h="100%">
            {controls}
          </Box>
        </Flex>
        {otherChildren}
      </Box>
    );
  }
  // Standard layout without controls
  return (
    <Box {...containerProps} mb={{ base: 0, md: 4, lg: 8 }} data-testid="page-header">
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
    <Heading display={{ base: "none", md: "block" }} size={size} py={py} {...props}>
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

// Controls wrapper component
interface PageHeaderControlsProps extends StackProps {
  children: ReactNode;
}

function PageHeaderControls({ children, ...props }: PageHeaderControlsProps) {
  const { justify = "flex-end", ...rest } = props;

  return (
    <HStack
      gap={4}
      flexShrink={0}
      flexWrap="wrap"
      justify={justify}
      {...rest}
      data-testid="page-header-controls"
    >
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
  <PageHeader.Root>
    <PageHeader.Title>{title}</PageHeader.Title>
    {tagline && <PageHeader.Tagline>{tagline}</PageHeader.Tagline>}
    {actions && <PageHeader.Controls>{actions}</PageHeader.Controls>}
    {children}
  </PageHeader.Root>
);
