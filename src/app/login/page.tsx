import { GraduationCap } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <GraduationCap className="size-12 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">University Course Finder</h1>
        <p className="max-w-md text-muted-foreground">
          Discover and shortlist university courses worldwide with AI-powered search
        </p>
      </div>
      <AuthForm
        redirectTo={safeNextPath(params.redirect)}
        authError={params.error === "auth"}
      />
    </div>
  );
}
