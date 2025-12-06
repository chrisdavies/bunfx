import type { LoaderArgs, PageArgs } from "bunfx";
import { ClientError, makeRPCClient } from "bunfx";
import type { RPC } from "../server/rpc";

const rpc = makeRPCClient<RPC>();

type LoaderData =
  | { status: "success"; email: string }
  | { status: "error"; error: string; code?: string };

export async function load({ searchParams }: LoaderArgs): Promise<LoaderData> {
  const userId = searchParams.user;
  const code = searchParams.code;

  if (!userId || !code) {
    return { status: "error", error: "Invalid login link" };
  }

  try {
    const result = await rpc.auth.verifyLoginCode({ userId, code });
    return { status: "success", email: result.email };
  } catch (err) {
    if (err instanceof ClientError) {
      return { status: "error", error: err.message, code: err.code };
    }
    return { status: "error", error: "Something went wrong" };
  }
}

export function Page({ state }: PageArgs<typeof load>) {
  const data = state.value;

  if (data.status === "error") {
    const isExpired = data.code === "expired";
    return (
      <div class="p-8 max-w-md mx-auto">
        <h1 class="text-2xl font-bold mb-4 text-red-600">
          {isExpired ? "Link expired" : "Login failed"}
        </h1>
        <p class="text-gray-600 mb-4">
          {isExpired
            ? "Your login link has expired. Please request a new one."
            : data.error}
        </p>
        <a href="/login" class="text-blue-600 hover:underline">
          {isExpired ? "Request new link" : "Try again"}
        </a>
      </div>
    );
  }

  return (
    <div class="p-8 max-w-md mx-auto">
      <h1 class="text-2xl font-bold mb-4 text-green-600">Welcome!</h1>
      <p class="text-gray-600 mb-4">
        You're now signed in as <strong>{data.email}</strong>
      </p>
      <a href="/" class="text-blue-600 hover:underline">
        Go to home
      </a>
    </div>
  );
}
