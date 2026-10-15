const SERVER_ACTION_ERROR_PATTERNS = [
  "failed to find server action",
  "was not found on the server",
  "server reference id did not match the expected format"
];

const ACTION_RELOAD_KEY = "spetly:server-action-reload";

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

export function isServerActionVersionError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return SERVER_ACTION_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function recoverFromServerActionVersionError(error: unknown) {
  if (typeof window === "undefined" || !isServerActionVersionError(error)) {
    return false;
  }

  const marker = `${window.location.pathname}:${errorMessage(error)}`;

  try {
    if (window.sessionStorage.getItem(ACTION_RELOAD_KEY) === marker) {
      return false;
    }

    window.sessionStorage.setItem(ACTION_RELOAD_KEY, marker);
  } catch {
    // Reloading is still the safest recovery when session storage is unavailable.
  }

  window.location.reload();
  return true;
}
