import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useAuth } from "./auth-context";
import { ApiError } from "@/api/client";

const schema = z.object({
  companyName: z.string().min(2),
  baseCurrencyCode: z
    .string()
    .min(2)
    .max(3)
    .transform((v) => v.toUpperCase()),
  adminFullName: z.string().min(2),
  adminEmail: z.string().min(1).email(),
  adminPassword: z.string().min(8),
});
type FormValues = z.infer<typeof schema>;

export function RegisterCompanyPage() {
  const { t } = useTranslation();
  const { registerCompany, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await registerCompany(values);
      navigate("/", { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : t("common.errorGeneric"));
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-sunken px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h1 className="mb-6 text-center text-lg font-semibold text-foreground">{t("auth.registerCompany")}</h1>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && <Alert variant="error">{serverError}</Alert>}

          <FormField label={t("auth.companyName")} htmlFor="companyName" error={errors.companyName?.message}>
            <Input id="companyName" invalid={!!errors.companyName} {...register("companyName")} />
          </FormField>

          <FormField
            label={t("auth.baseCurrency")}
            htmlFor="baseCurrencyCode"
            error={errors.baseCurrencyCode?.message}
            hint="مثال: JOD، USD، SAR، EUR"
          >
            <Input
              id="baseCurrencyCode"
              maxLength={3}
              className="uppercase"
              invalid={!!errors.baseCurrencyCode}
              {...register("baseCurrencyCode")}
            />
          </FormField>

          <div className="h-px bg-border" />

          <FormField label={t("auth.adminFullName")} htmlFor="adminFullName" error={errors.adminFullName?.message}>
            <Input id="adminFullName" invalid={!!errors.adminFullName} {...register("adminFullName")} />
          </FormField>

          <FormField label={t("auth.adminEmail")} htmlFor="adminEmail" error={errors.adminEmail?.message}>
            <Input
              id="adminEmail"
              type="email"
              autoComplete="email"
              invalid={!!errors.adminEmail}
              {...register("adminEmail")}
            />
          </FormField>

          <FormField
            label={t("auth.adminPassword")}
            htmlFor="adminPassword"
            error={errors.adminPassword?.message}
            hint="8 أحرف على الأقل"
          >
            <Input
              id="adminPassword"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.adminPassword}
              {...register("adminPassword")}
            />
          </FormField>

          <Button type="submit" loading={isSubmitting} className="mt-2">
            {t("auth.registerCompany")}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          <Link to="/login" className="text-primary hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
