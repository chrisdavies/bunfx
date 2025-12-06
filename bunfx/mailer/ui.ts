import { readEmails } from "./providers/local";
import type { StoredEmail } from "./types";

type DevmailOptions = {
  prefix?: string;
  storagePath?: string;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLayout(
  content: string,
  emails: StoredEmail[],
  currentId?: string,
): string {
  const nav = emails
    .map((email) => {
      const isActive = email.id === currentId;
      const date = new Date(email.sentAt).toLocaleString();
      return `
        <a href="?id=${email.id}" style="
          display: block;
          padding: 0.75rem 1rem;
          text-decoration: none;
          color: inherit;
          border-bottom: 1px solid #eee;
          background: ${isActive ? "#e3f2fd" : "transparent"};
        ">
          <div style="font-weight: 500; margin-bottom: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(email.subject)}
          </div>
          <div style="font-size: 0.75rem; color: #666;">
            ${escapeHtml(email.to.join(", "))}
          </div>
          <div style="font-size: 0.75rem; color: #999;">
            ${escapeHtml(date)}
          </div>
        </a>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Devmail</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body style="display: flex; height: 100vh;">
  <nav style="width: 300px; border-right: 1px solid #ddd; overflow-y: auto; background: #fafafa;">
    <div style="padding: 1rem; font-weight: 600; border-bottom: 1px solid #ddd;">
      Devmail
    </div>
    ${nav || '<div style="padding: 1rem; color: #999;">No emails</div>'}
  </nav>
  <main style="flex: 1; overflow-y: auto;">
    ${content}
  </main>
</body>
</html>`;
}

// Inject <base target="_blank"> so links in email open in new tabs
function injectBaseTarget(html: string): string {
  const baseTag = '<base target="_blank">';
  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>${baseTag}`);
  }
  if (html.includes("<html>")) {
    return html.replace("<html>", `<html><head>${baseTag}</head>`);
  }
  return baseTag + html;
}

function renderEmail(email: StoredEmail): string {
  const recipientVars = email.providerOptions?.recipientVariables;
  const recipients = Object.keys(recipientVars ?? {});
  const emailHtml = injectBaseTarget(email.html);

  let recipientSelector = "";
  if (recipients.length > 0) {
    const options = recipients
      .map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`)
      .join("");
    recipientSelector = `
      <div style="margin-bottom: 1rem;">
        <label style="font-size: 0.875rem; color: #666;">
          Preview as recipient:
          <select id="recipient-select" style="margin-left: 0.5rem; padding: 0.25rem;">
            ${options}
          </select>
        </label>
      </div>
      <script>
        const recipientVars = ${JSON.stringify(recipientVars)};
        const originalHtml = ${JSON.stringify(emailHtml)};
        const originalSubject = ${JSON.stringify(email.subject)};

        function expandVars(str, vars) {
          return Object.entries(vars).reduce(
            (acc, [k, v]) => acc.replaceAll('%recipient.' + k + '%', v),
            str
          );
        }

        document.getElementById('recipient-select').addEventListener('change', (e) => {
          const vars = recipientVars[e.target.value] || {};
          document.getElementById('email-iframe').srcdoc = expandVars(originalHtml, vars);
          document.getElementById('email-subject').textContent = expandVars(originalSubject, vars);
        });

        // Initial expansion
        const firstRecipient = Object.keys(recipientVars)[0];
        if (firstRecipient) {
          const vars = recipientVars[firstRecipient];
          document.getElementById('email-iframe').srcdoc = expandVars(originalHtml, vars);
          document.getElementById('email-subject').textContent = expandVars(originalSubject, vars);
        }
      </script>
    `;
  }

  const date = new Date(email.sentAt).toLocaleString();

  return `
    <div style="padding: 1rem; border-bottom: 1px solid #eee;">
      <div style="margin-bottom: 0.5rem;">
        <span style="color: #666; font-size: 0.875rem;">From:</span>
        <span>${escapeHtml(email.from)}</span>
      </div>
      <div style="margin-bottom: 0.5rem;">
        <span style="color: #666; font-size: 0.875rem;">To:</span>
        <span>${escapeHtml(email.to.join(", "))}</span>
      </div>
      <div style="margin-bottom: 0.5rem;">
        <span style="color: #666; font-size: 0.875rem;">Subject:</span>
        <span id="email-subject">${escapeHtml(email.subject)}</span>
      </div>
      <div style="margin-bottom: 0.5rem;">
        <span style="color: #666; font-size: 0.875rem;">Sent:</span>
        <span>${escapeHtml(date)}</span>
      </div>
      ${recipientSelector}
    </div>
    <iframe
      id="email-iframe"
      srcdoc="${escapeHtml(emailHtml)}"
      style="width: 100%; height: calc(100% - 200px); border: none;"
    ></iframe>
  `;
}

function renderNotFound(): string {
  return `
    <div style="padding: 2rem; text-align: center; color: #666;">
      Email not found
    </div>
  `;
}

function renderEmpty(): string {
  return `
    <div style="padding: 2rem; text-align: center; color: #666;">
      No emails yet. Send an email to see it here.
    </div>
  `;
}

const DEFAULT_STORAGE_PATH = "./.mailer-storage.json";

export function makeDevmailHandler(options: DevmailOptions = {}) {
  const prefix = options.prefix ?? "/devmail";
  const storagePath = options.storagePath ?? DEFAULT_STORAGE_PATH;

  const handler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const emails = readEmails(storagePath);

    // If no id and we have emails, redirect to first one
    const firstEmail = emails[0];
    if (!id && firstEmail) {
      return Response.redirect(
        `${url.origin}${prefix}?id=${firstEmail.id}`,
        302,
      );
    }

    let content: string;
    if (emails.length === 0) {
      content = renderEmpty();
    } else if (id) {
      const email = emails.find((e) => e.id === id);
      content = email ? renderEmail(email) : renderNotFound();
    } else {
      content = renderEmpty();
    }

    const html = renderLayout(content, emails, id ?? undefined);
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  };

  return {
    [prefix]: handler,
  };
}
