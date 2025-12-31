export type SearchStats = {
    issuesOpened?: number;
    issuesClosed?: number;
    prsSubmitted?: number;
    prsApproved?: number;
};

export type RepoStatsOptions = { since?: string; until?: string; branch?: string };