export const USER_ISSUES_AND_PRS_STATS_QUERY = `
  query UserRepoFastStats(
    $authorId: ID!,
    $qIssuesOpened: String!,
    $qIssuesClosed: String!,
    $qPrsSubmitted: String!,
    $qPrsApproved: String!
  ) {
    node(id: $authorId) {
      ... on User {
        name
        login
      }
    }

    issuesOpened: search(type: ISSUE, query: $qIssuesOpened) { issueCount }
    issuesClosed: search(type: ISSUE, query: $qIssuesClosed) { issueCount }
    prsSubmitted: search(type: ISSUE, query: $qPrsSubmitted) { issueCount }
    prsApproved: search(type: ISSUE, query: $qPrsApproved) { issueCount }
  }
`;

/**
 * One page of commit history churn (additions/deletions).
 * You pass either:
 *  - useBranch=true and qualifiedRef="refs/heads/<branch>"
 *  - or useBranch=false (uses defaultBranchRef)
 */
export const USER_REPO_COMMIT_HISTORY_QUERY = `
  query UserRepoChurnPage(
    $owner: String!,
    $repo: String!,
    $authorId: ID!,
    $useBranch: Boolean!,
    $qualifiedRef: String!,
    $afterHistory: String,
    $from: GitTimestamp,
    $to: GitTimestamp
  ) {
    repository(owner: $owner, name: $repo) {
      ref(qualifiedName: $qualifiedRef) @include(if: $useBranch) {
        target { ...CommitHistoryPage }
      }
      defaultBranchRef @skip(if: $useBranch) {
        target { ...CommitHistoryPage }
      }
    }
  }

  fragment CommitHistoryPage on GitObject {
    ... on Commit {
      history(
        first: 100,
        after: $afterHistory,
        author: { id: $authorId },
        since: $from,
        until: $to
      ) {
        pageInfo { hasNextPage endCursor }
        nodes { additions deletions }
      }
    }
  }
`;
