import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase, Page } from "@/lib/supabase";
import { isDividerPage } from "@/lib/pageDividers";
import { toast } from "sonner";

interface EditPageTitleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: Page | null;
  onPageUpdated: (page: Page) => void;
}

const replaceFirstMarkdownHeading = (content: string, title: string) => {
  if (/^#\s+.+$/m.test(content)) {
    return content.replace(/^#\s+.+$/m, `# ${title}`);
  }

  return `# ${title}\n\n${content}`.trimEnd();
};

export const EditPageTitleDialog = ({
  open,
  onOpenChange,
  page,
  onPageUpdated,
}: EditPageTitleDialogProps) => {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitle(page?.title ?? "");
  }, [page]);

  const handleSave = async () => {
    if (!page) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Please enter a page title");
      return;
    }

    setLoading(true);

    try {
      if (!isDividerPage(page)) {
        const response = await fetch(`/api/content/pages/${page.slug}`);
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to load markdown file");
        }

        const nextContent = replaceFirstMarkdownHeading(await response.text(), trimmedTitle);
        const updateResponse = await fetch(`/api/content/pages/${page.slug}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: nextContent }),
        });

        if (!updateResponse.ok) {
          const message = await updateResponse.text();
          throw new Error(message || "Failed to update markdown file");
        }
      }

      const timestamp = new Date().toISOString();
      const { data, error } = await supabase
        .from("pages")
        .update({ title: trimmedTitle, updated_at: timestamp })
        .eq("id", page.id)
        .select("*")
        .single();

      if (error) throw error;

      toast.success("Page renamed");
      onPageUpdated(data);
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to rename page";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Page Title</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-page-title">Page Title</Label>
            <Input
              id="edit-page-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g., Color Theory"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
