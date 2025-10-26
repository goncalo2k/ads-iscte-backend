// github.queries.ts

// Combined query: commit history (additions/deletions), issues closed (via ClosedEvent),
// issues opened, PRs submitted, PR reviews (approved) — all repo/user scoped.
export const USER_REPO_ACTIVITY_AND_HISTORY_QUERY = `
  query UserRepoActivityAndHistory(
    $owner: String!,
    $repo: String!,
    $authorId: ID!,
    $from: DateTime,
    $to: DateTime,
    $afterHistory: String,
    $afterClosedIssues: String,
    $afterReviews: String,
    $useBranch: Boolean!,
    $qualifiedRef: String!
  ) {
    repository(owner: $owner, name: $repo) {
      # Commit history on either a specific branch (ref) or default branch
      ref(qualifiedName: $qualifiedRef) @include(if: $useBranch) {
        target { ...CommitHistory }
      }
      defaultBranchRef @skip(if: $useBranch) {
        name
        target { ...CommitHistory }
      }

      # Closed issues in this repo (we'll detect who closed via timeline ClosedEvent)
      closedIssues: issues(
        first: 100,
        states: CLOSED,
        orderBy: { field: UPDATED_AT, direction: DESC },
        after: $afterClosedIssues
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number
          closedAt
          timelineItems(
            first: 10
            itemTypes: [CLOSED_EVENT]
          ) {
            nodes {
              ... on ClosedEvent {
                createdAt
                actor {
                  __typename
                  ... on User { id login }
                }
              }
            }
          }
        }
      }
    }

    # User-scoped contributions in a window (opened issues/PRs and PR reviews)
    node(id: $authorId) {
      ... on User {
        login
        contributionsCollection(from: $from, to: $to) {
          issueContributionsByRepository(maxRepositories: 100) {
            repository { nameWithOwner }
            contributions { totalCount }
          }
          pullRequestContributionsByRepository(maxRepositories: 100) {
            repository { nameWithOwner }
            contributions { totalCount }
          }
          pullRequestReviewContributionsByRepository(maxRepositories: 100) {
            repository { nameWithOwner }
            contributions(first: 100, after: $afterReviews) {
              pageInfo { hasNextPage endCursor }
              nodes {
                pullRequestReview {
                  state
                  submittedAt
                  pullRequest { repository { nameWithOwner } }
                }
              }
            }
          }
        }
      }
    }
  }

  fragment CommitHistory on GitObject {
    ... on Commit {
      history(
        first: 100,
        after: $afterHistory,
        author: { id: $authorId }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes { additions deletions }
      }
    }
  }
`;
