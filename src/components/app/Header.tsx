import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Gamepad2, LogOut, Menu, Shield, Star, User as UserIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useXp } from "./XpProvider";

interface HeaderProps {
  user: User | null;
  isAdmin: boolean;
  onOpenNavigation: () => void;
}

export const Header = ({ user, isAdmin, onOpenNavigation }: HeaderProps) => {
  const navigate = useNavigate();
  const { exp, setCounterRef, pulse } = useXp();
  const navLinks = [
    { label: "Home", to: "/app", end: true },
    { label: "Readers", to: "/app/readers" },
  ];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to logout");
    } else {
      toast.success("Logged out successfully");
      navigate("/auth");
    }
  };

  return (
    <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onOpenNavigation}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex min-w-0 items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <h1 className="truncate text-base font-semibold sm:text-lg">Game Art Guidebook</h1>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              activeClassName="bg-muted text-foreground"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div
          ref={setCounterRef}
          className={`group flex items-center gap-2 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-primary shadow-sm transition-transform duration-150 sm:px-3 sm:text-sm ${pulse ? "scale-[1.08]" : "scale-100"}`}
        >
          <Star className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
          <span className="tabular-nums">{exp} XP</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="max-w-[11rem] px-2 sm:max-w-none sm:px-3">
              <UserIcon className="h-4 w-4 sm:mr-2" />
              <span className="hidden truncate sm:inline">{user?.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/app/account")}>
              <UserIcon className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isAdmin && (
              <DropdownMenuItem disabled>
                <Shield className="h-4 w-4 mr-2" />
                Admin Access
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
