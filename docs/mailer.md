# Mailer

Email abstraction with multiple providers: Mailgun for production, local storage for development, and noop for testing.

## Import

```ts
import { makeMailer, makeDevmailHandler } from "bunfx/mailer";
```

## Basic Usage

```ts
const mailer = makeMailer({
  provider: "mailgun",
  apiKey: process.env.MAILGUN_API_KEY!,
  domain: "mail.example.com",
});

await mailer.send({
  from: "noreply@example.com",
  to: ["user@example.com"],
  subject: "Welcome!",
  html: "<h1>Hello</h1><p>Welcome to our service.</p>",
});
```

## Providers

### Mailgun (Production)

```ts
const mailer = makeMailer({
  provider: "mailgun",
  apiKey: "key-xxx",
  domain: "mail.example.com",
});
```

| Option | Type | Description |
|--------|------|-------------|
| `apiKey` | `string` | Mailgun API key |
| `domain` | `string` | Mailgun sending domain |

Features:
- Automatic batching (1000 recipients per request)
- Recipient variables for personalization
- Attachment support

### Local (Development)

Stores emails in a JSON file for local development and testing.

```ts
const mailer = makeMailer({
  provider: "local",
  maxEmails: 50,              // Optional, default: 50
  storagePath: "./.emails.json", // Optional, default: "./.mailer-storage.json"
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxEmails` | `number` | 50 | Maximum emails to retain |
| `storagePath` | `string` | `./.mailer-storage.json` | Path to storage file |

### Noop (Testing)

Silently discards all emails. Useful for tests where email sending should be disabled.

```ts
const mailer = makeMailer({ provider: "noop" });
```

## Send Options

```ts
type SendOptions = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: Attachment[];
  providerOptions?: ProviderOptions;
};

type Attachment = {
  data: Blob;
  filename: string;
};
```

### Attachments

```ts
await mailer.send({
  from: "noreply@example.com",
  to: ["user@example.com"],
  subject: "Your Report",
  html: "<p>Please find attached.</p>",
  attachments: [
    {
      filename: "report.pdf",
      data: new Blob([pdfBytes], { type: "application/pdf" }),
    },
  ],
});
```

### Recipient Variables (Mailgun)

Personalize emails per-recipient using template variables:

```ts
await mailer.send({
  from: "noreply@example.com",
  to: ["alice@example.com", "bob@example.com"],
  subject: "Hello %recipient.name%",
  html: "<p>Your code is %recipient.code%</p>",
  providerOptions: {
    recipientVariables: {
      "alice@example.com": { name: "Alice", code: "ABC123" },
      "bob@example.com": { name: "Bob", code: "XYZ789" },
    },
  },
});
```

Variables use the format `%recipient.varName%` in subject and HTML body.

## Devmail UI

A development UI for viewing locally stored emails.

```ts
import { makeDevmailHandler } from "bunfx/mailer";

const devmail = makeDevmailHandler({
  prefix: "/devmail",           // Optional, default: "/devmail"
  storagePath: "./.emails.json", // Optional, must match local provider
});

// Add to your router
// GET /devmail - Email inbox UI
```

### Features

- Lists all stored emails with subject, recipients, and timestamp
- Renders email HTML in an iframe
- Links in emails open in new tabs
- Recipient variable preview for batch emails

### Setup Example

```ts
import { makeMailer, makeDevmailHandler } from "bunfx/mailer";

const isDev = process.env.NODE_ENV !== "production";

const mailer = isDev
  ? makeMailer({ provider: "local" })
  : makeMailer({
      provider: "mailgun",
      apiKey: process.env.MAILGUN_API_KEY!,
      domain: process.env.MAILGUN_DOMAIN!,
    });

// In development, add devmail routes
const routes = isDev ? makeDevmailHandler() : {};
```

## Provider Interface

Create custom providers by implementing:

```ts
type MailProvider = {
  send(opts: SendOptions): Promise<void>;
};
```
