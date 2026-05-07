import { IntentQueue } from "../queue/intentQueue";
import type { IntentTreeProvider } from "../treeview/intentTreeProvider";

export function approveIntent(treeProvider: IntentTreeProvider) {
  return (item: { intent?: { id: string } }) => {
    if (!item?.intent?.id) {
      return;
    }
    IntentQueue.update(item.intent.id, { status: "approved" });
    treeProvider.refresh();
  };
}
