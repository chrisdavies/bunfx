import { signal } from "@preact/signals";
import { makeRPCClient } from "bunfx/rpc/client";
import type { RPC } from "../server/rpc";

const rpc = makeRPCClient<RPC>();

const email = signal("");
const status = signal<"idle" | "sending" | "sent" | "error">("idle");
const errorMessage = signal("");

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

export function Page() {
  if (status.value === "sent") {
    return (
      <div class="p-8 max-w-md mx-auto">
        <h1 class="text-2xl font-bold mb-4">Check your email</h1>
        <p class="text-gray-600">
          We sent a login link to <strong>{email.value}</strong>. Click the link
          to sign in.
        </p>
      </div>
    );
  }

  return (
    <div class="p-8 max-w-md mx-auto">
      <h1 class="text-2xl font-bold mb-4">Sign in</h1>
      <form onSubmit={handleSubmit}>
        <label class="block mb-4">
          <span class="block text-sm font-medium mb-1">Email</span>
          <input
            type="email"
            value={email.value}
            onInput={(e) => {
              email.value = (e.target as HTMLInputElement).value;
            }}
            class="w-full px-3 py-2 border rounded-md"
            placeholder="you@example.com"
            required
          />
        </label>
        {status.value === "error" && (
          <p class="text-red-600 text-sm mb-4">{errorMessage.value}</p>
        )}
        <button
          type="submit"
          disabled={status.value === "sending"}
          class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {status.value === "sending" ? "Sending..." : "Send login link"}
        </button>
      </form>
    </div>
  );
}
