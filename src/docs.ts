import { DOCS_CATALOG_SOURCE_SHA256, SCALEV_DOCS } from "./generated/docsCatalog";

export interface ScalevDoc {
  readonly topic: string;
  readonly title: string;
  readonly description?: string;
  readonly language: string;
  readonly slug: string;
  readonly nav_group?: string;
  readonly nav_path: readonly string[];
  readonly url: string;
  readonly source: string;
  readonly source_sha256: string;
  readonly hint: string;
  readonly content: string;
}

export interface DocsLookupInput {
  topic?: string;
  url?: string;
  query?: string;
  language?: string;
  nav_group?: string;
  limit?: number;
}

export interface DocsLookupResult {
  data: ScalevDoc[];
  total_matches: number;
  is_paginated: false;
  catalog: {
    source: string;
    source_sha256: string;
    docs_count: number;
    available_topics: string[];
    available_languages: string[];
    available_nav_groups: string[];
  };
}

const DOCS_SOURCE = "../docs";
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const DOCS = SCALEV_DOCS as readonly ScalevDoc[];

const DOCS_BY_TOPIC = new Map<string, ScalevDoc>(DOCS.map((doc) => [normalize(doc.topic), doc]));
const DOCS_BY_URL = new Map<string, ScalevDoc>(DOCS.map((doc) => [normalizeUrl(doc.url), doc]));
const AVAILABLE_LANGUAGES = uniqueSorted(DOCS.map((doc) => doc.language));
const AVAILABLE_NAV_GROUPS = uniqueSorted(DOCS.map((doc) => doc.nav_group).filter(isString));

export function docsTopicForUrl(url: string): string | undefined {
  return DOCS_BY_URL.get(normalizeUrl(url))?.topic;
}

export function getDocs(input: DocsLookupInput = {}): DocsLookupResult {
  const topic = normalize(input.topic);
  const url = normalizeUrl(input.url);
  const queryTerms = terms(input.query);
  const language = normalize(input.language);
  const navGroup = normalize(input.nav_group);
  const limit = clampLimit(input.limit);
  const docs = filterDocs(DOCS, { language, navGroup });

  let matches: ScalevDoc[];

  if (topic) {
    matches = docMatchesFilters(DOCS_BY_TOPIC.get(topic), { language, navGroup });
  } else if (url) {
    matches = docMatchesFilters(DOCS_BY_URL.get(url), { language, navGroup });
  } else if (queryTerms.length > 0) {
    matches = docs
      .map((doc) => ({ doc, score: scoreDoc(doc, queryTerms) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || left.doc.topic.localeCompare(right.doc.topic))
      .slice(0, limit)
      .map(({ doc }) => doc);
  } else {
    matches = docs.slice(0, limit);
  }

  return {
    data: matches,
    total_matches: matches.length,
    is_paginated: false,
    catalog: {
      source: DOCS_SOURCE,
      source_sha256: DOCS_CATALOG_SOURCE_SHA256,
      docs_count: DOCS.length,
      available_topics: DOCS.map((doc) => doc.topic),
      available_languages: AVAILABLE_LANGUAGES,
      available_nav_groups: AVAILABLE_NAV_GROUPS
    }
  };
}

function filterDocs(
  docs: readonly ScalevDoc[],
  filters: { language: string; navGroup: string }
): readonly ScalevDoc[] {
  return docs.filter((doc) => {
    if (filters.language && normalize(doc.language) !== filters.language) return false;
    if (filters.navGroup && normalize(doc.nav_group) !== filters.navGroup) return false;
    return true;
  });
}

function docMatchesFilters(
  doc: ScalevDoc | undefined,
  filters: { language: string; navGroup: string }
): ScalevDoc[] {
  return doc && filterDocs([doc], filters).length > 0 ? [doc] : [];
}

function scoreDoc(doc: ScalevDoc, queryTerms: string[]): number {
  const title = normalize(doc.title);
  const topic = normalize(doc.topic);
  const description = normalize(doc.description);
  const language = normalize(doc.language);
  const slug = normalize(doc.slug);
  const navGroup = normalize(doc.nav_group);
  const navPath = normalize(doc.nav_path.join(" "));
  const hint = normalize(doc.hint);
  const content = normalize(doc.content);
  let score = 0;

  for (const term of queryTerms) {
    if (topic.includes(term)) score += 8;
    if (slug.includes(term)) score += 7;
    if (title.includes(term)) score += 6;
    if (description.includes(term)) score += 4;
    if (navGroup.includes(term)) score += 4;
    if (navPath.includes(term)) score += 3;
    if (language === term) score += 2;
    if (hint.includes(term)) score += 4;
    if (content.includes(term)) score += 1;
  }

  return score;
}

function terms(value: string | undefined): string[] {
  return normalize(value)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

function normalize(value: string | undefined): string {
  return (value || "").toLowerCase().trim();
}

function normalizeUrl(value: string | undefined): string {
  return (value || "").replace(/\/+$/, "").toLowerCase();
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit || DEFAULT_LIMIT), 1), MAX_LIMIT);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
