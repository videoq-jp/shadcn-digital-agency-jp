import { createComponentImplementation as define } from "@a2ui/react"
import { DynamicStringSchema, DynamicBooleanSchema } from "@a2ui/web_core/v1_0"
import { useId } from "react"
import { z } from "zod/v3"
import {
  Accordion,
  AccordionSummary,
  AccordionContent,
} from "@/components/ui/accordion"
import { Disclosure, DisclosureSummary } from "@/components/ui/disclosure"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogClose,
  DialogBody,
  useDialog,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerTrigger,
  DrawerHeader,
  DrawerClose,
  DrawerTitle,
  DrawerBody,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Tab, TabList, TabItem, TabPanel } from "@/components/ui/tabs"
import { childrenOf, childrenSchema } from "./shared"
const containerSchema = z.object({
  title: DynamicStringSchema,
  value: DynamicBooleanSchema,
  children: childrenSchema,
})
const DaAccordion = define(
  { name: "Accordion", schema: containerSchema },
  ({ props, buildChild }) => (
    <Accordion
      open={props.value ?? false}
      onToggle={(e) => {
        if (e.currentTarget.open !== props.value)
          props.setValue(e.currentTarget.open)
      }}
    >
      <AccordionSummary>{props.title}</AccordionSummary>
      <AccordionContent>
        {childrenOf(props.children, buildChild)}
      </AccordionContent>
    </Accordion>
  )
)
const DaDisclosure = define(
  { name: "Disclosure", schema: containerSchema },
  ({ props, buildChild }) => (
    <Disclosure
      open={props.value ?? false}
      onToggle={(e) => {
        if (e.currentTarget.open !== props.value)
          props.setValue(e.currentTarget.open)
      }}
    >
      <DisclosureSummary>{props.title}</DisclosureSummary>
      {childrenOf(props.children, buildChild)}
    </Disclosure>
  )
)
const DaDialog = define(
  { name: "Dialog", schema: containerSchema },
  ({ props, buildChild }) => {
    const modal = useDialog({
      open: props.value ?? false,
      onOpenChange: props.setValue,
    })
    return (
      <>
        <Button type="button" onClick={() => props.setValue(true)}>
          {props.title}
        </Button>
        <Dialog {...modal.dialogProps}>
          <DialogContent>
            <DialogHeader>
              <DialogHeading {...modal.headingProps}>
                {props.title}
              </DialogHeading>
              <DialogClose {...modal.closeButtonProps} />
            </DialogHeader>
            <DialogBody>{childrenOf(props.children, buildChild)}</DialogBody>
          </DialogContent>
        </Dialog>
      </>
    )
  }
)
const DaDrawer = define(
  {
    name: "Drawer",
    schema: containerSchema.extend({
      side: z.enum(["left", "right", "full"]).default("right"),
    }),
  },
  ({ props, buildChild }) => {
    const modal = useDialog({
      open: props.value ?? false,
      onOpenChange: props.setValue,
    })
    return (
      <>
        <DrawerTrigger
          label={props.title}
          aria-expanded={props.value ?? false}
          onClick={() => props.setValue(true)}
        />
        <Drawer {...modal.dialogProps} side={props.side}>
          <DrawerHeader>
            <DrawerTitle {...modal.headingProps}>{props.title}</DrawerTitle>
            <DrawerClose onClick={() => props.setValue(false)} />
          </DrawerHeader>
          <DrawerBody>
            <li>{childrenOf(props.children, buildChild)}</li>
          </DrawerBody>
        </Drawer>
      </>
    )
  }
)
const DaTabs = define(
  {
    name: "Tabs",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicStringSchema,
      tabs: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
            children: childrenSchema,
          })
        )
        .min(1)
        .max(12),
    }),
  },
  ({ props, buildChild }) => {
    const id = useId()
    const selected =
      props.tabs.find((t) => t.value === props.value)?.value ??
      props.tabs[0].value
    return (
      <Tab>
        <TabList
          role="tablist"
          aria-label={props.label}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
              return
            e.preventDefault()
            const index = props.tabs.findIndex((t) => t.value === selected)
            const next =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? props.tabs.length - 1
                  : (index +
                      (e.key === "ArrowRight" ? 1 : -1) +
                      props.tabs.length) %
                    props.tabs.length
            props.setValue(props.tabs[next].value)
            document.getElementById(`${id}-tab-${next}`)?.focus()
          }}
        >
          {props.tabs.map((tab, i) => (
            <TabItem
              key={tab.value}
              _internalElementType="button"
              _internalListItemRole="presentation"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={selected === tab.value}
              aria-controls={`${id}-panel-${i}`}
              tabIndex={selected === tab.value ? 0 : -1}
              onClick={() => props.setValue(tab.value)}
            >
              {tab.label}
            </TabItem>
          ))}
        </TabList>
        {props.tabs.map((tab, i) => (
          <TabPanel
            key={tab.value}
            id={`${id}-panel-${i}`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${i}`}
            hidden={selected !== tab.value}
            tabIndex={0}
          >
            {childrenOf(tab.children, buildChild)}
          </TabPanel>
        ))}
      </Tab>
    )
  }
)
export const containerComponents = [
  DaAccordion,
  DaDisclosure,
  DaDialog,
  DaDrawer,
  DaTabs,
]
