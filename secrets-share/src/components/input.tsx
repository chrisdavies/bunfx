import type { JSX } from "preact";

type InputProps = Omit<JSX.IntrinsicElements["input"], "class"> & {
  label?: string;
  error?: string;
  class?: string;
};

export function Input({
  label,
  error,
  id,
  class: className,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div class="flex flex-col gap-1.5">
      {label && (
        <label class="label" for={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        class={`input ${error ? "border-danger" : ""} ${className ?? ""}`}
        {...props}
      />
      {error && <p class="text-sm text-danger">{error}</p>}
    </div>
  );
}
