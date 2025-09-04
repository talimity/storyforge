import {
  Card,
  createListCollection,
  Heading,
  HStack,
  Input,
  Separator,
  Stack,
  Textarea,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type GenStep,
  genStepSchema,
  type TaskKind,
  taskKindSchema,
} from "@storyforge/gentasks";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Field,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui";

const taskOptions = [
  { value: "turn_generation", label: "Turn Generation" },
  { value: "chapter_summarization", label: "Chapter Summarization" },
  { value: "writing_assistant", label: "Writing Assistant" },
] as const;

const formSchema = z.object({
  task: taskKindSchema,
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  stepsJson: z.string().min(2, "Steps are required (JSON array)"),
});

type FormValues = z.infer<typeof formSchema>;

export interface WorkflowFormProps {
  initialData?: Partial<FormValues> & { steps?: GenStep[] };
  submitLabel?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (data: {
    task: TaskKind;
    name: string;
    description?: string;
    steps: GenStep[];
  }) => void;
}

export function WorkflowForm({
  initialData,
  submitLabel = "Save",
  isSubmitting,
  onCancel,
  onSubmit,
}: WorkflowFormProps) {
  const collection = createListCollection({ items: taskOptions });
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      task: initialData?.task ?? "turn_generation",
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      stepsJson: initialData?.steps
        ? JSON.stringify(initialData.steps, null, 2)
        : "[]",
    },
  });

  const onFormSubmit = (values: FormValues) => {
    try {
      const steps = z.array(genStepSchema).parse(JSON.parse(values.stepsJson));
      onSubmit({
        task: values.task,
        name: values.name,
        description: values.description,
        steps,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError("stepsJson", {
        type: "custom",
        message: `Invalid steps JSON: ${message}`,
      });
    }
  };

  return (
    <Card.Root layerStyle="surface" maxW="900px" mx="auto">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <Stack gap={6} p={6}>
          <Heading size="md" textStyle="heading">
            Workflow Details
          </Heading>

          <Field
            label="Task"
            required
            invalid={!!errors.task}
            errorText={errors.task?.message}
          >
            <SelectRoot
              collection={collection}
              value={[initialData?.task ?? "turn_generation"]}
              onValueChange={(d) =>
                setValue("task", taskKindSchema.parse(d.value[0]))
              }
            >
              <SelectTrigger>
                <SelectValueText />
              </SelectTrigger>
              <SelectContent>
                {taskOptions.map((opt) => (
                  <SelectItem key={opt.value} item={opt}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          </Field>

          <Field
            label="Name"
            required
            invalid={!!errors.name}
            errorText={errors.name?.message}
          >
            <Input
              {...register("name")}
              placeholder="Workflow name"
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Description">
            <Input
              {...register("description")}
              placeholder="Optional description"
              disabled={isSubmitting}
            />
          </Field>

          <Separator />

          <Field
            label="Steps (JSON array)"
            invalid={!!errors.stepsJson}
            errorText={errors.stepsJson?.message}
          >
            <Textarea
              rows={16}
              fontFamily="mono"
              placeholder='[ { "id": "step1", ... } ]'
              {...register("stepsJson")}
            />
          </Field>

          <HStack gap={3} justify="flex-end">
            <Button
              type="submit"
              colorPalette="primary"
              disabled={isSubmitting}
            >
              {submitLabel}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </HStack>
        </Stack>
      </form>
    </Card.Root>
  );
}
