"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface AuthFormProps {
  redirectTo?: string;
  authError?: boolean;
}

export function AuthForm({
  redirectTo = "/search",
  authError = false,
}: AuthFormProps) {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (authError) {
      toast.error("Sign-in was cancelled or failed. Please try again.");
    }
  }, [authError]);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(redirectTo);
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "azure") {
    setLoading(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        ...(provider === "google"
          ? {
              queryParams: {
                access_type: "offline",
                prompt: "select_account",
              },
            }
          : {
              // Azure must return a verified email or Supabase Auth rejects the user.
              scopes: "email",
            }),
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-border/60 shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          {isSignUp ? "Create account" : "Welcome back"}
        </CardTitle>
        <CardDescription>
          Sign in to search universities and manage your shortlist
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => handleOAuth("google")}
            className="w-full"
          >
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => handleOAuth("azure")}
            className="w-full"
          >
            Continue with Microsoft
          </Button>
        </div>

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            or use email
          </span>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait..." : isSignUp ? "Sign up" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "Sign in" : "Create one"}
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
