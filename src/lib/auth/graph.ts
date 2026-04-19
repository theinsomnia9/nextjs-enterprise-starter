const GRAPH_PHOTO_URL = 'https://graph.microsoft.com/v1.0/me/photo/$value'

export async function fetchUserPhoto(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(GRAPH_PHOTO_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    if (res.status === 404) return null
    if (!res.ok) {
      console.warn('[auth/graph] photo fetch failed', { status: res.status })
      return null
    }
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const buf = await res.arrayBuffer()
    const b64 = Buffer.from(buf).toString('base64')
    return `data:${contentType};base64,${b64}`
  } catch (err) {
    console.warn('[auth/graph] photo fetch threw', { err: (err as Error).message })
    return null
  }
}
