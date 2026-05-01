import type { IntentTreeItem } from "../treeview/intentTreeProvider";
import { IntentQueue } from "../queue/intentQueue";
import type { IntentTreeProvider } from "../treeview/intentTreeProvider";

export function createApproveIntentHandler(provider: IntentTreeProvider) {
  return (item: IntentTreeItem) => {
    if (!item?.intent) return;
    IntentQueue.update(item.intent.id, { status: "approved" });
    provider.refresh();
  };
}
