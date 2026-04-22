"use client";

import { useEffect, useState } from "react";
import type { ChannelMessage, Message, MessageReactionSummary } from "@nottermost/shared";
import { apiFetch } from "../../lib/api";
import { Button } from "../ui/Button";
import { TextArea } from "../ui/Input";

const QUICK = ["👍", "❤️", "😄", "🎉", "👀"];

type Common = {
  myUserId: string | null;
  onError: (err: string) => void;
};

type ChannelProps = Common & {
  variant: "channel";
  channelId: string;
  message: ChannelMessage;
  showReply?: boolean;
  onOpenThread?: () => void;
};

type DmProps = Common & {
  variant: "dm";
  threadId: string;
  message: Message;
};

type Props = ChannelProps | DmProps;

export function ChatMessageRow(props: Props) {
  const { myUserId, onError, message, variant } = props;
  const replyCount = variant === "channel" ? (message as ChannelMessage).replyCount : undefined;
  const lastReplyAt = variant === "channel" ? (message as ChannelMessage).lastReplyAt : undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(message.body);
  }, [message.body, message.id, editing]);

  const isMine = myUserId !== null && message.senderId === myUserId;
  const deleted = Boolean(message.deletedAt);
  const reactions: MessageReactionSummary[] = message.reactions ?? [];

  async function toggleReaction(emoji: string) {
    const row = reactions.find((r) => r.emoji === emoji);
    const hasMine = Boolean(row?.me);
    try {
      if (variant === "channel") {
        const path = `/channels/${props.channelId}/messages/${message.id}/reactions`;
        if (hasMine) {
          await apiFetch(`${path}?emoji=${encodeURIComponent(emoji)}`, { method: "DELETE" });
        } else {
          await apiFetch(path, { method: "POST", body: JSON.stringify({ emoji }) });
        }
      } else {
        const path = `/dm/threads/${props.threadId}/messages/${message.id}/reactions`;
        if (hasMine) {
          await apiFetch(`${path}?emoji=${encodeURIComponent(emoji)}`, { method: "DELETE" });
        } else {
          await apiFetch(path, { method: "POST", body: JSON.stringify({ emoji }) });
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "reaction_failed");
    }
  }

  async function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (variant === "channel") {
        await apiFetch(`/channels/${props.channelId}/messages/${message.id}`, {
          method: "PATCH",
          body: JSON.stringify({ body: trimmed }),
        });
      } else {
        await apiFetch(`/dm/threads/${props.threadId}/messages/${message.id}`, {
          method: "PATCH",
          body: JSON.stringify({ body: trimmed }),
        });
      }
      setEditing(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "edit_failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeMessage() {
    if (!window.confirm("Delete this message?")) return;
    try {
      if (variant === "channel") {
        await apiFetch(`/channels/${props.channelId}/messages/${message.id}`, { method: "DELETE" });
      } else {
        await apiFetch(`/dm/threads/${props.threadId}/messages/${message.id}`, { method: "DELETE" });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "delete_failed");
    }
  }

  return (
    <div className="col" style={{ gap: 4, paddingBottom: 8, borderBottom: "1px solid rgba(17,24,39,0.06)" }}>
      <div className="muted" style={{ fontSize: 12 }}>
        {message.senderId} · {new Date(message.createdAt).toLocaleString()}
        {message.editedAt ? <span> · edited</span> : null}
      </div>

      {editing && isMine && !deleted ? (
        <div className="col" style={{ gap: 8 }}>
          <TextArea value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" disabled={saving || !draft.trim()} onClick={() => void saveEdit()}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(message.body);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : deleted ? (
        <div className="muted" style={{ fontStyle: "italic" }}>
          This message was deleted.
        </div>
      ) : (
        <div style={{ whiteSpace: "pre-wrap" }}>{message.body}</div>
      )}

      {message.attachments?.length ? (
        <div className="col" style={{ gap: 6, marginTop: 4 }}>
          {message.attachments.map((a) => (
            <a key={a.id} className="uiLink" href={a.url} target="_blank" rel="noreferrer">
              {a.filename}
            </a>
          ))}
        </div>
      ) : null}

      {!deleted ? (
        <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
          {reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              className={["reactionChip", r.me ? "reactionChip--me" : ""].filter(Boolean).join(" ")}
              title={r.me ? "Remove your reaction" : "Add reaction"}
              onClick={() => void toggleReaction(r.emoji)}
            >
              <span>{r.emoji}</span> <span className="muted">{r.count}</span>
            </button>
          ))}
          {QUICK.map((e) =>
            reactions.some((r) => r.emoji === e) ? null : (
              <button
                key={`add-${e}`}
                type="button"
                className="reactionChip reactionChip--ghost"
                onClick={() => void toggleReaction(e)}
              >
                {e}
              </button>
            ),
          )}
        </div>
      ) : null}

      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        {variant === "channel" && props.showReply && props.onOpenThread ? (
          <Button size="sm" variant="secondary" type="button" onClick={props.onOpenThread}>
            Reply{replyCount ? ` · ${replyCount}` : ""}
          </Button>
        ) : null}
        {variant === "channel" && props.showReply && lastReplyAt ? (
          <span className="muted" style={{ fontSize: 12 }}>
            last reply {new Date(lastReplyAt).toLocaleString()}
          </span>
        ) : null}

        {isMine && !deleted && !editing ? (
          <>
            <Button size="sm" variant="secondary" type="button" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={() => void removeMessage()}>
              Delete
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
