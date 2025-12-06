import fs from "node:fs";
import type { MailProvider, SendOptions, StoredEmail } from "../types";

export type LocalMailerOpts = {
  maxEmails?: number;
  storagePath?: string;
};

const DEFAULTS = {
  maxEmails: 50,
  storagePath: "./.mailer-storage.json",
};

export function readEmails(storagePath: string): StoredEmail[] {
  try {
    return JSON.parse(fs.readFileSync(storagePath, "utf-8")).emails ?? [];
  } catch {
    return [];
  }
}

export function createLocalProvider(opts: LocalMailerOpts = {}): MailProvider {
  const maxEmails = opts.maxEmails ?? DEFAULTS.maxEmails;
  const storagePath = opts.storagePath ?? DEFAULTS.storagePath;

  return {
    async send(sendOpts: SendOptions) {
      const email: StoredEmail = {
        ...sendOpts,
        id: crypto.randomUUID(),
        sentAt: new Date().toISOString(),
      };

      const emails = readEmails(storagePath);
      emails.unshift(email);

      const trimmed = emails.slice(0, maxEmails);
      fs.writeFileSync(
        storagePath,
        JSON.stringify({ emails: trimmed }, null, 2),
      );
    },
  };
}
