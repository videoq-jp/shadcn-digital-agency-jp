import { createComponentImplementation as define } from "@a2ui/react"
import { DynamicStringSchema, DynamicBooleanSchema } from "@a2ui/web_core/v1_0"
import { parseDate } from "@internationalized/date"
import { I18nProvider } from "react-aria-components"
import { useId, useState } from "react"
import { z } from "zod/v3"
import {
  Calendar,
  CalendarButton,
  CalendarHeading,
  CalendarGrid,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarGridBody,
  CalendarCell,
} from "@/components/ui/calendar"
import {
  DatePicker,
  DatePickerYear,
  DatePickerMonth,
  DatePickerDate,
  DatePickerCalendarButton,
} from "@/components/ui/date-picker"
import {
  SeparatedDatePicker,
  SeparatedDatePickerYear,
  SeparatedDatePickerMonth,
  SeparatedDatePickerDate,
  SeparatedDatePickerCalendarButton,
} from "@/components/ui/separated-date-picker"
import { Label } from "@/components/ui/label"

export const dateSchema = z.object({
  label: DynamicStringSchema,
  value: DynamicStringSchema,
  disabled: DynamicBooleanSchema.optional(),
  min: z.string().optional(),
  max: z.string().optional(),
})
function date(value: string | undefined) {
  try {
    return value ? parseDate(value) : null
  } catch {
    return null
  }
}
type DateProps = {
  label?: string
  value?: string
  disabled?: boolean
  min?: string
  max?: string
  setValue: (value: string) => void
}
function DateCalendar({
  label = "日付",
  value = "",
  disabled,
  min,
  max,
  setValue,
}: DateProps) {
  return (
    <I18nProvider locale="ja-JP">
      <Calendar
        aria-label={label}
        value={date(value)}
        minValue={date(min) ?? undefined}
        maxValue={date(max) ?? undefined}
        isDisabled={disabled}
        onChange={(next) => setValue(next.toString())}
      >
        <div className="flex w-full items-center justify-between">
          <CalendarButton slot="previous" aria-label="前の月">
            ‹
          </CalendarButton>
          <CalendarHeading />
          <CalendarButton slot="next" aria-label="次の月">
            ›
          </CalendarButton>
        </div>
        <CalendarGrid>
          <CalendarGridHeader>
            {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
          </CalendarGridHeader>
          <CalendarGridBody>
            {(day) => <CalendarCell date={day} />}
          </CalendarGridBody>
        </CalendarGrid>
      </Calendar>
    </I18nProvider>
  )
}
function DateFields({
  props,
  separated = false,
}: {
  props: DateProps
  separated?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const parts = (props.value ?? "").split("-")
  const update = (index: number, value: string) => {
    const next = [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""]
    next[index] = value.replace(/\D/g, "")
    props.setValue(next.every((x) => x === "") ? "" : next.join("-"))
  }
  const Y = separated ? SeparatedDatePickerYear : DatePickerYear,
    M = separated ? SeparatedDatePickerMonth : DatePickerMonth,
    D = separated ? SeparatedDatePickerDate : DatePickerDate
  const fields = (shared: {
    readOnly?: boolean
    "aria-disabled"?: boolean
    yearRef?: React.Ref<HTMLInputElement>
    monthRef?: React.Ref<HTMLInputElement>
    dateRef?: React.Ref<HTMLInputElement>
  }) => (
    <>
      <Y
        readOnly={shared.readOnly}
        aria-disabled={shared["aria-disabled"]}
        ref={shared.yearRef}
        aria-label={`${props.label} 年`}
        value={parts[0] ?? ""}
        onChange={(e) => update(0, e.target.value)}
        maxLength={4}
      />
      <M
        readOnly={shared.readOnly}
        aria-disabled={shared["aria-disabled"]}
        ref={shared.monthRef}
        aria-label={`${props.label} 月`}
        value={parts[1] ?? ""}
        onChange={(e) => update(1, e.target.value)}
        maxLength={2}
      />
      <D
        readOnly={shared.readOnly}
        aria-disabled={shared["aria-disabled"]}
        ref={shared.dateRef}
        aria-label={`${props.label} 日`}
        value={parts[2] ?? ""}
        onChange={(e) => update(2, e.target.value)}
        maxLength={2}
      />
    </>
  )
  const CalendarToggle = separated
    ? SeparatedDatePickerCalendarButton
    : DatePickerCalendarButton
  return (
    <div className="grid gap-2">
      <Label id={id}>{props.label}</Label>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
        {separated ? (
          <SeparatedDatePicker isDisabled={props.disabled}>
            {(shared) => fields(shared)}
          </SeparatedDatePicker>
        ) : (
          <DatePicker isDisabled={props.disabled}>
            {(shared) => fields(shared)}
          </DatePicker>
        )}
        <CalendarToggle
          aria-label={`${props.label}のカレンダーを開く`}
          aria-expanded={open}
          disabled={props.disabled}
          onClick={() => setOpen(!open)}
        />
      </div>
      {open && (
        <DateCalendar
          {...props}
          setValue={(next) => {
            props.setValue(next)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}
const DaCalendar = define(
  { name: "Calendar", schema: dateSchema },
  ({ props }) => <DateCalendar {...props} />
)
const DaDatePicker = define(
  { name: "DatePicker", schema: dateSchema },
  ({ props }) => <DateFields props={props} />
)
const DaSeparatedDatePicker = define(
  { name: "SeparatedDatePicker", schema: dateSchema },
  ({ props }) => <DateFields props={props} separated />
)
export const dateComponents = [DaCalendar, DaDatePicker, DaSeparatedDatePicker]
