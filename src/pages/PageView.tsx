import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase, Page } from "@/lib/supabase";
import { Loader2, Edit, Save, X, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ContentGate } from "@/components/app/ContentGate";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/app/MarkdownRenderer";
import { toast } from "sonner";
import {
  readPageContentCache,
  readPageContentUpdatedAt,
  writePageContentCache,
  writePageContentUpdatedAt,
} from "@/lib/contentCache";

interface PageViewProps {
  slugOverride?: string | null;
  initialPage?: Page | null;
  onNavigateToSlug?: (slug: string) => boolean | void;
}

export default function PageView({ slugOverride, initialPage, onNavigateToSlug }: PageViewProps = {}) {
  const { pageSlug, slug: legacySlug } = useParams<{ pageSlug?: string; slug?: string }>();
  const slug = slugOverride ?? pageSlug ?? legacySlug;
  const initialCachedContent = readPageContentCache(slug);
  const hasInitialCache = initialCachedContent !== null;
  const providedPage = initialPage ?? null;
  const [page, setPage] = useState<Page | null>(null);
  const [isFree, setIsFree] = useState<boolean>(providedPage?.is_free ?? false);
  const [content, setContent] = useState(initialCachedContent ?? "");
  const [editContent, setEditContent] = useState(initialCachedContent ?? "");
  const [contentLoading, setContentLoading] = useState(() => !hasInitialCache);
  const [contentError, setContentError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeLoadRef = useRef<{
    slug: string;
    id: symbol;
    controller: AbortController;
  } | null>(null);
  const latestUpdatedAtRef = useRef<string | null>(null);
  const adminCheckRef = useRef(false);

  const startLoadCycle = (pageSlug: string) => {
    const controller = new AbortController();
    const loadId = Symbol(pageSlug);

    if (activeLoadRef.current) {
      activeLoadRef.current.controller.abort();
    }

    activeLoadRef.current = { slug: pageSlug, id: loadId, controller };
    return { loadId, signal: controller.signal };
  };

  const isActiveLoad = (loadId: symbol) => activeLoadRef.current?.id === loadId;

  useEffect(() => {
    if (!slug) return;

    setPage(providedPage ?? null);
    setIsFree(providedPage?.is_free ?? false);
    setContentError(null);
    setIsEditing(false);
    latestUpdatedAtRef.current = providedPage?.updated_at ?? null;

    const primeContentFromCache = (pageSlug: string) => {
      const cached = readPageContentCache(pageSlug);
      if (cached !== null) {
        setContent(cached);
        setEditContent(cached);
        setContentLoading(false);
        return cached;
      }

      setContent("");
      setEditContent("");
      setContentLoading(true);
      return null;
    };

    const loadMarkdownContent = async ({
      pageSlug,
      loadId,
      signal,
      expectedUpdatedAt,
      showLoading,
    }: {
      pageSlug: string;
      loadId: symbol;
      signal: AbortSignal;
      expectedUpdatedAt?: string;
      showLoading: boolean;
    }) => {
      if (showLoading) {
        setContentLoading(true);
      }
      try {
        const response = await fetch(`/content/pages/${pageSlug}.md`, { signal });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Markdown file not found");
        }
        const text = await response.text();

        if (signal.aborted || !isActiveLoad(loadId)) return;

        setContent((current) => (current === text ? current : text));
        setEditContent((current) => (current === text ? current : text));
        const updatedAt = expectedUpdatedAt || latestUpdatedAtRef.current || undefined;
        writePageContentCache(pageSlug, text, updatedAt);
        setContentError(null);
      } catch (error: unknown) {
        if (signal.aborted || !isActiveLoad(loadId)) return;

        if (showLoading) {
          setContent("");
          setEditContent("");
        }
        const message = error instanceof Error ? error.message : "Failed to load local markdown file";
        setContentError(message);
        toast.error(message);
      } finally {
        if (isActiveLoad(loadId) && showLoading) {
          setContentLoading(false);
        }
      }
    };

    const syncFromSupabase = async ({
      pageSlug,
      loadId,
      signal,
      cachedUpdatedAt,
      hadCache,
      onRequireContent,
    }: {
      pageSlug: string;
      loadId: symbol;
      signal: AbortSignal;
      cachedUpdatedAt: string | null;
      hadCache: boolean;
      onRequireContent: (updatedAt?: string | null) => Promise<void>;
    }) => {
      setSyncing(!hadCache);
      try {
        const fetchMetadata = async () => {
          const { data, error } = await supabase
            .from('pages')
            .select('id, title, slug, updated_at, is_free')
            .eq('slug', pageSlug)
            .single();

          if (error && (error as { code?: string })?.code === "42703") {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('pages')
              .select('id, title, slug, updated_at')
              .eq('slug', pageSlug)
              .single();
            if (fallbackError) throw fallbackError;
            return { ...fallbackData, is_free: false };
          }

          if (error) throw error;
          return data;
        };

        const data = await fetchMetadata();
        if (signal.aborted || !isActiveLoad(loadId)) return;

        latestUpdatedAtRef.current = data?.updated_at ?? null;
        setPage(data);
        if (data) {
          setIsFree(data.is_free ?? false);
        }
        if (data?.updated_at) {
          writePageContentUpdatedAt(pageSlug, data.updated_at);
        }

        const needsContentFetch =
          !hadCache || (data?.updated_at && cachedUpdatedAt !== data.updated_at);

        if (needsContentFetch) {
          await onRequireContent(data?.updated_at);
        }
      } catch (error) {
        console.error('Error syncing page metadata:', error);
      } finally {
        if (isActiveLoad(loadId)) {
          setSyncing(false);
        }
      }
    };

    const checkAdminStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        setIsAdmin(data?.role === 'admin');
      }
    };

    const { loadId, signal } = startLoadCycle(slug);
    const cachedContent = primeContentFromCache(slug);
    const cachedUpdatedAt = readPageContentUpdatedAt(slug);
    let initialContentRequested = false;
    let refreshContentRequested = false;

    const requestContent = async (
      expectedUpdatedAt?: string | null,
      mode: "initial" | "refresh" = "initial",
    ) => {
      if (signal.aborted || !isActiveLoad(loadId)) return;
      if (mode === "initial" ? initialContentRequested : refreshContentRequested) return;
      if (mode === "initial") {
        initialContentRequested = true;
      } else {
        refreshContentRequested = true;
      }
      await loadMarkdownContent({
        pageSlug: slug,
        loadId,
        signal,
        expectedUpdatedAt: expectedUpdatedAt ?? undefined,
        showLoading: cachedContent === null && mode === "initial",
      });
    };

    const hydrateFromChapter = async () => {
      if (!providedPage || !isActiveLoad(loadId)) return false;

      const needsContentFetch = !cachedContent ||
        (providedPage.updated_at && cachedUpdatedAt !== providedPage.updated_at);

      if (needsContentFetch) {
        await requestContent(providedPage.updated_at, cachedContent ? "refresh" : "initial");
      }

      if (!isActiveLoad(loadId)) return true;

      setPage(providedPage);
      setIsFree(providedPage.is_free ?? false);
      latestUpdatedAtRef.current = providedPage.updated_at ?? null;
      if (providedPage.updated_at) {
        writePageContentUpdatedAt(slug, providedPage.updated_at);
      }
      setSyncing(false);
      return true;
    };

    const initialize = async () => {
      const hydrated = await hydrateFromChapter();
      if (hydrated) return;

      void requestContent(cachedUpdatedAt, "initial");

      await syncFromSupabase({
        pageSlug: slug,
        loadId,
        signal,
        cachedUpdatedAt,
        hadCache: cachedContent !== null,
        onRequireContent: async (updatedAt?: string | null) => {
          if (updatedAt && cachedUpdatedAt && updatedAt === cachedUpdatedAt) {
            return;
          }
          await requestContent(updatedAt, "refresh");
        },
      });
    };

    void initialize();
    if (!adminCheckRef.current) {
      adminCheckRef.current = true;
      void checkAdminStatus();
    }

    return () => {
      if (activeLoadRef.current?.id === loadId) {
        activeLoadRef.current?.controller.abort();
      }
    };
  }, [slug, providedPage?.updated_at, providedPage?.is_free]);

  useEffect(() => {
    if (page?.slug && page.updated_at) {
      writePageContentUpdatedAt(page.slug, page.updated_at);
    }
  }, [page?.slug, page?.updated_at]);

  const handleSave = async () => {
    if (!page) {
      toast.error("Still syncing with Supabase – please wait");
      return;
    }

    setSaving(true);

    try {
      const updateResponse = await fetch(`/api/content/pages/${page.slug}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: editContent }),
      });

      if (!updateResponse.ok) {
        const message = await updateResponse.text();
        throw new Error(message || "Failed to update markdown file");
      }

      const newTimestamp = new Date().toISOString();

      const performUpdate = async () => {
        const { error } = await supabase
          .from('pages')
          .update({ updated_at: newTimestamp, is_free: isFree })
          .eq('id', page.id);

        if (error) {
          const code = (error as { code?: string })?.code;
          if (code === "42703") {
            const { error: fallbackError } = await supabase
              .from('pages')
              .update({ updated_at: newTimestamp })
              .eq('id', page.id);
            if (fallbackError) throw fallbackError;
            return;
          }
          throw error;
        }
      };

      await performUpdate();

      toast.success("Page saved!");
      setIsEditing(false);
      setContent(editContent);
      writePageContentCache(page.slug, editContent, newTimestamp);
      setPage({ ...page, updated_at: newTimestamp, is_free: isFree });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save page";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const derivedTitle = useMemo(() => {
    if (page?.title) return page.title;
    const headingMatch = content.match(/^#\s+(.+)/m);
    if (headingMatch?.[1]) return headingMatch[1];
    return slug || "Untitled";
  }, [content, page?.title, slug]);
  const savedIsFree = page?.is_free ?? providedPage?.is_free ?? false;

  const handleInternalLink = (href?: string) => {
    if (!href || !onNavigateToSlug) return false;

    // Ignore fully qualified external URLs
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(href)) return false;

    const matchDirect = href.match(/^\/read\/([^/?#]+)/);
    const matchChapterPath = href.match(/^\/read\/chapters\/[^/]+\/pages\/([^/?#]+)/);
    const matchRelative = href.match(/^\.?\/?([^/?#]+)/);

    const targetSlug = matchDirect?.[1] || matchChapterPath?.[1] || matchRelative?.[1];
    if (!targetSlug) return false;

    const handled = onNavigateToSlug(targetSlug);
    return handled ?? false;
  };

  if (contentLoading && !content) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-5xl p-4 pb-20 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-col gap-4 lg:mb-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="mb-2 break-words text-3xl font-bold sm:text-4xl">{derivedTitle}</h1>
          {(page || providedPage) && (
            <div className="flex flex-wrap items-center gap-3">
              {isFree && (
                <Badge variant="secondary">
                  Free
                </Badge>
              )}
              {isAdmin && page && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    id="is-free-toggle"
                    checked={isFree}
                    onCheckedChange={(checked) => setIsFree(!!checked)}
                    disabled={!isEditing || saving}
                  />
                  <span>This page is free to read</span>
                </label>
              )}
            </div>
          )}
        </div>
        {isAdmin && page && (
          <div className="flex flex-wrap gap-2">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <>
                <Button onClick={handleSave} size="sm" disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(content);
                    setIsFree(savedIsFree);
                  }}
                  size="sm"
                  variant="outline"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {syncing && (
        <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-20 flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-none">
          <RefreshCcw className="h-3 w-3 animate-spin text-primary" />
          <span>Syncing with Supabase…</span>
        </div>
      )}

      <ContentGate isFree={isFree}>
        {isEditing ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold mb-2">Markdown Editor</h3>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[600px] font-mono text-sm"
                placeholder="Write your markdown here..."
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Preview</h3>
              <div className="border border-border rounded-xl p-6 min-h-[600px] bg-card">
                <MarkdownRenderer content={editContent} pageSlug={slug ?? ""} />
              </div>
            </div>
          </div>
        ) : contentError ? (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl p-6">
            {contentError}
          </div>
        ) : (
          <div className="prose prose-base max-w-none sm:prose-lg">
            <MarkdownRenderer
              content={content}
              pageSlug={slug ?? ""}
              onLinkClick={(href) => handleInternalLink(href)}
            />
          </div>
        )}
      </ContentGate>

      {(page?.updated_at || !page) && (
        <div className="pointer-events-none absolute right-0 top-0 space-y-1 p-2 text-right text-[11px] text-muted-foreground sm:p-4 sm:text-xs">
          {!page && <p>Syncing metadata from Supabase…</p>}
          {page?.updated_at && (
            <p>Last synced: {new Date(page.updated_at).toLocaleDateString()}</p>
          )}
        </div>
      )}
    </div>
  );
}
