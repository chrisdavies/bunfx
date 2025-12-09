/**
 * Redirect error for use in route load functions.
 *
 * Usage:
 *   export async function load() {
 *     const user = await rpc.auth.me({});
 *     if (!user) {
 *       throw new RedirectError('/login');
 *     }
 *     return { user };
 *   }
 */
export class RedirectError extends Error {
  readonly href: string;

  constructor(href: string) {
    super(`Redirect to ${href}`);
    this.name = "RedirectError";
    this.href = href;
  }
}
