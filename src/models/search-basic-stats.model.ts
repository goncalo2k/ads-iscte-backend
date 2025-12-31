export type SearchBasicStats = {
    userName?: string;
    additions?: number;
    deletions?: number;
};

export type SearchBasicStatsPage = {
    userName?: string;
    additions?: number;
    deletions?: number;
    hasNextPage?: boolean;
};