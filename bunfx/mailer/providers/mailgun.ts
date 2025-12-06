import type { MailProvider, SendOptions } from "../types";

export type MailgunOpts = {
  apiKey: string;
  domain: string;
};

const BATCH_SIZE = 1000;

async function sendBatch(
  opts: MailgunOpts,
  sendOpts: SendOptions,
  recipients: string[],
): Promise<void> {
  const { apiKey, domain } = opts;

  const form = new FormData();
  form.append("from", sendOpts.from);
  form.append("subject", sendOpts.subject);
  form.append("html", sendOpts.html);

  if (sendOpts.replyTo) {
    form.append("h:Reply-To", sendOpts.replyTo);
  }

  for (const recipient of recipients) {
    form.append("to", recipient);
  }

  if (sendOpts.providerOptions?.recipientVariables) {
    form.append(
      "recipient-variables",
      JSON.stringify(sendOpts.providerOptions.recipientVariables),
    );
  }

  if (sendOpts.attachments) {
    for (const attachment of sendOpts.attachments) {
      form.append("attachment", attachment.data, attachment.filename);
    }
  }

  const response = await fetch(
    `https://api.mailgun.net/v3/${domain}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
      },
      body: form,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mailgun API error: ${response.status} ${text}`);
  }
}

export function createMailgunProvider(opts: MailgunOpts): MailProvider {
  return {
    async send(sendOpts: SendOptions) {
      const recipients = sendOpts.to;

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        await sendBatch(opts, sendOpts, batch);
      }
    },
  };
}
