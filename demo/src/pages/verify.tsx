import type { LoaderArgs, PageArgs } from "bunfx";
import { ClientError } from "bunfx";
import { Button } from "../components";
import { IcoCheck } from "../components/icons";
import { rpc } from "../rpc";

type LoaderData =
  | { status: "success"; email: string }
  | { status: "error"; error: string; code?: string };

export async function load({ searchParams }: LoaderArgs): Promise<LoaderData> {
  // If already authenticated, redirect to home
  const existingUser = await rpc.auth.me({});
  if (existingUser) {
    window.location.href = "/";
    return { status: "success", email: existingUser.email };
  }

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
      <div class="min-h-screen flex items-center justify-center p-4">
        <div class="card max-w-md w-full text-center">
          <div class="text-4xl mb-4">❌</div>
          <h1 class="text-xl font-semibold mb-2 text-danger">
            {isExpired ? "Link expired" : "Login failed"}
          </h1>
          <p class="text-text-muted mb-6">
            {isExpired
              ? "Your login link has expired. Please request a new one."
              : data.error}
          </p>
          <Button href="/login" variant="secondary" class="w-full">
            {isExpired ? "Request new link" : "Try again"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="card max-w-md w-full text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
          <IcoCheck class="w-8 h-8 text-success" stroke-width="2.5" />
        </div>
        <h1 class="text-xl font-semibold mb-2 text-success">Welcome!</h1>
        <p class="text-text-muted mb-6">
          You're now signed in as{" "}
          <strong class="text-text">{data.email}</strong>
        </p>
        <Button href="/" class="w-full">
          Continue
        </Button>
      </div>
    </div>
  );
}
