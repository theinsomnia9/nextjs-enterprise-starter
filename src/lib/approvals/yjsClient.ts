import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { Awareness } from 'y-protocols/awareness'

export interface YjsRoom {
  doc: Y.Doc
  provider: WebsocketProvider
  nodesMap: Y.Map<unknown>
  edgesMap: Y.Map<unknown>
  awareness: Awareness
}

export function createYjsRoom(roomId: string): YjsRoom {
  const doc = new Y.Doc()
  const wsUrl = `ws://${process.env.NEXT_PUBLIC_YJS_HOST ?? 'localhost'}:${process.env.NEXT_PUBLIC_YJS_PORT ?? '1234'}`

  const provider = new WebsocketProvider(wsUrl, roomId, doc)

  const nodesMap = doc.getMap('nodes')
  const edgesMap = doc.getMap('edges')
  const awareness = provider.awareness

  return { doc, provider, nodesMap, edgesMap, awareness }
}

export function destroyYjsRoom(room: YjsRoom): void {
  room.provider.disconnect()
  room.provider.destroy()
  room.doc.destroy()
}
