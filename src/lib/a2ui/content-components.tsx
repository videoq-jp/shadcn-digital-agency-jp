import { createComponentImplementation as define } from "@a2ui/react"
import { DynamicStringSchema, DynamicBooleanSchema } from "@a2ui/web_core/v1_0"
import { z } from "zod/v3"
import { useId } from "react"
import { Blockquote } from "@/components/ui/blockquote"
import { ChipLabel } from "@/components/ui/chip-label"
import { ErrorText } from "@/components/ui/error-text"
import { SupportText } from "@/components/ui/support-text"
import { StatusBadge } from "@/components/ui/status-badge"
import { RequirementBadge } from "@/components/ui/requirement-badge"
import { Label } from "@/components/ui/label"
import { Legend } from "@/components/ui/legend"
import { FormControlLabel } from "@/components/ui/form-control-label"
import { Link } from "@/components/ui/link"
import { UtilityLink } from "@/components/ui/utility-link"
import { List } from "@/components/ui/list"
import { Image, ImageFigure, ImageCaption } from "@/components/ui/image"
import {
  EmergencyBanner,
  EmergencyBannerHeading,
  EmergencyBannerBody,
} from "@/components/ui/emergency-banner"
import {
  NotificationBanner,
  NotificationBannerBody,
  NotificationBannerClose,
} from "@/components/ui/notification-banner"
import {
  ProgressIndicator,
  ProgressIndicatorLinear,
} from "@/components/ui/progress-indicator"
import { childrenOf, childrenSchema, safeUrl, textSchema } from "./shared"

const DaBlockquote = define(
  { name: "Blockquote", schema: textSchema },
  ({ props }) => <Blockquote>{props.text}</Blockquote>
)
const DaErrorText = define(
  { name: "ErrorText", schema: textSchema },
  ({ props }) => <ErrorText>{props.text}</ErrorText>
)
const DaSupportText = define(
  { name: "SupportText", schema: textSchema },
  ({ props }) => <SupportText>{props.text}</SupportText>
)
const DaStatusBadge = define(
  { name: "StatusBadge", schema: textSchema },
  ({ props }) => <StatusBadge>{props.text}</StatusBadge>
)
const DaChipLabel = define(
  { name: "ChipLabel", schema: textSchema },
  ({ props }) => <ChipLabel>{props.text}</ChipLabel>
)
const DaRequirementBadge = define(
  {
    name: "RequirementBadge",
    schema: textSchema.extend({ optional: z.boolean().default(false) }),
  },
  ({ props }) => (
    <RequirementBadge isOptional={props.optional}>
      {props.text}
    </RequirementBadge>
  )
)
const DaLabel = define({ name: "Label", schema: textSchema }, ({ props }) => (
  <Label>{props.text}</Label>
))
const DaLegend = define(
  { name: "Legend", schema: textSchema.extend({ children: childrenSchema }) },
  ({ props, buildChild }) => (
    <fieldset>
      <Legend>{props.text}</Legend>
      {childrenOf(props.children, buildChild)}
    </fieldset>
  )
)
const DaFormControlLabel = define(
  {
    name: "FormControlLabel",
    schema: z.object({ label: DynamicStringSchema, children: childrenSchema }),
  },
  ({ props, buildChild }) => (
    <FormControlLabel as="fieldset">
      <Legend>{props.label}</Legend>
      {childrenOf(props.children, buildChild)}
    </FormControlLabel>
  )
)
const linkSchema = z.object({
  text: DynamicStringSchema,
  href: z.string(),
  newTab: z.boolean().default(false),
})
const DaLink = define({ name: "Link", schema: linkSchema }, ({ props }) => (
  <Link
    href={safeUrl(props.href)}
    target={props.newTab ? "_blank" : undefined}
    rel={props.newTab ? "noopener noreferrer" : undefined}
  >
    {props.text}
  </Link>
))
const DaUtilityLink = define(
  { name: "UtilityLink", schema: linkSchema },
  ({ props }) => (
    <UtilityLink
      href={safeUrl(props.href)}
      target={props.newTab ? "_blank" : undefined}
      rel={props.newTab ? "noopener noreferrer" : undefined}
    >
      {props.text}
    </UtilityLink>
  )
)
const DaList = define(
  {
    name: "List",
    schema: z.object({
      items: z.array(z.string()).max(100),
      numbered: z.boolean().default(false),
    }),
  },
  ({ props }) => (
    <List spacing="8" marker={props.numbered ? "number" : undefined}>
      {props.items.map((text, i) => (
        <li key={i}>
          {props.numbered && <span>{i + 1}. </span>}
          {text}
        </li>
      ))}
    </List>
  )
)
const DaImage = define(
  {
    name: "Image",
    schema: z.object({
      src: z.string(),
      alt: z.string(),
      caption: z.string().optional(),
    }),
  },
  ({ props }) => (
    <ImageFigure>
      <Image
        src={safeUrl(props.src, true)}
        alt={props.alt}
        className="max-w-full"
      />
      {props.caption && <ImageCaption>{props.caption}</ImageCaption>}
    </ImageFigure>
  )
)
const DaEmergencyBanner = define(
  {
    name: "EmergencyBanner",
    schema: z.object({
      title: DynamicStringSchema,
      text: DynamicStringSchema,
      children: childrenSchema,
    }),
  },
  ({ props, buildChild }) => (
    <EmergencyBanner>
      <EmergencyBannerHeading level="h2">{props.title}</EmergencyBannerHeading>
      <EmergencyBannerBody>
        {props.text}
        {childrenOf(props.children, buildChild)}
      </EmergencyBannerBody>
    </EmergencyBanner>
  )
)
const DaNotificationBanner = define(
  {
    name: "NotificationBanner",
    schema: z.object({
      title: DynamicStringSchema,
      text: DynamicStringSchema,
      type: z
        .enum(["info1", "info2", "warning", "error", "success"])
        .default("info1"),
      visible: DynamicBooleanSchema,
      children: childrenSchema,
    }),
  },
  ({ props, buildChild }) =>
    props.visible ? (
      <NotificationBanner
        type={props.type}
        bannerStyle="standard"
        title={props.title}
      >
        <NotificationBannerClose onClick={() => props.setVisible(false)} />
        <NotificationBannerBody>
          {props.text}
          {childrenOf(props.children, buildChild)}
        </NotificationBannerBody>
      </NotificationBanner>
    ) : null
)
const DaProgressIndicator = define(
  {
    name: "ProgressIndicator",
    schema: z.object({
      label: DynamicStringSchema,
      value: z.number().min(0).max(100).optional(),
    }),
  },
  ({ props }) => {
    const id = useId()
    return (
      <ProgressIndicator
        type="inlined"
        value={props.value}
        aria-labelledby={id}
      >
        <span id={id}>{props.label}</span>
        <ProgressIndicatorLinear />
      </ProgressIndicator>
    )
  }
)
export const contentComponents = [
  DaBlockquote,
  DaErrorText,
  DaSupportText,
  DaStatusBadge,
  DaChipLabel,
  DaRequirementBadge,
  DaLabel,
  DaLegend,
  DaFormControlLabel,
  DaLink,
  DaUtilityLink,
  DaList,
  DaImage,
  DaEmergencyBanner,
  DaNotificationBanner,
  DaProgressIndicator,
]
