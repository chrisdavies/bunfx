import { createLocalProvider, type LocalMailerOpts } from "./providers/local";
import { createMailgunProvider, type MailgunOpts } from "./providers/mailgun";

export type MailerOpts =
  | ({ provider: "local" } & LocalMailerOpts)
  | ({ provider: "mailgun" } & MailgunOpts);

export function makeMailer(opts: MailerOpts) {
  if (opts.provider === "mailgun") {
    return createMailgunProvider(opts);
  }
  return createLocalProvider(opts);
}
