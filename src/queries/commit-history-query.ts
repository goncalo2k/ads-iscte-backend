export const USER_REPO_STATS_QUERY = `
  query UserRepoFastStats(
    $owner: String!,
    $repo: String!,
    $authorId: ID!,
    $qIssuesOpened: String!,
    $qIssuesClosed: String!,
    $qPrsSubmitted: String!,
    $qPrsApproved: String!,
    $useBranch: Boolean!,
    $qualifiedRef: String!,
    $afterHistory: String,
    $from: GitTimestamp,
    $to: GitTimestamp
  ) {
    repository(owner: $owner, name: $repo) {
      ref(qualifiedName: $qualifiedRef) @include(if: $useBranch) {
        target { ...CommitHistory }
      }
      defaultBranchRef @skip(if: $useBranch) {
        target { ...CommitHistory }
      }
    }

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

  fragment CommitHistory on GitObject {
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
