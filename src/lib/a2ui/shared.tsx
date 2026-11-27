import { ChildListSchema, DynamicStringSchema } from "@a2ui/web_core/v1_0"
import { Fragment, type ReactNode } from "react"
import { z } from "zod/v3"

export const textSchema = z.object({ text: DynamicStringSchema })
export const childrenSchema = ChildListSchema.default([])
export const optionsSchema = z
  .array(z.object({ label: z.string(), value: z.string().min(1) }))
  .min(1)
  .max(30)
// Allow navigation and images, never executable schemes supplied by a model.
export function safeUrl(value: string, image = false): string | undefined {
  const url = value.trim()
  if (/^(https?:\/\/|\/|#)/i.test(url) && !url.startsWith("//")) return url
  if (!image && /^(mailto:|tel:)/i.test(url)) return url
  return undefined
}
export function childrenOf(
  children: (string | { id: string; basePath?: string })[],
  buildChild: (id: string, basePath?: string) => ReactNode
) {
  return children.map((child) => (
    <Fragment key={typeof child === "string" ? child : child.id}>
      {typeof child === "string"
        ? buildChild(child)
        : buildChild(child.id, child.basePath)}
    </Fragment>
  ))
}
