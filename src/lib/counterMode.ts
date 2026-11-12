// Counter-only logins (role "counter") are for the front-counter iMac. They can open
// Counter Quote and Patch Pro and nothing else; every other page sends them back to
// Counter Quote. See DECISIONS.md, "Counter logins only see Counter Quote and Patch Pro".

/** The only app pages a counter login can open. */
export const COUNTER_PATHS = ["/counter", "/patch-pro"] as const;

/** Where a counter login lands, and where it gets sent from any other page. */
export const COUNTER_HOME = "/counter";

export function isCounterPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (COUNTER_PATHS as readonly string[]).includes(path);
}
