import { IcoCheck } from '../icons';
import type { PresetName } from './presets';
import { presetLabels, presets } from './presets';
import type { Theme } from './index';

type ThemeSwatchProps = {
  theme: Theme;
  label: string;
  selected?: boolean;
  onClick(): void;
};

function ThemeSwatch({ theme, label, selected, onClick }: ThemeSwatchProps) {
  const coverBg = theme.root['theme-cover-bg'] || '#3b82f6';
  const coverFg = theme.root['theme-cover-fg'] || '#ffffff';
  const ctaBg = theme.root['theme-cta-bg'] || '#3b82f6';
  const blockBg = theme.root['theme-rich-block-bg'] || '#f3f4f6';

  return (
    <button
      type="button"
      class={`group relative flex flex-col rounded-xl overflow-hidden transition-all ${
        selected
          ? 'ring-2 ring-indigo-500 ring-offset-2'
          : 'ring-1 ring-gray-200 hover:ring-gray-300 hover:shadow-md'
      }`}
      onClick={onClick}
    >
      <div class="flex h-24">
        <div
          class="w-1/3 flex items-center justify-center"
          style={{ backgroundColor: coverBg, color: coverFg }}
        >
          <span class="text-lg font-bold opacity-90">Aa</span>
        </div>
        <div class="w-2/3 bg-white p-2 flex flex-col gap-1.5">
          <div class="h-1.5 w-3/4 rounded-full bg-gray-300" />
          <div class="h-1 w-full rounded-full bg-gray-200" />
          <div class="h-1 w-5/6 rounded-full bg-gray-200" />
          <div
            class="flex-1 rounded mt-1 flex items-center justify-center"
            style={{ backgroundColor: blockBg }}
          >
            <div class="flex gap-1">
              <div class="h-1 w-4 rounded-full bg-gray-400 opacity-50" />
              <div class="h-1 w-3 rounded-full bg-gray-400 opacity-50" />
            </div>
          </div>
          <div class="h-3 w-12 rounded-sm mx-auto" style={{ backgroundColor: ctaBg }} />
        </div>
      </div>
      <div
        class={`px-3 py-2 text-sm font-medium text-center border-t ${
          selected
            ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
            : 'bg-gray-50 text-gray-700 border-gray-100'
        }`}
      >
        {label}
      </div>
      {selected && (
        <div class="absolute top-2 right-2 size-5 rounded-full bg-indigo-500 flex items-center justify-center">
          <IcoCheck class="size-3 text-white" />
        </div>
      )}
    </button>
  );
}

type ThemePickerProps = {
  currentPreset?: PresetName;
  onSelect(preset: PresetName): void;
};

export function ThemePicker({ currentPreset, onSelect }: ThemePickerProps) {
  return (
    <div class="flex flex-col gap-4">
      <div>
        <h3 class="text-sm font-semibold text-gray-900">Theme</h3>
        <p class="text-xs text-gray-500 mt-0.5">Choose a color scheme for your ebook</p>
      </div>
      <div class="flex flex-col gap-3">
        {(Object.keys(presets) as PresetName[]).map((name) => {
          const theme = presets[name];
          const label = presetLabels[name];
          if (!theme || !label) {
            return undefined;
          }
          return (
            <ThemeSwatch
              key={name}
              theme={theme}
              label={label}
              selected={currentPreset === name}
              onClick={() => onSelect(name)}
            />
          );
        })}
      </div>
    </div>
  );
}
