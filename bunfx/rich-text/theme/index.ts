export type ThemeVars =
  // CTA variables
  | 'theme-cta-bg'
  | 'theme-cta-fg'
  | 'theme-cta-padding'
  | 'theme-cta-rounding'
  | 'theme-cta-text-align'
  | 'theme-cta-block-padding'
  | 'theme-cta-block-align'
  // Rich block variables
  | 'theme-rich-block-bg'
  | 'theme-rich-block-fg'
  | 'theme-rich-block-fullbleed'
  | 'theme-rich-block-show-overlay'
  // Cover variables
  | 'theme-cover-bg'
  | 'theme-cover-fg'
  // Table of contents variables
  | 'theme-toc-bg'
  | 'theme-toc-fg'
  | 'theme-toc-overlay'
  // Content section variables
  | 'theme-content-bg'
  | 'theme-content-fg';

export const cssVarNames: ThemeVars[] = [
  'theme-cta-bg',
  'theme-cta-fg',
  'theme-cta-padding',
  'theme-cta-rounding',
  'theme-cta-text-align',
  'theme-cta-block-padding',
  'theme-cta-block-align',
  'theme-rich-block-bg',
  'theme-rich-block-fg',
  'theme-rich-block-fullbleed',
  'theme-rich-block-show-overlay',
  'theme-cover-bg',
  'theme-cover-fg',
  'theme-toc-bg',
  'theme-toc-fg',
  'theme-toc-overlay',
  'theme-content-bg',
  'theme-content-fg',
];

export type RichBlockTheme = {
  bg?: string;
  fg?: string;
  fullBleed?: boolean;
};

export type RichCtaTheme = {
  linkBg?: string;
  linkFg?: string;
};

export type Theme = {
  root: Partial<Record<ThemeVars, string>>;
  richBlock: RichBlockTheme;
  richCta: RichCtaTheme;
};

export function unsetCSSVars(el: HTMLElement) {
  for (const name of cssVarNames) {
    el.style.removeProperty('--' + name);
  }
}

export function setCSSVar(el: HTMLElement, name: string, value: string | undefined) {
  if (value) {
    el.style.setProperty(name, value);
  } else {
    el.style.removeProperty(name);
  }
}

export function writeCSSVars(el: HTMLElement, vars: Partial<Record<ThemeVars, string>>) {
  for (const [name, value] of Object.entries(vars)) {
    if (value) {
      el.style.setProperty('--' + name, value);
    }
  }
}

export function themeToStyleVars(vars: Partial<Record<ThemeVars, string>>): Record<string, string> {
  const style: Record<string, string> = {};
  for (const [name, value] of Object.entries(vars)) {
    if (value) {
      style['--' + name] = value;
    }
  }
  return style;
}

type RichBlockElement = HTMLElement & {
  state?: { value: { bg?: string; fg?: string; fullBleed?: boolean; columns?: string } };
};

type RichCtaElement = HTMLElement & {
  state?: { value: { linkBg?: string; linkFg?: string } };
};

export function applyTheme(theme: Theme, container: HTMLElement) {
  unsetCSSVars(container);
  writeCSSVars(container, theme.root);

  const richBlocks = container.querySelectorAll('rich-block');
  for (const block of richBlocks) {
    const el = block as RichBlockElement;
    if (el.state) {
      el.state.value = {
        ...el.state.value,
        ...theme.richBlock,
      };
    }
  }

  const richCtas = container.querySelectorAll('rich-cta');
  for (const cta of richCtas) {
    const el = cta as RichCtaElement;
    if (el.state) {
      el.state.value = {
        ...el.state.value,
        ...theme.richCta,
      };
    }
  }
}
