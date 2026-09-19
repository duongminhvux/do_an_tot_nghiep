'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Mail, HelpCircle, AlertCircle, ArrowLeft, Send } from 'lucide-react';
import { authService } from '@/services';
import { ForgotPasswordDto } from '@/types';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('auth');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordDto>({
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordDto) => {
    try {
      setErrorMessage(null);
      await authService.forgotPassword(data);
      router.push(`/${locale}/reset-password?email=${encodeURIComponent(data.email)}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t('forgot.err_forgot_failed');
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30 mb-3">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('forgot.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('forgot.subtitle')}
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl text-sm leading-snug bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
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
            {t('forgot.email')}
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email"
              type="email"
              className={`w-full h-11 pl-10 pr-4 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                errors.email
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 bg-red-50/30'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/15'
              }`}
              placeholder={t('forgot.email_placeholder')}
              {...register('email', {
                required: t('forgot.err_required_email'),
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: t('forgot.err_invalid_email'),
                },
              })}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
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
            <>
              <Send className="w-4 h-4" />
              <span>{t('forgot.submit')}</span>
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-slate-600 mt-6">
        <Link
          href={`/${locale}/login`}
          className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {t('forgot.back_to_login')}
        </Link>
      </p>
    </div>
  );
}
