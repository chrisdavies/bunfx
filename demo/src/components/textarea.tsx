import { useSignal } from "@preact/signals";
import type { JSX, TargetedKeyboardEvent } from "preact";

type TextareaProps = Omit<JSX.IntrinsicElements["textarea"], "class"> & {
  label?: string;
  error?: string;
  autoGrow?: boolean;
  class?: string;
};

function handleKeyDown(e: TargetedKeyboardEvent<HTMLTextAreaElement>) {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  }
}

export function Textarea({
  label,
  error,
  autoGrow,
  id,
  class: className,
  ...props
}: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const inputClass = `input resize-none ${error ? "border-danger" : ""} ${className ?? ""}`;
  const content = useSignal(String(props.value ?? ""));

  return (
    <div class="flex flex-col gap-1.5">
      {label && (
        <label class="label" for={inputId}>
          {label}
        </label>
      )}
      {autoGrow ? (
        <div class="autosize">
          <textarea
            id={inputId}
            class={`${inputClass} autosize-textarea`}
            onKeyDown={handleKeyDown}
            onInput={(e) => {
              content.value = e.currentTarget.value;
              props.onInput?.(e);
            }}
            {...props}
          />
          <pre class={`${inputClass} autosize-pre`}>
            {content.value}
            <br />
          </pre>
        </div>
      ) : (
        <textarea
          id={inputId}
          class={inputClass}
          onKeyDown={handleKeyDown}
          {...props}
        />
      )}
      {error && <p class="text-sm text-danger">{error}</p>}
    </div>
  );
}
