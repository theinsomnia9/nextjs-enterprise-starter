'use client'

import { useEffect, useRef } from 'react'

/**
 * Owns a single AbortController across async invocations. `start()` aborts the
 * previous controller and returns a new one; unmount aborts the latest.
 */
export function useSingleflightAbort() {
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  return () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    return controller
  }
}
