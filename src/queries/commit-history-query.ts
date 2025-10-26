export const HISTORY_QUERY = `
  query HistoryByAuthor(
    $owner: String!,
    $repo: String!,
    $authorId: ID!,
    $since: GitTimestamp,
    $until: GitTimestamp,
    $after: String,
    $useBranch: Boolean!,
    $qualifiedRef: String!
  ) {
    repository(owner: $owner, name: $repo) {
      # Case A: use the provided branch/ref
      ref(qualifiedName: $qualifiedRef) @include(if: $useBranch) {
        target { 
          ...CommitHistory 
        }
      }
      # Case B: fall back to default branch (no extra request needed)
      defaultBranchRef @skip(if: $useBranch) {
        name
        target {
          ...CommitHistory
        }
      }
    }
  }

  fragment CommitHistory on GitObject {
    ... on Commit {
      history(
        first: 100,
        after: $after,
        author: { id: $authorId },
        since: $since,
        until: $until
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes { additions deletions }
      }
    }
  }
`;
