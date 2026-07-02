import type { SessionEvent } from '../types'

type Listener = (event: SessionEvent) => void

class EventBus {
  private listeners: Set<Listener> = new Set()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: SessionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[EventBus] listener error:', err)
      }
    }
  }
}

export const eventBus = new EventBus()

