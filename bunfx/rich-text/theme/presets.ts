import type { Theme } from "./index";

export const EBOOK_OVERLAY_URL = "/imgs/ebook-overlay.svg";

export type PresetName = "default" | "dark" | "sage" | "professional";

export const defaultTheme: Theme = {
  root: {
    "theme-cta-bg": "#3b82f6",
    "theme-cta-fg": "#ffffff",
    "theme-rich-block-bg": "#f3f4f6",
    "theme-rich-block-fg": "#111827",
    "theme-cover-bg": "#3b82f6",
    "theme-cover-fg": "#ffffff",
  },
  richBlock: {
    bg: undefined,
    fg: undefined,
    fullBleed: true,
  },
  richCta: {
    linkBg: "#ffffff",
    linkFg: "#3b82f6",
  },
};

export const darkTheme: Theme = {
  root: {
    "theme-cta-bg": "#6366f1",
    "theme-cta-fg": "#ffffff",
    "theme-content-bg": "#111827",
    "theme-content-fg": "#f9fafb",
    "theme-rich-block-bg": "#1f2937",
    "theme-rich-block-fg": "#f9fafb",
    "theme-cover-bg": "#1f2937",
    "theme-cover-fg": "#f9fafb",
    "theme-toc-bg": "#0f172a",
    "theme-toc-fg": "#f9fafb",
    "theme-toc-overlay": EBOOK_OVERLAY_URL,
  },
  richBlock: {
    bg: undefined,
    fg: undefined,
    fullBleed: true,
  },
  richCta: {
    linkBg: "#818cf8",
    linkFg: "#ffffff",
  },
};

export const sageTheme: Theme = {
  root: {
    "theme-cta-bg": "#4a6741",
    "theme-cta-fg": "#ffffff",
    "theme-content-bg": "#f5f7f4",
    "theme-content-fg": "#2d3b29",
    "theme-rich-block-bg": "#dce5d8",
    "theme-rich-block-fg": "#2d3b29",
    "theme-cover-bg": "#4a6741",
    "theme-cover-fg": "#f5f7f4",
    "theme-toc-bg": "#3d5636",
    "theme-toc-fg": "#f5f7f4",
    "theme-toc-overlay": EBOOK_OVERLAY_URL,
  },
  richBlock: {
    bg: undefined,
    fg: undefined,
    fullBleed: true,
  },
  richCta: {
    linkBg: "#f5f7f4",
    linkFg: "#4a6741",
  },
};

export const professionalTheme: Theme = {
  root: {
    "theme-cta-bg": "#1e3a5f",
    "theme-cta-fg": "#ffffff",
    "theme-rich-block-bg": "#f0f4f8",
    "theme-rich-block-fg": "#1e3a5f",
    "theme-cover-bg": "#1e3a5f",
    "theme-cover-fg": "#fbbf24",
    "theme-toc-bg": "#152c4a",
    "theme-toc-fg": "#ffffff",
    "theme-toc-overlay": EBOOK_OVERLAY_URL,
  },
  richBlock: {
    bg: undefined,
    fg: undefined,
    fullBleed: true,
  },
  richCta: {
    linkBg: "#fbbf24",
    linkFg: "#1e3a5f",
  },
};

export const presets: Record<PresetName, Theme> = {
  default: defaultTheme,
  dark: darkTheme,
  sage: sageTheme,
  professional: professionalTheme,
};

export const presetLabels: Record<PresetName, string> = {
  default: "Default",
  dark: "Dark",
  sage: "Sage",
  professional: "Professional",
};
