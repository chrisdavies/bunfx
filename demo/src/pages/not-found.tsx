import { Button } from "../components";

export function Page() {
  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="card max-w-md w-full text-center">
        <div class="text-4xl mb-4">404</div>
        <h1 class="text-xl font-semibold mb-2">Page not found</h1>
        <p class="text-text-muted mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button href="/" variant="secondary" class="w-full">
          Go home
        </Button>
      </div>
    </div>
  );
}
