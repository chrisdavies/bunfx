import { useSignal } from "@preact/signals";
import type { PageArgs } from "bunfx";
import { Button, CopyButton, Input, Textarea, UserMenu } from "../components";
import { encryptSecret } from "../crypto";
import { rpc } from "../rpc";

type User = { id: string; email: string };

export async function load() {
  return { user: await rpc.auth.me({}) };
}

const EXPIRATION_OPTIONS = [
  { value: 5, label: "5 minutes" },
  { value: 60, label: "1 hour" },
  { value: 1440, label: "1 day" },
  { value: 10080, label: "7 days" },
  { value: 43200, label: "30 days" },
];

const DOWNLOAD_OPTIONS = [1, 2, 3, 5, 10, 25, 50, 100];

function AuthenticatedHome({ user }: { user: User }) {
  const secretText = useSignal("");
  const expiresIn = useSignal(10080); // 7 days in minutes
  const maxDownloads = useSignal(1);
  const status = useSignal<"idle" | "creating" | "created" | "error">("idle");
  const errorMessage = useSignal("");
  const shareUrl = useSignal("");

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!secretText.value.trim()) return;

    status.value = "creating";
    errorMessage.value = "";

    try {
      const { encrypted, key } = await encryptSecret(secretText.value);

      const result = await rpc.secrets.create({
        encryptedContent: encrypted,
        expiresInMinutes: expiresIn.value,
        maxDownloads: maxDownloads.value,
      });

      const baseUrl = window.location.origin;
      shareUrl.value = `${baseUrl}/s/${result.id}?code=${result.code}#${key}`;
      status.value = "created";
    } catch (err) {
      status.value = "error";
      errorMessage.value =
        err instanceof Error ? err.message : "Something went wrong";
    }
  }

  function resetForm() {
    secretText.value = "";
    shareUrl.value = "";
    status.value = "idle";
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="card max-w-lg w-full">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-xl font-semibold">Share a secret</h1>
          <UserMenu email={user.email} />
        </div>

        {status.value === "created" ? (
          <div class="flex flex-col gap-4">
            <div class="text-center">
              <div class="text-4xl mb-4">🔐</div>
              <h2 class="text-xl font-semibold mb-2">Secret created!</h2>
              <p class="text-text-muted text-sm">
                Share this link. It will expire after{" "}
                {maxDownloads.value === 1
                  ? "1 view"
                  : `${maxDownloads.value} views`}
                .
              </p>
            </div>

            <Input
              value={shareUrl.value}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />

            <div class="grid grid-cols-2 gap-4">
              <CopyButton value={shareUrl.value} />
              <Button variant="secondary" onClick={resetForm}>
                Create another
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} class="flex flex-col gap-4">
            <Textarea
              label="Secret"
              placeholder="Paste your secret here..."
              value={secretText.value}
              onInput={(e) => {
                secretText.value = (e.target as HTMLTextAreaElement).value;
              }}
              autoGrow
              class="min-h-[120px]"
              required
            />

            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="label" for="expires-in">
                  Expires in
                </label>
                <select
                  id="expires-in"
                  class="input"
                  value={expiresIn.value}
                  onChange={(e) => {
                    expiresIn.value = Number(
                      (e.target as HTMLSelectElement).value,
                    );
                  }}
                >
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="label" for="max-downloads">
                  Max downloads
                </label>
                <select
                  id="max-downloads"
                  class="input"
                  value={maxDownloads.value}
                  onChange={(e) => {
                    maxDownloads.value = Number(
                      (e.target as HTMLSelectElement).value,
                    );
                  }}
                >
                  {DOWNLOAD_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {status.value === "error" && (
              <p class="text-sm text-danger">{errorMessage.value}</p>
            )}

            <Button
              type="submit"
              class="w-full"
              loading={status.value === "creating"}
            >
              Create secret link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function UnauthenticatedHome() {
  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="card max-w-md w-full text-center">
        <div class="text-4xl mb-4">🔐</div>
        <h1 class="text-2xl font-semibold mb-2">Secrets</h1>
        <p class="text-text-muted mb-6">
          Share sensitive information securely. End-to-end encrypted,
          self-destructing links.
        </p>
        <Button href="/login" class="w-full">
          Sign in to get started
        </Button>
      </div>
    </div>
  );
}

export function Page({ state }: PageArgs<typeof load>) {
  const { user } = state.value;
  return user ? <AuthenticatedHome user={user} /> : <UnauthenticatedHome />;
}
