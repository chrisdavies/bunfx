/**
 * Core types for the mailer module.
 */

export type Attachment = {
  data: Blob;
  filename: string;
};

/**
 * Provider-specific options that extend the base send options.
 * The `recipientVariables` field is used by providers like Mailgun
 * to personalize emails per-recipient.
 */
export type ProviderOptions = {
  /**
   * Per-recipient variables for template substitution.
   * Key is email address, value is a map of variable names to values.
   * Variables are substituted as `%recipient.varName%` in subject/body.
   */
  recipientVariables?: Record<string, Record<string, string>>;
  [key: string]: unknown;
};

export type SendOptions = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: Attachment[];
  /**
   * Extension point for provider-specific options.
   */
  providerOptions?: ProviderOptions;
};

export type MailProvider = {
  send(opts: SendOptions): Promise<void>;
};

export type StoredEmail = SendOptions & {
  id: string;
  sentAt: string; // ISO date
};
