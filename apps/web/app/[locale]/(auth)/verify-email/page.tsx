'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyRound, Mail, AlertCircle, CheckCircle2, RotateCw } from 'lucide-react';
import { authService } from '@/services';
import { VerifyEmailDto } from '@/types';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const initialEmail = searchParams.get('email') || '';
  const { t } = useTranslation('auth');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailDto>({
    defaultValues: {
      email: initialEmail,
      code: '',
    },
  });

  useEffect(() => {
    if (initialEmail) {
      setValue('email', initialEmail);
    }
  }, [initialEmail, setValue]);

  // Timer countdown for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const currentEmail = watch('email');

  const onSubmit = async (data: VerifyEmailDto) => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      const res = await authService.verifyEmail(data);
      setSuccessMessage(res.message || t('verify.resend_success'));
      setTimeout(() => {
        router.push(`/${locale}/login`);
      }, 1500);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t('verify.err_verify_failed');
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleResendCode = async () => {
    if (!currentEmail || resendCountdown > 0) return;
    try {
      setIsResending(true);
      setErrorMessage(null);
      await authService.resendCode(currentEmail);
      setSuccessMessage(t('verify.resend_success'));
      setResendCountdown(60);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t('verify.err_resend_failed');
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30 mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('verify.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('verify.subtitle')}
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl text-sm leading-snug bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl text-sm leading-snug bg-green-50 text-green-700 border border-green-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-500" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('verify.email')}
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email"
              type="email"
              readOnly
              className={`w-full h-11 pl-10 pr-4 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                errors.email
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 bg-red-50/30'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/15'
              }`}
              placeholder={t('verify.email_placeholder')}
              {...register('email', {
                required: t('verify.err_required_email'),
              })}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
          )}
        </div>

        {/* Code */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="code"
              className="text-sm font-semibold text-slate-700"
            >
              {t('verify.code')}
            </label>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCountdown > 0 || isResending || !currentEmail}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {resendCountdown > 0
                ? t('verify.resend_in', { seconds: resendCountdown })
                : t('verify.resend_code')}
            </button>
          </div>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <RotateCw className="w-4 h-4" />
            </div>
            <input
              id="code"
              type="text"
              className={`w-full h-11 pl-10 pr-4 text-sm rounded-xl border tracking-widest font-mono bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                errors.code
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 bg-red-50/30'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/15'
              }`}
              placeholder={t('verify.code_placeholder')}
              maxLength={10}
              {...register('code', {
                required: t('verify.err_required_code'),
                minLength: {
                  value: 4,
                  message: t('verify.err_min_code'),
                },
              })}
            />
          </div>
          {errors.code && (
            <p className="text-xs text-red-500 font-medium">{errors.code.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span>{t('verify.submit')}</span>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-slate-600 mt-6">
        <Link
          href={`/${locale}/login`}
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          {t('verify.back_to_login')}
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-500 p-4">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
