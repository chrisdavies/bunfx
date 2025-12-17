import type { MailProvider } from "../types";

export function createNoopProvider(): MailProvider {
  return {
    async send() {
      // Do nothing - emails are silently discarded
    },
  };
}
