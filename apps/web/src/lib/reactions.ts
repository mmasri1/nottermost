import type { MessageReactionSummary, WsServerMessage } from "@nottermost/shared";

export function mergeReactionWs(
  myUserId: string | null,
  prev: MessageReactionSummary[] | undefined,
  msg: Extract<WsServerMessage, { type: "reaction.updated" }>,
): MessageReactionSummary[] {
  return msg.counts.map((c) => {
    const prevR = prev?.find((x) => x.emoji === c.emoji);
    let me = prevR?.me ?? false;
    if (c.emoji === msg.emoji && msg.actorUserId === myUserId) {
      me = msg.delta === "add";
    }
    return { emoji: c.emoji, count: c.count, me };
  });
}
