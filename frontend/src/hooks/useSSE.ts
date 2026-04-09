/**
 * Hook para conectarse al endpoint SSE del backend.
 * Usa fetch (no EventSource) para poder enviar el header Authorization.
 * Se reconecta automáticamente si la conexión se cae.
 */

import { useEffect, useRef } from 'react'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export interface SSEPayload {
  type: 'connected' | 'cita_creada' | 'cita_actualizada'
  data?: unknown
}

export function useSSE(onEvent: (e: SSEPayload) => void) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    const token = localStorage.getItem('token') ?? localStorage.getItem('adminToken')
    if (!token) return

    const controller = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout>

    async function connect() {
      try {
        const res = await fetch(`${BASE_URL}/api/events`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        })

        if (!res.ok || !res.body) return

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.slice(6)) as SSEPayload
                onEventRef.current(payload)
              } catch {
                // línea de heartbeat o malformada — ignorar
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        // Error de red → reconectar en 3 s
      }

      retryTimer = setTimeout(connect, 3000)
    }

    connect()

    return () => {
      controller.abort()
      clearTimeout(retryTimer)
    }
  }, []) // solo se monta/desmonta una vez
}
