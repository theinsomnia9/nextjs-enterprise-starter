import { ConfidentialClientApplication, LogLevel } from '@azure/msal-node'
import { authConfig } from './config'

let _client: ConfidentialClientApplication | null = null

export function getMsalClient(): ConfidentialClientApplication {
  if (_client) return _client
  _client = new ConfidentialClientApplication({
    auth: {
      clientId: authConfig.clientId,
      clientSecret: authConfig.clientSecret,
      authority: authConfig.authorityUrl,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
        piiLoggingEnabled: false,
        loggerCallback: (_level, message) => {
          console.warn('[msal]', message)
        },
      },
    },
  })
  return _client
}
