import { Fragment } from "react";
import { splitMentionSegments } from "@/lib/feed/mentions";

/** Renderiza el body de un post/comentario resaltando las menciones
 * @{userId:Nombre} como spans con acento morado — ver
 * src/lib/feed/mentions.ts para el formato del token. */
export function FeedMentionText({ text, className }: { text: string; className?: string }) {
  const segments = splitMentionSegments(text);
  return (
    <span className={className}>
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {seg.type === "mention" ? (
            <span className="font-medium text-[var(--brand-500)]">{seg.text}</span>
          ) : (
            seg.text
          )}
        </Fragment>
      ))}
    </span>
  );
}
