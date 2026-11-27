import { createComponentImplementation as define } from "@a2ui/react"
import { DynamicStringSchema, DynamicNumberSchema } from "@a2ui/web_core/v1_0"
import { useId, useState } from "react"
import { z } from "zod"
import {
  Breadcrumbs,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
} from "@/components/ui/breadcrumbs"
import { Carousel } from "@/components/ui/carousel"
import {
  HorizontalMenu,
  HorizontalMenuItem,
  HorizontalMenuItemButton,
} from "@/components/ui/horizontal-menu"
import {
  LanguageSelector,
  LanguageSelectorButton,
  LanguageSelectorMenu,
  LanguageSelectorMenuItem,
} from "@/components/ui/language-selector"
import {
  MenuList,
  MenuListItem,
  MenuListItemButton,
} from "@/components/ui/menu-list"
import {
  MenuListBox,
  MenuListBoxOpener,
  MenuListBoxPopup,
  useMenuListBox,
} from "@/components/ui/menu-list-box"
import {
  PageNavigation,
  PageNavigationCounter,
  PageNavigationButton,
} from "@/components/ui/page-navigation"
import {
  ResourceList,
  ResourceListBody,
  ResourceListContents,
  ResourceListTitle,
  ResourceListSupport,
} from "@/components/ui/resource-list"
import {
  StepNavigation,
  StepNavigationList,
  StepNavigationStep,
  StepNavigationStepHeader,
  StepNavigationNumber,
  StepNavigationTitle,
  StepNavigationDescription,
} from "@/components/ui/step-navigation"
import { safeUrl, optionsSchema } from "./shared"
const menuSchema = z.object({
  label: DynamicStringSchema,
  value: DynamicStringSchema,
  options: optionsSchema,
})
const DaBreadcrumbs = define(
  {
    name: "Breadcrumbs",
    schema: z.object({
      label: DynamicStringSchema,
      items: z
        .array(z.object({ label: z.string(), href: z.string() }))
        .min(1)
        .max(20),
    }),
  },
  ({ props }) => (
    <Breadcrumbs aria-label={props.label}>
      <BreadcrumbList>
        {props.items.map((item, i) => (
          <li key={i}>
            <BreadcrumbItem isCurrent={i === props.items.length - 1}>
              {i === props.items.length - 1 ? (
                item.label
              ) : (
                <BreadcrumbLink href={safeUrl(item.href)}>
                  {item.label}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </li>
        ))}
      </BreadcrumbList>
    </Breadcrumbs>
  )
)
const DaHorizontalMenu = define(
  { name: "HorizontalMenu", schema: menuSchema },
  ({ props }) => (
    <HorizontalMenu aria-label={props.label}>
      {props.options.map((option) => (
        <HorizontalMenuItem key={option.value}>
          <HorizontalMenuItemButton
            aria-current={props.value === option.value ? "page" : undefined}
            onClick={() => props.setValue(option.value)}
          >
            {option.label}
          </HorizontalMenuItemButton>
        </HorizontalMenuItem>
      ))}
    </HorizontalMenu>
  )
)
const DaMenuList = define(
  { name: "MenuList", schema: menuSchema },
  ({ props }) => (
    <MenuList aria-label={props.label}>
      {props.options.map((option) => (
        <MenuListItem key={option.value}>
          <MenuListItemButton
            type="standard"
            size="regular"
            current={props.value === option.value}
            onClick={() => props.setValue(option.value)}
          >
            {option.label}
          </MenuListItemButton>
        </MenuListItem>
      ))}
    </MenuList>
  )
)
const DaMenuListBox = define(
  { name: "MenuListBox", schema: menuSchema },
  ({ props }) => {
    const menu = useMenuListBox({
      onMenuItemSelect: (detail) => props.setValue(detail.selectedValue),
    })
    return (
      <MenuListBox {...menu.rootProps}>
        <MenuListBoxOpener
          {...menu.openerProps}
          size="md"
          buttonStyle="outlined"
        >
          {props.label}
        </MenuListBoxOpener>
        {menu.isOpen && (
          <MenuListBoxPopup {...menu.popupProps}>
            <MenuList>
              {props.options.map((option) => (
                <MenuListItem key={option.value}>
                  <MenuListItemButton
                    type="standard"
                    size="regular"
                    role="menuitem"
                    data-value={option.value}
                    current={props.value === option.value}
                  >
                    {option.label}
                  </MenuListItemButton>
                </MenuListItem>
              ))}
            </MenuList>
          </MenuListBoxPopup>
        )}
      </MenuListBox>
    )
  }
)
const DaLanguageSelector = define(
  { name: "LanguageSelector", schema: menuSchema },
  ({ props }) => {
    const [open, setOpen] = useState(false)
    const id = useId()
    return (
      <LanguageSelector
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false)
        }}
      >
        <LanguageSelectorButton
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {props.label}:{" "}
          {props.options.find((o) => o.value === props.value)?.label}
        </LanguageSelectorButton>
        {open && (
          <LanguageSelectorMenu id={id}>
            {props.options.map((option) => (
              <li key={option.value}>
                <LanguageSelectorMenuItem
                  href="#"
                  lang={option.value}
                  isCurrent={props.value === option.value}
                  onClick={(e) => {
                    e.preventDefault()
                    props.setValue(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </LanguageSelectorMenuItem>
              </li>
            ))}
          </LanguageSelectorMenu>
        )}
      </LanguageSelector>
    )
  }
)
const DaPageNavigation = define(
  {
    name: "PageNavigation",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicNumberSchema,
      total: z.number().int().min(1).max(10000),
    }),
  },
  ({ props }) => {
    const page = Math.max(
      1,
      Math.min(props.total, Math.trunc(props.value ?? 1))
    )
    return (
      <PageNavigation aria-label={props.label}>
        <PageNavigationButton
          type="button"
          control="prev"
          disabled={page <= 1}
          onClick={() => props.setValue(page - 1)}
        >
          前へ
        </PageNavigationButton>
        <PageNavigationCounter aria-live="polite">
          {page} / {props.total}
        </PageNavigationCounter>
        <PageNavigationButton
          type="button"
          control="next"
          disabled={page >= props.total}
          onClick={() => props.setValue(page + 1)}
        >
          次へ
        </PageNavigationButton>
      </PageNavigation>
    )
  }
)
const DaResourceList = define(
  {
    name: "ResourceList",
    schema: z.object({
      items: z
        .array(
          z.object({
            title: z.string(),
            description: z.string(),
            href: z.string(),
          })
        )
        .min(1)
        .max(40),
      variant: z.enum(["list", "frame"]).default("list"),
    }),
  },
  ({ props }) => (
    <div>
      {props.items.map((item, i) => (
        <ResourceList key={i} variant={props.variant}>
          <ResourceListBody asChild>
            <a href={safeUrl(item.href)}>
              <ResourceListContents>
                <ResourceListTitle as="h3">{item.title}</ResourceListTitle>
                <ResourceListSupport>{item.description}</ResourceListSupport>
              </ResourceListContents>
            </a>
          </ResourceListBody>
        </ResourceList>
      ))}
    </div>
  )
)
const DaStepNavigation = define(
  {
    name: "StepNavigation",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicNumberSchema,
      steps: z
        .array(z.object({ title: z.string(), description: z.string() }))
        .min(1)
        .max(20),
      orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
    }),
  },
  ({ props }) => {
    const current = Math.max(
      0,
      Math.min(props.steps.length - 1, Math.trunc(props.value ?? 0))
    )
    return (
      <StepNavigation
        role="navigation"
        aria-label={props.label}
        orientation={props.orientation}
      >
        <StepNavigationList>
          {props.steps.map((step, i) => (
            <StepNavigationStep
              key={i}
              first={i === 0}
              last={i === props.steps.length - 1}
              state={
                i < current
                  ? "completed"
                  : i === current
                    ? "editing"
                    : "reached"
              }
              aria-current={i === current ? "step" : undefined}
            >
              <StepNavigationStepHeader asChild>
                <button type="button" onClick={() => props.setValue(i)}>
                  <StepNavigationNumber>{i + 1}</StepNavigationNumber>
                  <StepNavigationTitle>{step.title}</StepNavigationTitle>
                </button>
              </StepNavigationStepHeader>
              <StepNavigationDescription>
                {step.description}
              </StepNavigationDescription>
            </StepNavigationStep>
          ))}
        </StepNavigationList>
      </StepNavigation>
    )
  }
)
const DaCarousel = define(
  {
    name: "Carousel",
    schema: z.object({
      label: DynamicStringSchema,
      value: DynamicNumberSchema,
      slides: z
        .array(
          z.object({
            label: z.string(),
            src: z.string(),
            alt: z.string(),
            href: z.string().optional(),
          })
        )
        .min(1)
        .max(12),
    }),
  },
  ({ props }) => {
    const index = Math.max(
      0,
      Math.min(props.slides.length - 1, Math.trunc(props.value ?? 0))
    )
    const move = (n: number) =>
      props.setValue((n + props.slides.length) % props.slides.length)
    return (
      <Carousel
        aria-label={props.label}
        slides={props.slides.map((s, i) => ({
          id: String(i),
          label: s.label,
          href: s.href ? safeUrl(s.href) : undefined,
          image: {
            src: safeUrl(s.src, true) ?? "",
            alt: s.alt,
            width: 800,
            height: 450,
          },
        }))}
        currentIndex={index}
        isNormal
        onPrev={() => move(index - 1)}
        onNext={() => move(index + 1)}
        onStepSelect={move}
      />
    )
  }
)
export const navigationComponents = [
  DaBreadcrumbs,
  DaHorizontalMenu,
  DaMenuList,
  DaMenuListBox,
  DaLanguageSelector,
  DaPageNavigation,
  DaResourceList,
  DaStepNavigation,
  DaCarousel,
]
