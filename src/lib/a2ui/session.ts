import type { ReactCatalogComponent } from "@a2ui/react"
import { MessageProcessor, type ActionPayload } from "@a2ui/web_core"

import { digitalAgencyCatalog } from "@/lib/a2ui/catalog"

/** Own one processor per conversation; dispose it when the conversation ends. */
export function createDigitalAgencySession(
  onAction?: (action: ActionPayload) => void | Promise<void>
) {
  return new MessageProcessor<ReactCatalogComponent>(
    [digitalAgencyCatalog],
    onAction,
    {
      version: "1.0",
      validationConfig: {
        targetVersion: "1.0",
        allowUnknownElements: false,
        // Components may arrive in separate streaming messages.
        allowMissingRoot: true,
        allowOrphanComponents: true,
        allowDanglingReferences: true,
      },
    }
  )
}

export type DigitalAgencySession = ReturnType<typeof createDigitalAgencySession>
