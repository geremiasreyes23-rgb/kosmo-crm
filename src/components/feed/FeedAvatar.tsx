import type { FeedAuthorVM } from "@/types";

export function FeedAvatar({ author, size = 40 }: { author: FeedAuthorVM; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={author.avatarUrl}
          alt=""
          className="h-full w-full rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{ backgroundColor: author.avatarColor, fontSize: size * 0.38 }}
        >
          {author.initials}
        </span>
      )}
    </span>
  );
}
