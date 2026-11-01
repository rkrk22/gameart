// Static hosts can return index.html with status 200 for a missing content file.
export const isAppHtml = (content: string) =>
  /^\s*(?:<!doctype\s+html\b|<html\b)/i.test(content) ||
  (/<div\b[^>]*\bid=["']root["']/i.test(content) &&
    /<script\b[^>]*\bsrc=["'][^"']*\/assets\//i.test(content));

export const fetchMarkdownContent = async (slug: string, signal?: AbortSignal) => {
  const response = await fetch(`/content/pages/${encodeURIComponent(slug)}.md`, { signal });
  if (!response.ok) {
    throw new Error(`Unable to load lesson "${slug}" (HTTP ${response.status}).`);
  }
  const content = await response.text();
  if (isAppHtml(content)) {
    throw new Error(`Lesson "${slug}" is missing from this deployment. Publish its Markdown file and redeploy.`);
  }
  return content;
};
