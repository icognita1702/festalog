const authEnabled = process.env.NEXT_PUBLIC_ENABLE_AUTH === 'true'

export function isAuthEnabled() {
  return authEnabled
}
