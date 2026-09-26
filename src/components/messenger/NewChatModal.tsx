"use client";

import { Modal } from "@/components/ui/Modal";
import { ChatAvatar } from "./ChatAvatar";
import type { ChatUser } from "@/types";

export function NewChatModal({
  open,
  onClose,
  availableUsers,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  availableUsers: ChatUser[];
  onPick: (userId: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Nuevo chat">
      {availableUsers.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--ink-muted)]">
          Ya tienes una conversación con todos los usuarios.
        </p>
      ) : (
        <div className="-mx-1 max-h-80 space-y-0.5 overflow-y-auto">
          {availableUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onPick(user.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
            >
              <ChatAvatar user={user} size={38} showStatus />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--ink-primary)]">{user.name}</p>
                <p className="truncate text-xs text-[var(--ink-muted)]">{user.role}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
