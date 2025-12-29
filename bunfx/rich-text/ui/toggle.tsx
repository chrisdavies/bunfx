import type { JSX } from "preact";

type Props = JSX.InputHTMLAttributes<HTMLInputElement> & {
  defaultChecked?: HTMLInputElement["defaultChecked"];
};

export function Toggle(props: Props) {
  const { class: className = "", ...restOfProps } = props;
  return (
    <input {...restOfProps} class={`ctl-toggle ${className}`} type="checkbox" />
  );
}
