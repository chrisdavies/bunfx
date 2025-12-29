import type { JSX } from "preact";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "preact/compat";

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
type NativeAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export type ButtonProps = NativeButtonProps & {
  href?: string;
  target?: NativeAnchorProps["target"];
  rel?: NativeAnchorProps["rel"];
  download?: NativeAnchorProps["download"];
};

export function Button({
  children,
  class: className,
  href,
  disabled,
  ...props
}: ButtonProps) {
  const position = className?.toString().includes("absolute") ? "" : "relative";
  const fullClass = `${className || ""} ${position} disabled:cursor-not-allowed`;

  if (href && !disabled) {
    const target = /https?:\/\//.test(href) ? "_blank" : props.target;
    const rel = target === "_blank" ? "noreferrer" : props.rel;
    return (
      <a
        target={target}
        rel={rel}
        {...(props as JSX.HTMLAttributes<HTMLAnchorElement>)}
        href={href}
        class={fullClass}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={props.onClick ? "button" : "submit"}
      {...(props as JSX.HTMLAttributes<HTMLButtonElement>)}
      class={fullClass}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
