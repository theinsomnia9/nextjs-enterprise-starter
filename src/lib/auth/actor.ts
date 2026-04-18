// TODO: replace with session-based auth once next-auth is configured.
// e.g.: const session = await auth(); return session?.user?.id
export const DEV_ACTOR_ID = 'dev-user-alice'

export async function getActorId(): Promise<string> {
  return DEV_ACTOR_ID
}
