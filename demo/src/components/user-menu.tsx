import { useSignal, useSignalEffect } from "@preact/signals";
import { useRef } from "preact/hooks";
import { rpc } from "../rpc";
import { IcoChevronDown } from "./icons";

type UserMenuProps = {
  email: string;
};

async function handleLogout() {
  await rpc.auth.logout({});
  window.location.href = "/";
}

export function UserMenu({ email }: UserMenuProps) {
  const isOpen = useSignal(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = email.split("@")[0];

  useSignalEffect(() => {
    if (!isOpen.value) {
      return;
    }
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        isOpen.value = false;
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        isOpen.value = false;
      }
    }
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  });

  return (
    <div ref={menuRef} class="relative">
      <button
        type="button"
        onClick={() => {
          isOpen.value = !isOpen.value;
        }}
        aria-expanded={isOpen.value}
        aria-haspopup="menu"
        aria-label={`User menu for ${email}`}
        class="flex items-center gap-2 text-sm text-text-muted hover:text-text transition-colors"
      >
        <span>{displayName}</span>
        <IcoChevronDown
          class={`w-4 h-4 transition-transform ${isOpen.value ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen.value && (
        <div
          role="menu"
          aria-label="User menu"
          class="absolute right-0 mt-2 w-48 bg-bg-subtle border border-border rounded-lg shadow-lg overflow-hidden z-10"
        >
          <div class="px-4 py-2 text-xs text-text-muted border-b border-border">
            {email}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            class="w-full px-4 py-2 text-left text-sm hover:bg-bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
