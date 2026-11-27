import { createComponentImplementation } from "@a2ui/react"
import {
  ActionSchema,
  Catalog,
  ChildListSchema,
  DynamicBooleanSchema,
  DynamicStringSchema,
} from "@a2ui/web_core/v1_0"
import { useId } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Divider } from "@/components/ui/divider"
import { Heading, HeadingTitle } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import {
  DaTable,
  DaDescriptionList,
  DaSelect,
} from "@/lib/a2ui/data-components"

import { contentComponents } from "./content-components"
import { dateComponents } from "./date-components"
import { formComponents } from "./form-components"
import { containerComponents } from "./container-components"
import { navigationComponents } from "./navigation-components"

export const DIGITAL_AGENCY_CATALOG_ID =
  "https://github.com/videoq-jp/shadcn-digital-agency-jp/catalogs/a2ui/v1"

const Column = createComponentImplementation(
  { name: "Column", schema: z.object({ children: ChildListSchema }) },
  ({ props, buildChild }) => (
    <div className="@container grid min-w-0 gap-6">
      {props.children.map((child) => (
        <div
          key={typeof child === "string" ? child : child.id}
          className="min-w-0"
        >
          {typeof child === "string"
            ? buildChild(child)
            : buildChild(child.id, child.basePath)}
        </div>
      ))}
    </div>
  )
)

const Text = createComponentImplementation(
  { name: "Text", schema: z.object({ text: DynamicStringSchema }) },
  ({ props }) => (
    <p className="whitespace-pre-wrap break-words text-std-16N-170">
      {props.text}
    </p>
  )
)

const DaHeading = createComponentImplementation(
  {
    name: "Heading",
    schema: z.object({
      text: DynamicStringSchema,
      level: z.enum(["h2", "h3", "h4", "h5", "h6"]).default("h2"),
    }),
  },
  ({ props }) => (
    <Heading size="24" hasChip>
      <HeadingTitle level={props.level ?? "h2"}>{props.text}</HeadingTitle>
    </Heading>
  )
)

const fieldSchema = z.object({
  label: DynamicStringSchema,
  value: DynamicStringSchema,
  required: z.boolean().optional(),
  disabled: DynamicBooleanSchema.optional(),
})

const DaInput = createComponentImplementation(
  { name: "Input", schema: fieldSchema },
  ({ props, accessibilityRef }) => {
    const id = useId()
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>
          {props.label}
          {props.required ? "（必須）" : ""}
        </Label>
        <Input
          className="w-full"
          ref={accessibilityRef}
          id={id}
          value={props.value ?? ""}
          required={props.required}
          disabled={props.disabled}
          onChange={(event) => props.setValue(event.target.value)}
        />
      </div>
    )
  }
)

const DaTextarea = createComponentImplementation(
  { name: "Textarea", schema: fieldSchema },
  ({ props, accessibilityRef }) => {
    const id = useId()
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>
          {props.label}
          {props.required ? "（必須）" : ""}
        </Label>
        <Textarea
          className="w-full"
          ref={accessibilityRef}
          id={id}
          value={props.value ?? ""}
          required={props.required}
          disabled={props.disabled}
          onChange={(event) => props.setValue(event.target.value)}
        />
      </div>
    )
  }
)

const DaCheckbox = createComponentImplementation(
  {
    name: "Checkbox",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicBooleanSchema,
      disabled: DynamicBooleanSchema.optional(),
    }),
  },
  ({ props, accessibilityRef }) => {
    const id = useId()
    return (
      <div className="flex items-start gap-3">
        <Checkbox
          className="w-full"
          ref={accessibilityRef}
          id={id}
          size="md"
          checked={props.value ?? false}
          disabled={props.disabled}
          onCheckedChange={(checked) => props.setValue(checked === true)}
        />
        <Label htmlFor={id}>{props.label}</Label>
      </div>
    )
  }
)

const DaButton = createComponentImplementation(
  {
    name: "Button",
    schema: z.object({
      label: DynamicStringSchema,
      variant: z.enum(["solid", "outline", "text"]).default("solid"),
      disabled: DynamicBooleanSchema.optional(),
      action: ActionSchema,
    }),
  },
  ({ props, accessibilityRef }) => (
    <Button
      ref={accessibilityRef}
      type="button"
      variant={props.variant ?? "solid"}
      disabled={props.disabled}
      onClick={() => void props.action()}
    >
      {props.label}
    </Button>
  )
)

const DaDivider = createComponentImplementation(
  { name: "Divider", schema: z.object({}) },
  () => <Divider />
)

/** One catalog is shared by renderer validation and the agent's JSON schema. */
export const digitalAgencyCatalog = new Catalog(
  DIGITAL_AGENCY_CATALOG_ID,
  "1.0",
  [
    Column,
    Text,
    DaHeading,
    DaInput,
    DaTextarea,
    DaCheckbox,
    DaButton,
    DaDivider,
    DaTable,
    DaDescriptionList,
    DaSelect,
    ...contentComponents,
    ...dateComponents,
    ...formComponents,
    ...containerComponents,
    ...navigationComponents,
  ],
  [],
  undefined,
  "Unofficial Digital Agency inspired components. Use Column as root. Column and Text are A2UI layout/text primitives. Other components adapt existing repository UI components without additional visual widgets. Use Table and DescriptionList for numeric data. Give every input a descriptive label. Bind editable values with @path. Use plain text; HTML and JavaScript are not supported."
)
