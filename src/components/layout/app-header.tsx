"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, LogOut, Menu, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/shortlist", label: "Shortlist", icon: Star },
];

function NavLinks({
  pathname,
  mobile = false,
}: {
  pathname: string;
  mobile?: boolean;
}) {
  return (
    <>
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            mobile && "text-base"
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </>
  );
}

interface AppHeaderProps {
  userEmail?: string | null;
}

export function AppHeader({ userEmail }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/search" className="flex items-center gap-2 font-semibold">
          <GraduationCap className="size-6 text-primary" />
          <span className="hidden sm:inline">University Course Finder</span>
          <span className="sm:hidden">UCF</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLinks pathname={pathname} />
        </nav>

        <div className="flex items-center gap-2">
          {userEmail && (
            <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground lg:inline">
              {userEmail}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="hidden sm:flex">
            <LogOut className="size-4" />
            Sign out
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-8 flex flex-col gap-2">
                <NavLinks pathname={pathname} mobile />
                <Button variant="outline" onClick={handleSignOut} className="mt-4">
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
