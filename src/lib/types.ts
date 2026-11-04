export type Evidence = {
  source: string; // Source label, e.g. "S1"
  paragraph: number; // 1-based paragraph number in the captured article
  quote: string; // Verbatim text, machine-checked against the captured paragraph
};

export type Fact = {
  id: string;
  statement: string;
  attributedTo: string | null;
  evidence: Evidence[];
};

export type Conflict = { description: string; factIds: string[] };

export type PendingSource = {
  url: string;
  title: string;
  outletId: string | null;
  outletName: string;
  reason: string;
};

export type Source = {
  id: string;
  label: string;
  outlet_id: string | null;
  outlet_name: string;
  url: string;
  title: string;
  author: string | null;
  published_at: string | null;
  fetched_at: string;
  capture_method: "page" | "pasted" | "browser";
  paragraphs: string[];
  content_sha256: string;
};

/** The source fields that are safe to show on a public link. */
export type PublicSource = Omit<Source, "id" | "outlet_id" | "paragraphs">;

export type SessionUser = {
  id: string;
  username: string;
  display_name: string;
  /** "admin" grants admin rights. */
  role: "admin" | "reporter";
  is_reporter: boolean;
};

export type Story = {
  id: string;
  title: string;
  owner_id: string;
  owner_name: string;
  is_owner: boolean;
  /** "own" for the owner, "edit" for invited editors, "view" for viewers and admins reviewing. */
  access: "own" | "edit" | "view";
  /** True when the story was shared with this user, not just readable because they are an admin. */
  shared_with_me: boolean;
  my_pending_requests: { kind: "edit" | "publish"; version_id: string | null }[];
  updated_at: string;
  facts: Fact[] | null;
  conflicts: Conflict[];
  pending_sources: PendingSource[];
  created_at: string;
};

export type StoryListItem = {
  id: string;
  title: string;
  created_at: string;
  is_owner: boolean;
  owner_name: string;
  outlet_name: string | null;
  source_count: number;
  version_count: number;
  approved_count: number;
};

export type ApprovedVersion = {
  id: string;
  story_id: string;
  story_title: string;
  outlet_name: string | null;
  headline: string;
  label: string;
  language: string;
  word_count: number;
  byline: string | null;
  reviewed_at: string;
  share_token: string | null;
  is_owner: boolean;
  owner_name: string;
};

export type Sentence = {
  id: string;
  text: string;
  factIds: string[];
  evidence: Evidence[];
};

export type VersionContent = {
  headline: Sentence;
  dek: Sentence | null;
  paragraphs: Sentence[][];
  credit: string;
};

export type Verdict = "supported" | "partial" | "unsupported";

export type SentenceReview = {
  verdict: Verdict;
  note: string | null;
  unmatchedNumbers: string[];
  unverifiedQuotes: string[];
  copiedPhrase: string | null;
};

export type LegalFlag = {
  sentenceId: string | null;
  type: string;
  severity: "high" | "medium";
  explanation: string;
  suggestion: string;
};

export type VersionReview = {
  sentences: Record<string, SentenceReview>;
  flags: LegalFlag[];
  removed: { text: string; reason: string }[];
  proofreadChanges: { before: string; after: string; note: string }[];
  proofreadAt: string | null;
  notices: string[];
  overlapPercent: number;
};

export type Version = {
  id: string;
  story_id: string;
  label: string;
  target_words: number | null;
  tone: string;
  language: string;
  content: VersionContent;
  review: VersionReview;
  word_count: number;
  status: "needs_review" | "reviewed";
  byline: string | null;
  reviewed_at: string | null;
  share_token: string | null;
  public_mode: "article" | "article_with_original" | null;
  created_at: string;
};

export type SharedVersion = Pick<Version, "id" | "label" | "language" | "tone" | "content" | "word_count" | "byline" | "reviewed_at"> & {
  public_mode: "article" | "article_with_original";
  /** paragraphs are included only when an admin published the original article too. */
  sources: (PublicSource & { paragraphs: string[] | null })[];
};

export type FeedItem = {
  id: string;
  outletId: string;
  outletName: string;
  title: string;
  url: string;
  publishedAt: string | null;
  summary: string;
  readable: boolean;
};

export type OutletStatus = { outletId: string; ok: boolean; count: number; error?: string };

export type GenerationEvent =
  | { type: "progress"; message: string }
  | { type: "done"; version: Version; facts: Fact[]; conflicts: Conflict[] }
  | { type: "error"; message: string };
