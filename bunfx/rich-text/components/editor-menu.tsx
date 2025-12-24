import { Button, useEsc } from '../ui';
import { IcoDotsHorizontal, IcoTrash, IcoX } from '../icons';
import { useSignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';

export function ColorMenuItem({
  name,
  value,
  onPick,
  children,
}: {
  name: string;
  value?: string;
  onPick(color: string): void;
  children?: ComponentChildren;
}) {
  return (
    <MenuLabel>
      {children && <span>{children}</span>}
      <span class="flex items-center gap-2">
        {!value && (
          <span class="rounded-md px-1 text-xs font-medium border" style={{ background: value }}>
            Default
          </span>
        )}
        <input
          type="color"
          name={name}
          class="opacity-0 size-1 absolute top-0 left-0"
          value={value}
          onInput={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPick((e.target as HTMLInputElement).value);
          }}
        />
        {value && (
          <>
            <Button
              class="rounded-md px-1 text-xs font-medium border"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPick('');
              }}
            >
              Reset
            </Button>
            <span
              class="size-6 rounded-full inline-block shrink-0 ring-1 ring-offset-2 ring-gray-300"
              style={{ background: value }}
            ></span>
          </>
        )}
      </span>
    </MenuLabel>
  );
}

export function MenuRadioLabel(props: {
  onClick(): void;
  checked?: boolean;
  name: string;
  value?: string;
  children: ComponentChildren;
}) {
  return (
    <label
      class={`flex items-center text-sm font-medium text-gray-600 p-1 px-2 gap-4 cursor-pointer rounded-md transition-all relative ${props.checked ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
      onClick={props.onClick}
    >
      <input
        type="radio"
        class="hidden"
        name={props.name}
        value={props.value}
        checked={props.checked}
      />
      {props.children}
    </label>
  );
}

export type MenuChoice = { value: string; isDefault?: boolean; label: ComponentChildren };

export function MenuRadioSet(props: {
  name: string;
  value: string | undefined;
  onClick(value: string): void;
  choices: MenuChoice[];
}) {
  return (
    <MenuRadioGroup>
      {props.choices.map((c) => (
        <MenuRadioLabel
          key={c.value}
          name={props.name}
          checked={props.value === c.value || (!props.value && c.isDefault)}
          onClick={() => {
            props.onClick(c.value);
          }}
        >
          {c.label}
        </MenuRadioLabel>
      ))}
    </MenuRadioGroup>
  );
}

export function MenuRadioGroup(props: { children: ComponentChildren }) {
  return <div class="inline-flex gap-2 p-1 bg-gray-100 rounded-md">{props.children}</div>;
}

export function MenuItem(props: { title: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="flex items-center justify-between gap-4 p-2">
      <span>{props.title}</span>
      {props.children}
    </div>
  );
}

export function MenuSection(props: { title: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="flex flex-col">
      <strong class="p-2">{props.title}</strong>
      {props.children}
    </div>
  );
}

export function MenuDivider() {
  return <hr class="my-4 border-dashed" />;
}

export function MenuDelete(props: { title: ComponentChildren; onDelete(): void }) {
  return (
    <label class="flex items-center p-2 text-red-500 justify-between gap-4 cursor-pointer rounded-md hover:bg-red-100 hover:text-red-600 transition-all">
      <span>{props.title}</span>
      <input
        type="button"
        class="absolute opacity-0"
        name="deleteSection"
        onClick={props.onDelete}
      />
      <IcoTrash />
    </label>
  );
}

export function MenuLabel(props: { children: ComponentChildren }) {
  return (
    <label class="flex items-center p-2 justify-between gap-4 cursor-pointer rounded-md dark:hover:bg-gray-700/50 hover:bg-gray-100 transition-all">
      {props.children}
    </label>
  );
}

export function EditorMenu(props: { render(): JSX.Element }) {
  const showMenu = useSignal(false);
  useEsc(() => (showMenu.value = false));
  return (
    <div class="absolute -top-3 left-4 text-left">
      <Button
        class="bg-white/50 backdrop-blur-sm hover:bg-white hover:shadow-lg text-gray-800 rounded-md p-1 px-2 ring-1 ring-gray-300 hover:ring-2 hover:ring-gray-200 hover:scale-110 active:translate-y-0.5 transition-all"
        onClick={(e) => {
          e.stopPropagation();
          showMenu.value = !showMenu.value;
        }}
      >
        <IcoDotsHorizontal class="size-4" />
      </Button>
      {showMenu.value && (
        <nav
          class="absolute top-full min-w-80 rounded-xl border bg-white text-gray-800 shadow-2xl an-fade-in-bottom p-4 text-sm z-50"
          onClick={(e) => e.stopPropagation()}
          onBeforeInput={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onInput={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <Button
            class="text-lg rounded-md p-1 aspect-square inline-flex items-center justify-center absolute top-5 right-5 hover:bg-gray-100 transition-all"
            title="Close menu"
            onClick={() => {
              showMenu.value = false;
            }}
          >
            <IcoX />
          </Button>
          {props.render()}
        </nav>
      )}
    </div>
  );
}
