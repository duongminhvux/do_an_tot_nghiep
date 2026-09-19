'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Lock, Mail, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '@/services';
import { ResetPasswordDto } from '@/types';

interface ResetPasswordFormData extends ResetPasswordDto {
  confirmPassword?: string;
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const initialEmail = searchParams.get('email') || '';
  const { t } = useTranslation('auth');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    defaultValues: {
      email: initialEmail,
      code: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (initialEmail) {
      setValue('email', initialEmail);
    }
  }, [initialEmail, setValue]);

  const passwordValue = watch('newPassword');

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      const res = await authService.resetPassword({
        email: data.email,
        code: data.code,
        newPassword: data.newPassword,
      });

      setSuccessMessage(res.message || t('reset.success'));
      setTimeout(() => {
        router.push(`/${locale}/login`);
      }, 1500);
    } catch (err: any) {
      const rawMsg = err?.response?.data?.message;
      const msg = Array.isArray(rawMsg)
        ? rawMsg.join('. ')
        : typeof rawMsg === 'string'
          ? rawMsg
          : err?.message || t('reset.err_reset_failed');
      setErrorMessage(msg);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30 mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('reset.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('reset.subtitle')}
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
        {/* Email */}
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('reset.email')}
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
              placeholder={t('reset.email_placeholder')}
              {...register('email', {
                required: t('reset.err_required_email'),
              })}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
          )}
        </div>

        {/* Code */}
        <div className="space-y-1">
          <label
            htmlFor="code"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('reset.code')}
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              id="code"
              type="text"
              className={`w-full h-11 pl-10 pr-4 text-sm rounded-xl border tracking-wider bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                errors.code
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 bg-red-50/30'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/15'
              }`}
              placeholder={t('reset.code_placeholder')}
              {...register('code', {
                required: t('reset.err_required_code'),
              })}
            />
          </div>
          {errors.code && (
            <p className="text-xs text-red-500 font-medium">{errors.code.message}</p>
          )}
        </div>

        {/* New Password */}
        <div className="space-y-1">
          <label
            htmlFor="newPassword"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('reset.new_password')}
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              className={`w-full h-11 pl-10 pr-11 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                errors.newPassword
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 bg-red-50/30'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/15'
              }`}
              placeholder={t('reset.new_password_placeholder')}
              {...register('newPassword', {
                required: t('reset.err_required_password'),
                minLength: {
                  value: 6,
                  message: t('reset.err_min_password'),
                },
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
          {errors.newPassword && (
            <p className="text-xs text-red-500 font-medium">{errors.newPassword.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('reset.confirm_password')}
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              className={`w-full h-11 pl-10 pr-11 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                errors.confirmPassword
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 bg-red-50/30'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/15'
              }`}
              placeholder={t('reset.confirm_password_placeholder')}
              {...register('confirmPassword', {
                required: t('reset.err_confirm_password'),
                validate: (value) =>
                  value === passwordValue || t('reset.err_password_mismatch'),
              })}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label="Toggle confirm password visibility"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-red-500 font-medium">
              {errors.confirmPassword.message}
            </p>
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
            <span>{t('reset.submit')}</span>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-slate-600 mt-6">
        <Link
          href={`/${locale}/login`}
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          {t('reset.back_to_login')}
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-500 p-4">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
