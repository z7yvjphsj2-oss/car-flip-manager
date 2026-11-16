// No client construction or global session: tests supply an isolated SDK client.
export function createAuthService(client) {
  return {
    getSession: () => client.auth.getSession(),
    onAuthStateChange: (callback) => client.auth.onAuthStateChange(callback),
    signInWithPassword: (credentials) => client.auth.signInWithPassword(credentials),
    signUp: (credentials) => client.auth.signUp(credentials),
    signOut: (...args) => client.auth.signOut(...args),
  };
}
