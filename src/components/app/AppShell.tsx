import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const AppShell = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [showAdminElevation, setShowAdminElevation] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    const checkAdminSlot = async () => {
      if (!user || !profile || profile.role === "admin") {
        setShowAdminElevation(false);
        return;
      }

      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1);

      if (!admins || admins.length === 0) {
        const adminEmails = import.meta.env.VITE_ADMIN_EMAILS?.split(",").map((e: string) => e.trim()) || [];
        if (adminEmails.includes(user.email || "")) {
          setShowAdminElevation(true);
        }
      } else {
        setShowAdminElevation(false);
      }

    };

    // Only run once user/profile are available.
    if (user && profile) {
      checkAdminSlot();
    } else {
      setShowAdminElevation(false);
    }
  }, [user, profile]);

  const handleElevateToAdmin = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id);

      if (error) throw error;

      toast.success("You are now an admin!");
      setShowAdminElevation(false);
      await refreshProfile();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to elevate to admin";
      toast.error(message);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar
        isAdmin={profile?.role === 'admin'}
        mobileOpen={mobileNavigationOpen}
        onMobileOpenChange={setMobileNavigationOpen}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          user={user}
          isAdmin={profile?.role === 'admin'}
          onOpenNavigation={() => setMobileNavigationOpen(true)}
        />

        {showAdminElevation && (
          <div className="bg-accent/20 border-b border-accent p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4" />
              <span>You're eligible to become an admin (first user or in ADMIN_EMAILS)</span>
            </div>
            <Button size="sm" onClick={handleElevateToAdmin}>
              Set as Admin
            </Button>
          </div>
        )}

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
