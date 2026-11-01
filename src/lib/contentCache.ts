import { isAppHtml } from "./markdownContent";

const CONTENT_KEY_PREFIX = "page-content-";
const UPDATED_AT_KEY_PREFIX = "page-content-updated-at-";

const getStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const buildContentKey = (slug: string) => `${CONTENT_KEY_PREFIX}${slug}`;
const buildUpdatedAtKey = (slug: string) => `${UPDATED_AT_KEY_PREFIX}${slug}`;

export const readPageContentCache = (slug?: string) => {
  const storage = getStorage();
  if (!storage || !slug) return null;
  try {
    const content = storage.getItem(buildContentKey(slug));
    if (content !== null && isAppHtml(content)) {
      storage.removeItem(buildContentKey(slug));
      storage.removeItem(buildUpdatedAtKey(slug));
      return null;
    }
    return content;
  } catch {
    return null;
  }
};

export const writePageContentCache = (slug: string, content: string, updatedAt?: string) => {
  const storage = getStorage();
  if (!storage || isAppHtml(content)) return;
  try {
    storage.setItem(buildContentKey(slug), content);
    if (updatedAt) {
      storage.setItem(buildUpdatedAtKey(slug), updatedAt);
    }
  } catch {
    // Ignore quota or privacy errors – cache is best-effort only.
  }
};

export const readPageContentUpdatedAt = (slug?: string) => {
  const storage = getStorage();
  if (!storage || !slug) return null;
  try {
    return storage.getItem(buildUpdatedAtKey(slug));
  } catch {
    return null;
  }
};

export const writePageContentUpdatedAt = (slug: string, updatedAt: string) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(buildUpdatedAtKey(slug), updatedAt);
  } catch {
    // Ignore storage issues
  }
};

export const shouldPrefetchPageContent = (slug: string, updatedAt?: string | null) => {
  const cachedContent = readPageContentCache(slug);
  if (!cachedContent) return true;

  if (!updatedAt) return false;

  const cachedUpdatedAt = readPageContentUpdatedAt(slug);
  return cachedUpdatedAt !== updatedAt;
};
