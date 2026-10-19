"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { AlertTriangle, KeyRound, LogIn, ShieldCheck } from "lucide-react";
import { TextField } from "@/components/forms/fields";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubscription } from "@/hooks/use-tenant";
import { isSuperAdminLogin, usePlatformStore } from "@/lib/stores/platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useZodForm } from "@/hooks/use-zod-form";
import { APP_CONFIG } from "@/lib/config";
import { ROLE_LABELS, TWO_FACTOR_ROLES } from "@/lib/permissions";
import type { Staff } from "@/lib/schemas/admin";
import { hasCustomPassword, verifyPassword } from "@/lib/services/auth";
import { signIn } from "@/lib/services/workflows";
import { audit } from "@/lib/stores/audit";
import { useSessionStore } from "@/lib/stores/session";
import { useStaffStore } from "@/lib/stores/staff";
import { cn } from "@/lib/utils/cn";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type LoginInput = z.infer<typeof loginSchema>;

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });
type CodeInput = z.infer<typeof codeSchema>;

function initials(name: string): string {
  return name
    .replace(/^Dr\.\s*/, "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
}

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const staff = useStaffStore((s) => s.staff);
  const userId = useSessionStore((s) => s.userId);
  const signInSuperAdmin = usePlatformStore((s) => s.signInSuperAdmin);
  const { status, message, tenant } = useSubscription();
  const [pending, setPending] = useState<Staff | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useZodForm<LoginInput>(loginSchema, { email: "", password: "" });
  const codeForm = useZodForm<CodeInput>(codeSchema, { code: "" });
  const suspended = status === "suspended";
  const next = suspended ? "/subscription" : (params.get("from") ?? "/dashboard");
  const hospitalName = tenant?.name ?? APP_CONFIG.name;
  const tagline = tenant?.tagline || APP_CONFIG.tagline;

  useEffect(() => {
    if (userId) router.replace(suspended ? "/subscription" : "/dashboard");
  }, [userId, router, suspended]);

  const complete = (member: Staff) => {
    signIn(member);
    router.replace(next.startsWith("/") ? next : "/dashboard");
  };

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    if (await isSuperAdminLogin(values.email, values.password)) {
      signInSuperAdmin();
      router.replace("/platform");
      return;
    }
    const member = staff.find((s) => s.email.toLowerCase() === values.email.toLowerCase());
    if (!member || !(await verifyPassword(member.id, values.password))) {
      audit("access-denied", "session", `Failed sign-in attempt for ${values.email}`);
      setFormError(
        "Email or password is incorrect. Accounts that have not changed their password use the demo password shown below.",
      );
      return;
    }
    if (!member.active) {
      setFormError("This account has been deactivated. Ask an administrator to reactivate it.");
      return;
    }
    if (suspended && member.role !== "admin") {
      setFormError(
        `${hospitalName} is suspended. Only the hospital administrator can sign in to renew or contact support.`,
      );
      return;
    }
    if (TWO_FACTOR_ROLES.includes(member.role)) {
      setPending(member);
      return;
    }
    complete(member);
  };

  const onCode = (values: CodeInput) => {
    if (!pending) return;
    if (values.code !== APP_CONFIG.twoFactorCode) {
      codeForm.setError("code", { message: "That code is not correct. Use the demo code shown." });
      return;
    }
    complete(pending);
  };

  const pick = (member: Staff) => {
    form.setValue("email", member.email, { shouldValidate: true });
    setFormError(null);
    if (hasCustomPassword(member.id)) {
      form.setValue("password", "");
      form.setFocus("password");
      setFormError(`${member.name} has set a personal password — please type it.`);
      return;
    }
    form.setValue("password", APP_CONFIG.demoPassword, { shouldValidate: true });
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="from-primary relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br to-[color-mix(in_srgb,var(--primary)_55%,black)] p-10 text-white lg:flex">
        <div className="grid gap-3">
          <BrandLogo variant="white" className="h-14 self-start" />
          <p className="text-sm font-medium tracking-wide text-white/80 uppercase">{tagline}</p>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl leading-tight font-semibold">
            Every cycle, every embryo, every naira — in one calm workspace.
          </h1>
          <p className="mt-4 text-white/80">
            Waiting list to live birth: stimulation monitoring, embryology and cryo-storage, donor and surrogacy
            programmes, pharmacy and billing for IVF teams.
          </p>
        </div>
        <p className="text-xs text-white/60">Demo build · all patients, staff and records are synthetic.</p>
        <div className="bg-rose/30 absolute -right-24 -bottom-24 size-80 rounded-full blur-3xl" aria-hidden="true" />
      </section>

      <section className="flex flex-col items-center justify-center gap-6 p-6 lg:p-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandLogo compact className="h-14" />
          <p className="text-lg font-semibold">{hospitalName}</p>
          <p className="text-muted-foreground text-sm">{tagline}</p>
        </div>
        {message && status !== "active" ? (
          <Alert variant={suspended ? "destructive" : "default"} className="w-full max-w-md">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>{suspended ? "Hospital suspended" : "Subscription notice"}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              {pending ? (
                <ShieldCheck className="text-primary size-5" aria-hidden="true" />
              ) : (
                <LogIn className="text-primary size-5" aria-hidden="true" />
              )}
              {pending ? "Two-step verification" : "Sign in"}
            </CardTitle>
            <CardDescription>
              {pending
                ? `Enter the 6-digit code sent to ${pending.name}'s phone. Demo code: ${APP_CONFIG.twoFactorCode}`
                : "Pick a demo role below or enter your staff email."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pending ? (
              <Form {...codeForm}>
                <form onSubmit={codeForm.handleSubmit(onCode)} className="grid gap-4" noValidate>
                  <TextField
                    control={codeForm.control}
                    name="code"
                    label="Verification code"
                    required
                    autoComplete="one-time-code"
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setPending(null)}>
                      Back
                    </Button>
                    <Button type="submit" className="flex-1">
                      <KeyRound aria-hidden="true" /> Verify and continue
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
                  <TextField
                    control={form.control}
                    name="email"
                    label="Email"
                    type="email"
                    required
                    autoComplete="username"
                  />
                  <TextField
                    control={form.control}
                    name="password"
                    label="Password"
                    type="password"
                    required
                    autoComplete="current-password"
                    description={`Demo password (until a user changes it): ${APP_CONFIG.demoPassword}`}
                  />
                  {formError ? (
                    <p role="alert" className="text-destructive text-sm">
                      {formError}
                    </p>
                  ) : null}
                  <Button type="submit">
                    <LogIn aria-hidden="true" /> Sign in
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        {!pending ? (
          <div className="w-full max-w-3xl">
            <p className="text-muted-foreground mb-2 text-center text-xs font-medium tracking-wide uppercase">
              Quick pick — demo users
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {staff
                .filter((s) => s.active)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s)}
                    className={cn(
                      "bg-card hover:border-primary/50 focus-visible:ring-ring flex items-center gap-2 rounded-lg border p-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      form.watch("email") === s.email && "border-primary ring-primary/30 ring-2",
                    )}
                  >
                    <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {initials(s.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        {ROLE_LABELS[s.role]}
                        {TWO_FACTOR_ROLES.includes(s.role) ? (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            2FA
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
