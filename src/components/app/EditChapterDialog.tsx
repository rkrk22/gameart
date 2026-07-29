import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase, Chapter } from "@/lib/supabase";
import { toast } from "sonner";

interface EditChapterDialogProps {
  chapter: Chapter | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChapterUpdated: (chapter: Chapter) => void;
}

export const EditChapterDialog = ({
  chapter,
  open,
  onOpenChange,
  onChapterUpdated,
}: EditChapterDialogProps) => {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTitle(chapter?.title ?? "");
  }, [chapter]);

  const handleSave = async () => {
    if (!chapter) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Please enter a chapter title");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("chapters")
        .update({ title: trimmedTitle })
        .eq("id", chapter.id)
        .select("*")
        .single();

      if (error) throw error;

      toast.success("Chapter renamed");
      onChapterUpdated(data);
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to rename chapter";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Chapter Title</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-chapter-title">Chapter Title</Label>
            <Input
              id="edit-chapter-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g., Character Design Basics"
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
