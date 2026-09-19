const ACCESS_KEY = "accora.accessToken";
const REFRESH_KEY = "accora.refreshToken";

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  setAccessToken(accessToken: string) {
    localStorage.setItem(ACCESS_KEY, accessToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Fired when the API client gives up on the current session (refresh
 * failed, or there was never a token) — AuthProvider listens for this to
 * clear its state and redirect to /login, from a single choke point
 * instead of every call site checking for 401 itself. */
export const authEvents = new EventTarget();
export const AUTH_LOGGED_OUT = "auth:logged-out";

export function emitLoggedOut() {
  authEvents.dispatchEvent(new Event(AUTH_LOGGED_OUT));
}
