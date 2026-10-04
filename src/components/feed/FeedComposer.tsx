"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { MentionTextarea } from "@/components/feed/MentionTextarea";
import { PersonSelect, userOptions } from "@/components/ui/PersonSelect";
import { FeedAvatar } from "@/components/feed/FeedAvatar";
import { createPostAction, type FeedAttachmentInput } from "@/lib/feed/actions";
import { formatBytes } from "@/lib/utils";
import type { FeedAudience, FeedAuthorVM, FeedUserOption } from "@/types";
import { AtSign, Paperclip, Smile, Send, X, FileText } from "lucide-react";

const QUICK_EMOJIS = ["😊", "🎉", "👍", "❤️", "🙌", "😂", "🔥", "👏"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function FeedComposer({
  currentUser,
  users,
  onPosted,
}: {
  currentUser: FeedAuthorVM;
  users: FeedUserOption[];
  onPosted: () => void;
}) {
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<FeedAudience>("EVERYONE");
  const [specificIds, setSpecificIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<(FeedAttachmentInput & { id: string })[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: (FeedAttachmentInput & { id: string })[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await readFileAsDataUrl(file);
      next.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        fileName: file.name,
        dataUrl,
        sizeBytes: file.size,
        mimeType: file.type || undefined,
      });
    }
    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSubmit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const result = await createPostAction({
      body,
      audience,
      specificUserIds: audience === "SPECIFIC" ? specificIds : undefined,
      attachments: attachments.length ? attachments.map(({ id: _id, ...rest }) => rest) : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo publicar.");
      return;
    }
    setBody("");
    setAttachments([]);
    setAudience("EVERYONE");
    setSpecificIds([]);
    onPosted();
  }

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <FeedAvatar author={currentUser} size={40} />
        <div className="min-w-0 flex-1">
          <MentionTextarea
            value={body}
            onChange={setBody}
            users={users}
            placeholder="¿Qué estás pensando?"
            rows={3}
            onSubmitShortcut={handleSubmit}
          />

          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-2.5 py-1.5 text-xs"
                >
                  <FileText size={14} className="shrink-0 text-[var(--ink-secondary)]" />
                  <span className="max-w-[160px] truncate text-[var(--ink-primary)]">{a.fileName}</span>
                  <span className="text-[var(--ink-secondary)]">{formatBytes(a.sizeBytes)}</span>
                  <button type="button" onClick={() => removeAttachment(a.id)} className="text-[var(--ink-secondary)] hover:text-[var(--status-critical)]">
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && <p className="mt-2 text-xs text-[var(--status-critical)]">{error}</p>}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Mencionar"
                onClick={() => setBody((prev) => `${prev}${prev.endsWith(" ") || prev.length === 0 ? "" : " "}@`)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
              >
                <AtSign size={16} />
              </button>
              <button
                type="button"
                title="Adjuntar"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
              >
                <Paperclip size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="relative">
                <button
                  type="button"
                  title="Emoji"
                  onClick={() => setShowEmoji((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  <Smile size={16} />
                </button>
                {showEmoji && (
                  <div className="absolute left-0 top-full z-20 mt-1 flex w-52 flex-wrap gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] p-2 shadow-lg">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setBody((prev) => `${prev}${emoji}`);
                          setShowEmoji(false);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-[var(--surface-hover)]"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Select
                value={audience}
                onChange={(e) => setAudience(e.target.value as FeedAudience)}
                className="!h-8 w-auto min-w-[8.5rem] text-xs"
              >
                <option value="EVERYONE">Todos</option>
                <option value="TEAM">Mi equipo</option>
                <option value="SPECIFIC">Usuarios específicos</option>
              </Select>

              {audience === "SPECIFIC" && (
                <PersonSelect
                  multiple
                  size="sm"
                  className="w-56"
                  value={specificIds}
                  onChange={setSpecificIds}
                  options={userOptions(users)}
                  placeholder="Elige usuarios..."
                />
              )}
            </div>

            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              <Send size={14} />
              Publicar
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
