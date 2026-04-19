// Internal header used to forward the middleware-verified session payload to
// the Node runtime so downstream readers (getActor, getSessionForClient) can
// skip a redundant JWE decrypt. Middleware strips any client-supplied value
// before setting this header.
export const SESSION_HEADER = 'x-auth-session'
