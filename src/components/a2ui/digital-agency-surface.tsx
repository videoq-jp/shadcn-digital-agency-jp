import { A2uiSurface } from "@a2ui/react"
import { useEffect, useState } from "react"

import type { DigitalAgencySession } from "@/lib/a2ui/session"

/** Renders current surfaces and subscribes to streamed creation/deletion. */
export function DigitalAgencySurface({
  processor,
}: {
  processor: DigitalAgencySession
}) {
  const [surfaces, setSurfaces] = useState(() =>
    Array.from(processor.model.surfacesMap.values())
  )

  useEffect(() => {
    const sync = () =>
      setSurfaces(Array.from(processor.model.surfacesMap.values()))
    const created = processor.model.onSurfaceCreated.subscribe(sync)
    const deleted = processor.model.onSurfaceDeleted.subscribe(sync)
    sync()
    return () => {
      created.unsubscribe()
      deleted.unsubscribe()
    }
  }, [processor])

  return surfaces.map((surface) => (
    <A2uiSurface key={surface.id} surface={surface} />
  ))
}
