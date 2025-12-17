import { createLocalProvider, type LocalMailerOpts } from "./providers/local";
import { createMailgunProvider, type MailgunOpts } from "./providers/mailgun";
import { createNoopProvider } from "./providers/noop";

export type MailerOpts =
  | ({ provider: "local" } & LocalMailerOpts)
  | ({ provider: "mailgun" } & MailgunOpts)
  | { provider: "noop" };

export function makeMailer(opts: MailerOpts) {
  if (opts.provider === "mailgun") {
    return createMailgunProvider(opts);
  }
  if (opts.provider === "noop") {
    return createNoopProvider();
  }
  return createLocalProvider(opts);
}
