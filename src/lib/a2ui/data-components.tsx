import { createComponentImplementation } from "@a2ui/react"
import { DynamicBooleanSchema, DynamicStringSchema } from "@a2ui/web_core/v1_0"
import { Fragment, useId } from "react"
import { z } from "zod/v3"
import { Label } from "@/components/ui/label"
import { Dl, Dt, Dd } from "@/components/ui/description-list"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const DaDescriptionList = createComponentImplementation(
  {
    name: "DescriptionList",
    schema: z.object({
      items: z
        .array(z.object({ term: z.string(), description: z.string() }))
        .min(1)
        .max(30),
    }),
  },
  ({ props }) => (
    <Dl>
      {props.items.map((item, index) => (
        <Fragment key={index}>
          <Dt>{item.term}</Dt>
          <Dd>{item.description}</Dd>
        </Fragment>
      ))}
    </Dl>
  )
)

export const DaTable = createComponentImplementation(
  {
    name: "Table",
    schema: z.object({
      caption: z.string(),
      columns: z.array(z.string()).min(1).max(8),
      rows: z.array(z.array(z.string()).max(8)).max(100),
    }),
  },
  ({ props }) => (
    <div className="min-w-0 overflow-x-auto">
      <Table>
        <TableCaption>{props.caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {props.columns.map((column, index) => (
              <TableHead key={index}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row, index) => (
            <TableRow key={index}>
              {props.columns.map((_, column) => (
                <TableCell key={column}>{row[column] ?? ""}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
)

export const DaSelect = createComponentImplementation(
  {
    name: "Select",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicStringSchema,
      disabled: DynamicBooleanSchema.optional(),
      options: z
        .array(z.object({ label: z.string(), value: z.string().min(1) }))
        .min(1)
        .max(30),
    }),
  },
  ({ props, accessibilityRef }) => {
    const id = useId()
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>{props.label}</Label>
        <Select
          value={props.value ?? ""}
          onValueChange={props.setValue}
          disabled={props.disabled}
        >
          <SelectTrigger ref={accessibilityRef} id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {props.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }
)
