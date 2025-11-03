import {
  ColorPicker,
  ColorPickerChannelSlider,
  HStack,
  IconButton,
  Portal,
  parseColor,
  Skeleton,
  Stack,
  useColorPicker,
} from "@chakra-ui/react";
import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LuCheck, LuX } from "react-icons/lu";
import { withFieldGroup } from "@/lib/form/app-form";
import { useTRPC } from "@/lib/trpc";

const DEFAULT_SWATCHES = [
  "#3B322B",
  "#4A5568",
  "#F56565",
  "#ED64A6",
  "#9F7AEA",
  "#6B46C1",
  "#4299E1",
  "#0BC5EA",
  "#00B5D8",
  "#38B2AC",
  "#48BB78",
  "#68D391",
  "#ECC94B",
  "#DD6B20",
];

type CharacterPaletteEditorProps = {
  characterId?: string;
  allowReset?: boolean;
  label?: string;
  helperText?: string;
};

export const CharacterPaletteEditor = withFieldGroup({
  props: {
    characterId: "",
    allowReset: false,
    label: "Color Palette",
    helperText: "",
  } as CharacterPaletteEditorProps,
  defaultValues: {
    selectedColor: "" as string | null | undefined,
  },
  render: function Render({ group, characterId, allowReset, label, helperText }) {
    const trpc = useTRPC();
    const [opened, setOpened] = useState(false);

    const paletteQuery = trpc.characters.colorPalette.queryOptions(
      { id: characterId || "" },
      { enabled: !!characterId && (opened || allowReset) }
    );
    const colorData = useQuery(paletteQuery);
    const swatches = colorData?.data ? [...colorData.data.palette] : DEFAULT_SWATCHES;
    const defaultColor = colorData?.data?.current;

    const current = useStore(group.store, (s) => s.values.selectedColor);
    const changed = current && current !== defaultColor;

    const colorPicker = useColorPicker({
      onOpenChange: () => setOpened(true),
      defaultValue: parseColor(current || defaultColor || DEFAULT_SWATCHES[0]),
      onValueChangeEnd: (details) => {
        group.setFieldValue(
          "selectedColor",
          details.value.toString("hex").toLowerCase().slice(0, 7)
        );
      },
    });

    // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to run this when query completes
    useEffect(() => {
      if (!defaultColor || current) {
        return;
      }
      colorPicker.setValue(parseColor(defaultColor));
    }, [defaultColor]);

    return (
      <HStack align="start" gap={6} css={{ "--input-color": current || defaultColor }}>
        <group.AppField name="selectedColor">
          {(field) => {
            return (
              <field.Field label={label} helperText={helperText}>
                <Stack gap={2}>
                  <HStack gap={2} align="flex-end">
                    <ColorPicker.RootProvider
                      key={characterId || "new-character"}
                      value={colorPicker}
                    >
                      <ColorPicker.HiddenInput />
                      {colorData.isEnabled && colorData.isPending && allowReset ? (
                        <HStack>
                          <Skeleton h="10" width="40" rounded="md" />
                          <Skeleton boxSize="10" rounded="md" />
                        </HStack>
                      ) : (
                        <ColorPicker.Control width="full">
                          <ColorPicker.Input flexBasis="8rem" />
                          <ColorPicker.Trigger />
                          {allowReset && changed ? (
                            <IconButton
                              variant="outline"
                              onClick={() => {
                                colorPicker.setValue(defaultColor || DEFAULT_SWATCHES[0]);
                                field.handleChange(null);
                              }}
                            >
                              <LuX />
                            </IconButton>
                          ) : null}
                        </ColorPicker.Control>
                      )}
                      <Portal>
                        <ColorPicker.Positioner>
                          <ColorPicker.Content>
                            <ColorPicker.Area />
                            <HStack>
                              <ColorPicker.EyeDropper size="xs" variant="outline" />
                              <ColorPickerChannelSlider channel="hue" />
                            </HStack>
                            <ColorPicker.SwatchGroup>
                              {colorData.isEnabled && colorData.isPending ? (
                                <>
                                  <Skeleton boxSize="5" rounded="md" />
                                  <Skeleton boxSize="5" rounded="md" />
                                  <Skeleton boxSize="5" rounded="md" />
                                  <Skeleton boxSize="5" rounded="md" />
                                  <Skeleton boxSize="5" rounded="md" />
                                </>
                              ) : (
                                swatches.map((item) => (
                                  <ColorPicker.SwatchTrigger key={item} value={item}>
                                    <ColorPicker.Swatch
                                      boxSize="5"
                                      value={item}
                                      // bug of some sort causes swatches to not trigger onValueChangeEnd
                                      // so we must manually handle the onClick event
                                      onClick={() => {
                                        setTimeout(() => {
                                          colorPicker.setValue(parseColor(item));
                                          field.handleChange(item);
                                        }, 0);
                                      }}
                                    >
                                      <ColorPicker.SwatchIndicator color="white">
                                        <LuCheck />
                                      </ColorPicker.SwatchIndicator>
                                    </ColorPicker.Swatch>
                                  </ColorPicker.SwatchTrigger>
                                ))
                              )}
                            </ColorPicker.SwatchGroup>
                          </ColorPicker.Content>
                        </ColorPicker.Positioner>
                      </Portal>
                    </ColorPicker.RootProvider>
                  </HStack>
                </Stack>
              </field.Field>
            );
          }}
        </group.AppField>
      </HStack>
    );
  },
});
