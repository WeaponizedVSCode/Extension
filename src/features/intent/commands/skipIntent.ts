import { IntentQueue } from "../queue/intentQueue";
import type { IntentTreeProvider } from "../treeview/intentTreeProvider";

export function skipIntent(treeProvider: IntentTreeProvider) {
  return (item: { intent?: { id: string } }) => {
    if (!item?.intent?.id) {
      return;
    }
    IntentQueue.update(item.intent.id, {
      status: "dismissed",
      dismissed_reason: "Skipped by user",
    });
    treeProvider.refresh();
  };
}
