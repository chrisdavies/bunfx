// biome-ignore-all lint/a11y/noSvgWithoutTitle: decorative icons with aria-hidden
import type { JSX } from "preact";

type IconProps = Omit<JSX.IntrinsicElements["svg"], "class"> & {
  class?: string;
};

const defaults: IconProps = {
  class: "w-4 h-4",
  fill: "none",
  stroke: "currentColor",
  viewBox: "0 0 24 24",
  "aria-hidden": "true",
};

export function IcoCheck({ class: className, ...props }: IconProps) {
  return (
    <svg {...defaults} class={className ?? defaults.class} {...props}>
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export function IcoChevronDown({ class: className, ...props }: IconProps) {
  return (
    <svg {...defaults} class={className ?? defaults.class} {...props}>
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}
