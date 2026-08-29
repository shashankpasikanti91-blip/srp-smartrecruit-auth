/**
 * Honest provider connection labels (V2 requirements / App 1.4.0).
 * Never show "Connected" unless connection_status === 'connected' after a real Test.
 */

export type ConnectionStatus =
  | 'not_configured'
  | 'not_tested'
  | 'configuration_required'
  | 'connected'
  | 'connection_failed'
  | 'expired'
  | 'disabled'
  | string

export function connectionStatusLabel(status: ConnectionStatus | null | undefined): string {
  switch (status) {
    case 'connected':
      return 'Connected'
    case 'not_tested':
      return 'Saved — not tested'
    case 'configuration_required':
      return 'Configuration required'
    case 'connection_failed':
      return 'Connection failed'
    case 'expired':
      return 'Expired'
    case 'disabled':
      return 'Disabled'
    case 'not_configured':
    case null:
    case undefined:
    case '':
      return 'Not configured'
    default:
      return String(status)
  }
}

/** True only when Test Connection has succeeded. */
export function isHonestlyConnected(status: ConnectionStatus | null | undefined): boolean {
  return status === 'connected'
}
