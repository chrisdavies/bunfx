import type { ComponentChildren, JSX } from "preact";

type ButtonVariant = "primary" | "secondary";

type BaseProps = {
  variant?: ButtonVariant;
  class?: string;
  children?: ComponentChildren;
};

type ButtonAsButton = BaseProps &
  Omit<JSX.IntrinsicElements["button"], "class"> & {
    href?: never;
    loading?: boolean;
  };

type ButtonAsAnchor = BaseProps &
  Omit<JSX.IntrinsicElements["a"], "class"> & {
    href: string;
    loading?: never;
  };

type ButtonProps = ButtonAsButton | ButtonAsAnchor;

export function Button(props: ButtonProps) {
  const { variant = "primary", children, class: className, ...rest } = props;
  const variantClass = variant === "primary" ? "btn-primary" : "btn-secondary";
  const classes = `${variantClass} ${className ?? ""}`;

  if ("href" in rest && rest.href) {
    return (
      <a
        class={classes}
        {...(rest as Omit<JSX.IntrinsicElements["a"], "class">)}
      >
        {children}
      </a>
    );
  }

  const { loading, disabled, ...buttonRest } = rest as ButtonAsButton;
  return (
    <button
      class={classes}
      disabled={disabled || loading}
      aria-busy={loading}
      {...buttonRest}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}
