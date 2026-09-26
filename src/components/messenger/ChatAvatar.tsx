import { initials } from "@/lib/utils";
import type { ChatUser } from "@/types";

const STATUS_COLOR: Record<ChatUser["status"], string> = {
  ONLINE: "#1baf7a",
  AWAY: "#eda100",
  OFFLINE: "#898781",
};

export function ChatAvatar({
  user,
  size = 40,
  showStatus = false,
}: {
  user: ChatUser;
  size?: number;
  showStatus?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt=""
          className="h-full w-full rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{ backgroundColor: user.avatarColor, fontSize: size * 0.38 }}
        >
          {user.initials ?? initials(user.name)}
        </span>
      )}
      {showStatus && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-[var(--surface-card)]"
          style={{
            width: Math.max(10, size * 0.3),
            height: Math.max(10, size * 0.3),
            backgroundColor: STATUS_COLOR[user.status],
          }}
        />
      )}
    </span>
  );
}
