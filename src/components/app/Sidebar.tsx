import { Fragment, useEffect, useState } from "react";
import type { DragEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { supabase, Chapter } from "@/lib/supabase";
import { Book, GripVertical, House, Loader2, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CreateChapterDialog } from "./CreateChapterDialog";
import { toast } from "sonner";
import { reorderById } from "@/lib/reorder";
import { cn } from "@/lib/utils";
import { isDividerPage } from "@/lib/pageDividers";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SidebarProps {
  isAdmin: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export const Sidebar = ({ isAdmin, mobileOpen, onMobileOpenChange }: SidebarProps) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [draggingChapterId, setDraggingChapterId] = useState<string | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  const [chapterPendingDeletion, setChapterPendingDeletion] = useState<Chapter | null>(null);
  const [chapterDeleting, setChapterDeleting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const closeMobileNavigation = () => {
    onMobileOpenChange(false);
  };

  useEffect(() => {
    fetchChapters();
  }, []);

  const fetchChapters = async () => {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select('id, title, slug, index_num, created_at')
        .order('index_num', { ascending: true });

      if (error) throw error;
      setChapters(data || []);
    } catch (error) {
      console.error('Error fetching chapters:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteMarkdownFile = async (slug: string) => {
    const response = await fetch(`/api/content/pages/${slug}`, { method: "DELETE" });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Failed to delete markdown file");
    }
  };

  const handleConfirmDeleteChapter = async () => {
    if (!chapterPendingDeletion) return;
    setChapterDeleting(true);
    try {
      const chapterToDelete = chapterPendingDeletion;

      const { data: relatedPages, error: relatedPagesError } = await supabase
        .from('pages')
        .select('id, slug, is_free, content_md')
        .eq('chapter_id', chapterToDelete.id);

      if (relatedPagesError) throw relatedPagesError;

      if (relatedPages && relatedPages.length > 0) {
        const pagesWithFiles = relatedPages.filter((page) => !isDividerPage(page));

        if (pagesWithFiles.length > 0) {
          await Promise.all(
            pagesWithFiles.map((page) => deleteMarkdownFile(page.slug)),
          );
        }

        const { error: deletePagesError } = await supabase
          .from('pages')
          .delete()
          .eq('chapter_id', chapterToDelete.id);

        if (deletePagesError) throw deletePagesError;
      }

      const { error: deleteChapterError } = await supabase
        .from('chapters')
        .delete()
        .eq('id', chapterToDelete.id);

      if (deleteChapterError) throw deleteChapterError;

      setChapters((prev) => prev.filter((chapter) => chapter.id !== chapterToDelete.id));
      toast.success("Chapter deleted");
      if (location.pathname.includes(`/app/chapters/${chapterToDelete.slug}`)) {
        navigate("/app", { replace: true });
      }
    } catch (error: unknown) {
      console.error("Failed to delete chapter:", error);
      const message = error instanceof Error ? error.message : "Failed to delete chapter";
      toast.error(message);
    } finally {
      setChapterDeleting(false);
      setChapterPendingDeletion(null);
    }
  };

  const handleChapterDragStart = (event: DragEvent<HTMLElement>, chapterId: string) => {
    if (!isAdmin || orderSaving) return;
    setDraggingChapterId(chapterId);
    setDropIndicatorIndex(null);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleChapterDragEnd = () => {
    setDraggingChapterId(null);
    setDropIndicatorIndex(null);
  };

  const handleChapterDragOver = (
    event: DragEvent<HTMLElement>,
    targetChapterId: string | null,
    targetIndex: number | null,
  ) => {
    if (!isAdmin || !draggingChapterId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (targetChapterId && typeof targetIndex === "number") {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      setDropIndicatorIndex(placeAfter ? targetIndex + 1 : targetIndex);
    } else {
      setDropIndicatorIndex(chapters.length);
    }
  };

  const persistChapterOrder = async (nextOrder: Chapter[], previousOrder: Chapter[]) => {
    setOrderSaving(true);
    try {
      const payload = nextOrder.map(({ id, title, slug, index_num, created_at }) => ({
        id,
        title,
        slug,
        index_num,
        created_at,
      }));
      const { error } = await supabase
        .from('chapters')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Failed to reorder chapters:", error);
      toast.error("Не удалось сохранить порядок глав");
      setChapters(previousOrder);
    } finally {
      setOrderSaving(false);
    }
  };

  const handleChapterDrop = async (
    event: DragEvent<HTMLElement>,
    targetChapterId: string | null,
  ) => {
    if (!isAdmin || !draggingChapterId) return;
    event.preventDefault();
    event.stopPropagation();

    const cursorY = event.clientY;
    const rect = event.currentTarget?.getBoundingClientRect();
    const placeAfter = targetChapterId && rect
      ? cursorY > rect.top + rect.height / 2
      : true;

    const reordered = reorderById(chapters, draggingChapterId, targetChapterId, placeAfter);

    if (!reordered) {
      setDraggingChapterId(null);
      return;
    }

    const previousOrder = chapters;
    setChapters(reordered);
    await persistChapterOrder(reordered, previousOrder);
    setDraggingChapterId(null);
    setDropIndicatorIndex(null);
  };

  const sidebarContent = (mobile = false) => (
    <div className="flex h-full flex-col bg-sidebar-background text-sidebar-foreground">
      {mobile && (
        <div className="border-b border-sidebar-border p-4">
          <nav className="space-y-1">
            <NavLink
              to="/app"
              end
              onClick={closeMobileNavigation}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeClassName="bg-sidebar-accent font-medium"
            >
              <House className="h-4 w-4" />
              Home
            </NavLink>
            <NavLink
              to="/app/readers"
              onClick={closeMobileNavigation}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeClassName="bg-sidebar-accent font-medium"
            >
              <Users className="h-4 w-4" />
              Readers
            </NavLink>
          </nav>
        </div>
      )}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-4">
          <Book className="h-5 w-5 text-sidebar-primary" />
          <h2 className="font-semibold text-sidebar-foreground">Chapters</h2>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chapter
          </Button>
        )}
        {isAdmin && (
          <div className="mt-2 space-y-1">
            {orderSaving && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving order…</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Drag chapters to reorder
            </p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : chapters.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No chapters yet.
            {isAdmin && " Create one to get started!"}
          </div>
        ) : (
          <nav className="p-2 space-y-1">
            {chapters.map((chapter, index) => (
              <Fragment key={chapter.id}>
                {dropIndicatorIndex === index && (
                  <div className="mx-4 my-1 h-0.5 rounded-full bg-sidebar-primary/80" />
                )}
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2 py-1",
                    draggingChapterId === chapter.id && "border border-sidebar-primary/40 bg-sidebar-accent/40",
                  )}
                  onDragOver={(event) => handleChapterDragOver(event, chapter.id, index)}
                  onDrop={(event) => handleChapterDrop(event, chapter.id)}
                >
                  {isAdmin && (
                    <span
                      className="text-muted-foreground cursor-grab active:cursor-grabbing"
                      draggable={isAdmin && !orderSaving}
                      onDragStart={(event) => handleChapterDragStart(event, chapter.id)}
                      onDragEnd={handleChapterDragEnd}
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                  )}
                  <NavLink
                    to={`/app/chapters/${chapter.slug}`}
                    onClick={mobile ? closeMobileNavigation : undefined}
                    className="flex-1 block px-3 py-2 rounded-xl text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    activeClassName="bg-sidebar-accent font-medium"
                  >
                    {chapter.title}
                  </NavLink>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!orderSaving && !chapterDeleting) {
                          setChapterPendingDeletion(chapter);
                        }
                      }}
                      disabled={orderSaving || chapterDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Fragment>
            ))}
            <div
              className="relative h-6"
              onDragOver={(event) => handleChapterDragOver(event, null, null)}
              onDrop={(event) => handleChapterDrop(event, null)}
            >
              {dropIndicatorIndex === chapters.length && (
                <span className="pointer-events-none absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 rounded-full bg-sidebar-primary/80" />
              )}
            </div>
          </nav>
        )}
      </ScrollArea>
    </div>
  );

  return (
    <>
      <aside className="hidden w-56 border-r border-sidebar-border bg-sidebar-background md:flex md:flex-col">
        {sidebarContent()}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-[88vw] max-w-sm border-sidebar-border bg-sidebar-background p-0 text-sidebar-foreground shadow-2xl [background:hsl(var(--sidebar-background))]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Browse chapters and manage content.</SheetDescription>
          </SheetHeader>
          {sidebarContent(true)}
        </SheetContent>
      </Sheet>

      <CreateChapterDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onChapterCreated={fetchChapters}
      />

      <AlertDialog
        open={!!chapterPendingDeletion}
        onOpenChange={(open) => {
          if (!open && !chapterDeleting) {
            setChapterPendingDeletion(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chapter?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the chapter
              {chapterPendingDeletion?.title ? ` "${chapterPendingDeletion.title}"` : ""} and all of its pages.
              Markdown files will be deleted permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={chapterDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteChapter}
              disabled={chapterDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {chapterDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
