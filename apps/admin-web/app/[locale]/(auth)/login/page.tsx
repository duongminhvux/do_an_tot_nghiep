'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Shield, Lock, User, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '@/services';
import { useAppDispatch } from '@/redux/hooks';
import { setCredentials } from '@/redux/features/auth/authSlice';
import { LoginDto } from '@/types';

function AdminLoginForm() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'vi';
  const dispatch = useAppDispatch();
  const { t } = useTranslation('auth');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('error') === 'unauthorized') {
      setErrorMessage(t('login.err_unauthorized'));
    }
  }, [searchParams, t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginDto>({
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginDto) => {
    try {
      setErrorMessage(null);
      const payload: LoginDto = {
        ...data,
        email: data.email || data.username,
      };

      const res = await authService.login(payload);
      const { accessToken, profile } = res.data;

      // Validate Admin role
      if (profile.role !== 'ADMIN') {
        setErrorMessage(t('login.err_unauthorized'));
        return;
      }

      dispatch(setCredentials({ user: profile, accessToken }));
      router.push(`/${locale}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t('login.err_login_failed');
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/25 mb-3">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('login.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('login.subtitle')}
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl text-sm leading-snug bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Username / Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="username"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('login.username_or_email')}
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <input
              id="username"
              type="text"
              autoComplete="username"
              className={`w-full h-11 pl-10 pr-4 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                errors.username
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 bg-red-50/30'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/15'
              }`}
              placeholder={t('login.username_placeholder')}
              {...register('username', {
                required: t('login.err_required_username'),
              })}
            />
          </div>
          {errors.username && (
            <p className="text-xs text-red-500 font-medium">
              {errors.username.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('login.password')}
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`w-full h-11 pl-10 pr-11 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                errors.password
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 bg-red-50/30'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/15'
              }`}
              placeholder={t('login.password_placeholder')}
              {...register('password', {
                required: t('login.err_required_password'),
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500 font-medium">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer pt-0.5 mt-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('login.submitting')}</span>
            </>
          ) : (
            <span>{t('login.submit')}</span>
          )}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
