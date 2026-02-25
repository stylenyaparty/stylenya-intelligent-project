function slugify(s: string) {
    return (s ?? "")
        .toLowerCase()
        .trim()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

type Row = {
    cluster: string;
    researchScore?: number;
    mentions?: number;
    keyword: string;
    clusterId?: string;
    rank?: number;
};

export function addClusterRank(rows: Row[]) {
    // group
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
        const key = r.cluster ?? "unknown";
        const arr = groups.get(key) ?? [];
        arr.push(r);
        groups.set(key, arr);
    }

    // sort inside each cluster and annotate
    const out: Row[] = [];
    for (const [cluster, arr] of groups.entries()) {
        arr.sort((a, b) => {
            const sa = a.researchScore ?? 0;
            const sb = b.researchScore ?? 0;
            if (sb !== sa) return sb - sa;
            return (b.mentions ?? 0) - (a.mentions ?? 0);
        });

        const cid = slugify(cluster);
        arr.forEach((r, idx) => {
            r.clusterId = cid;
            r.rank = idx + 1;
            out.push(r);
        });
    }

    // opcional: ordenar por cluster y rank para UI
    out.sort((a, b) => {
        if ((a.clusterId ?? "") !== (b.clusterId ?? "")) {
            return (a.clusterId ?? "").localeCompare(b.clusterId ?? "");
        }
        return (a.rank ?? 0) - (b.rank ?? 0);
    });

    return out;
}