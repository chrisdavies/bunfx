import { useSignal } from "@preact/signals";
import { Button } from "./button";
import { IcoCheck } from "./icons";

type CopyButtonProps = {
  value: string;
  class?: string;
};

export function CopyButton({ value, class: className }: CopyButtonProps) {
  const copied = useSignal(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }

  return (
    <Button
      onClick={handleCopy}
      class={className}
      aria-label="Copy to clipboard"
    >
      {copied.value ? (
        <output class="flex items-center justify-center gap-1.5">
          <IcoCheck />
          Copied
        </output>
      ) : (
        "Copy"
      )}
    </Button>
  );
}
