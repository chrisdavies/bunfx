import { useSignal } from "@preact/signals";
import { Button, Input } from "../components";
import { rpc } from "../rpc";

export async function load() {
  const user = await rpc.auth.me({});
  if (user) {
    window.location.href = "/";
  }
}

export function Page() {
  const email = useSignal("");
  const status = useSignal<"idle" | "sending" | "sent" | "error">("idle");
  const errorMessage = useSignal("");

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!email.value) return;

    status.value = "sending";
    errorMessage.value = "";

    try {
      await rpc.auth.sendLoginCode({ email: email.value });
      status.value = "sent";
    } catch (err) {
      status.value = "error";
      errorMessage.value =
        err instanceof Error ? err.message : "Something went wrong";
    }
  }

  if (status.value === "sent") {
    return (
      <div class="min-h-screen flex items-center justify-center p-4">
        <div class="card max-w-md w-full text-center">
          <div class="text-4xl mb-4">✉️</div>
          <h1 class="text-xl font-semibold mb-2">Check your email</h1>
          <p class="text-text-muted">
            We sent a login link to{" "}
            <strong class="text-text">{email.value}</strong>. Click the link to
            sign in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="card max-w-md w-full">
        <h1 class="text-xl font-semibold mb-6">Sign in to Secrets</h1>
        <form onSubmit={handleSubmit} class="flex flex-col gap-4">
          <Input
            type="email"
            label="Email"
            value={email.value}
            onInput={(e) => {
              email.value = (e.target as HTMLInputElement).value;
            }}
            placeholder="you@example.com"
            error={status.value === "error" ? errorMessage.value : undefined}
            required
          />
          <Button
            type="submit"
            class="w-full"
            loading={status.value === "sending"}
          >
            Send login link
          </Button>
        </form>
      </div>
    </div>
  );
}
