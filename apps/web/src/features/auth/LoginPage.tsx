import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useAuth } from "./auth-context";
import { ApiError } from "@/api/client";

const schema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isAuthenticated) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setServerError(t("auth.loginError"));
      } else {
        setServerError(t("common.errorGeneric"));
      }
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-lg font-bold text-on-primary">
            أ
          </div>
          <h1 className="text-lg font-semibold text-foreground">{t("common.appName")}</h1>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && <Alert variant="error">{serverError}</Alert>}

          <FormField label={t("auth.email")} htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register("email")} />
          </FormField>

          <FormField label={t("auth.password")} htmlFor="password" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.password}
              {...register("password")}
            />
          </FormField>

          <Button type="submit" loading={isSubmitting} className="mt-2">
            {t("auth.loginButton")}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          <Link to="/register-company" className="text-primary hover:underline">
            {t("auth.registerCompany")}
          </Link>
        </p>
      </div>
    </div>
  );
}
