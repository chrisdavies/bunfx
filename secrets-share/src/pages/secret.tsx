import { useSignal } from "@preact/signals";
import type { LoaderArgs, PageArgs } from "bunfx";
import { ClientError } from "bunfx";
import { Button, CopyButton } from "../components";
import { decryptSecret } from "../crypto";
import { rpc } from "../rpc";

type LoaderData =
  | { status: "success"; decryptedContent: string }
  | { status: "error"; error: string };

export async function load({
  params,
  searchParams,
  url,
}: LoaderArgs): Promise<LoaderData> {
  const id = params.id;
  const code = searchParams.code;
  const keyBase64 = url.hash.slice(1); // Remove the #

  if (!id || !code) {
    return { status: "error", error: "Invalid secret link" };
  }

  if (!keyBase64) {
    return { status: "error", error: "Missing decryption key" };
  }

  try {
    const result = await rpc.secrets.get({ id, code });
    const decryptedContent = await decryptSecret(
      result.encryptedContent,
      keyBase64,
    );
    return { status: "success", decryptedContent };
  } catch (err) {
    if (err instanceof ClientError) {
      return { status: "error", error: err.message };
    }
    return { status: "error", error: "Failed to retrieve secret" };
  }
}

export function Page({ state }: PageArgs<typeof load>) {
  const showSecret = useSignal(false);
  const data = state.value;

  if (data.status === "error") {
    return (
      <div class="min-h-screen flex items-center justify-center p-4">
        <div class="card max-w-md w-full text-center">
          <div class="text-4xl mb-4">❌</div>
          <h1 class="text-xl font-semibold mb-2 text-danger">
            Secret unavailable
          </h1>
          <p class="text-text-muted mb-6">{data.error}</p>
          <Button href="/" variant="secondary" class="w-full">
            Go home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="card max-w-lg w-full">
        <div class="text-center mb-6">
          <div class="text-4xl mb-4">🔓</div>
          <h1 class="text-xl font-semibold">Secret revealed</h1>
          <p class="text-text-muted text-sm mt-1">
            This secret may no longer be available after you leave this page.
          </p>
        </div>

        {showSecret.value ? (
          <pre class="bg-bg-muted border border-border rounded-lg p-4 overflow-x-auto text-sm whitespace-pre-wrap break-all mb-4">
            {data.decryptedContent}
          </pre>
        ) : (
          <button
            type="button"
            onClick={() => {
              showSecret.value = true;
            }}
            class="w-full bg-bg-muted border border-border rounded-lg p-4 text-center text-text-muted mb-4 hover:border-border-focus cursor-pointer"
          >
            Secret is hidden. Click{" "}
            <span class="text-primary font-medium">Show</span> to reveal.
          </button>
        )}

        <div class="grid grid-cols-2 gap-4">
          <CopyButton value={data.decryptedContent} />
          <Button
            variant="secondary"
            onClick={() => {
              showSecret.value = !showSecret.value;
            }}
            aria-pressed={showSecret.value}
          >
            {showSecret.value ? "Hide" : "Show"}
          </Button>
        </div>
      </div>
    </div>
  );
}
