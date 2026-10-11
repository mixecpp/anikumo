import { cached } from "./cache";
import { getRelationNode, type RelationNode } from "./anilist";

const MAIN = new Set(["PREQUEL", "SEQUEL"]);
const OPTIONAL = new Set(["SIDE_STORY", "SPIN_OFF", "PARENT"]);
const MAX_NODES = 16;

export type OrderEntry = { node: RelationNode; main: boolean };

function startTs(n: RelationNode) {
  const d = n.startDate;
  return d.year ? new Date(d.year, (d.month ?? 1) - 1, d.day ?? 1).getTime() : Number.MAX_SAFE_INTEGER;
}

/**
 * Franchise viewing order: the prequel/sequel chain is the main line; side stories,
 * spin-offs and parents are marked optional. Everything is ordered by release date.
 */
export async function getWatchOrder(id: number): Promise<OrderEntry[] | null> {
  return cached(`watch-order:${id}`, 60 * 60 * 12, async () => {
    const nodes = new Map<number, { node: RelationNode; main: boolean }>();
    const queue: { id: number; main: boolean }[] = [{ id, main: true }];
    while (queue.length && nodes.size < MAX_NODES) {
      const next = queue.shift()!;
      if (nodes.has(next.id)) {
        if (next.main) nodes.get(next.id)!.main = true;
        continue;
      }
      const node = await getRelationNode(next.id).catch(() => null);
      if (!node || node.type !== "ANIME") continue;
      nodes.set(node.id, { node, main: next.main });
      for (const e of node.relations.edges) {
        if (e.node.type !== "ANIME" || nodes.has(e.node.id)) continue;
        if (MAIN.has(e.relationType) && next.main) queue.push({ id: e.node.id, main: true });
        else if (OPTIONAL.has(e.relationType) && next.main) queue.push({ id: e.node.id, main: false });
      }
    }
    if (nodes.size < 2) return null;
    return [...nodes.values()].sort((a, b) => startTs(a.node) - startTs(b.node));
  });
}
