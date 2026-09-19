'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { UserPlus, Lock, Mail, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { authService } from '@/services';
import { RegisterDto } from '@/types';

interface RegisterFormData extends RegisterDto {
  confirmPassword?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('auth');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setErrorMessage(null);
      await authService.register({
        username: data.username,
        email: data.email,
        password: data.password,
      });

      router.push(`/${locale}/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        t('register.err_register_failed');
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/30 mb-3">
          <UserPlus className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('register.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('register.subtitle')}
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5" noValidate>
        {/* Username */}
        <div className="space-y-1">
          <label
            htmlFor="username"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('register.username')}
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <input
              id="username"
              type="text"
              className={`w-full h-11 pl-10 pr-4 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                errors.username
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 bg-red-50/30'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/15'
              }`}
              placeholder={t('register.username_placeholder')}
              {...register('username', {
                required: t('register.err_required_username'),
                minLength: {
                  value: 3,
                  message: t('register.err_min_username'),
                },
              })}
            />
          </div>
          {errors.username && (
            <p className="text-xs text-red-500 font-medium">{errors.username.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('register.email')}
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
              placeholder={t('register.email_placeholder')}
              {...register('email', {
                required: t('register.err_required_email'),
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: t('register.err_invalid_email'),
                },
              })}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('register.password')}
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={`w-full h-11 pl-10 pr-11 text-sm rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
                errors.password
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 bg-red-50/30'
                  : 'border-slate-300 focus:border-blue-600 focus:ring-blue-500/15'
              }`}
              placeholder={t('register.password_placeholder')}
              {...register('password', {
                required: t('register.err_required_password'),
                minLength: {
                  value: 6,
                  message: t('register.err_min_password'),
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
          {errors.password && (
            <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-semibold text-slate-700"
          >
            {t('register.confirm_password')}
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
              placeholder={t('register.password_placeholder')}
              {...register('confirmPassword', {
                required: t('register.err_confirm_password'),
                validate: (value) =>
                  value === passwordValue || t('register.err_password_mismatch'),
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
            <>
              <UserPlus className="w-4 h-4" />
              <span>{t('register.submit')}</span>
            </>
          )}
        </button>
      </form>

      {/* Footer Link */}
      <p className="text-center text-sm text-slate-600 mt-6">
        {t('register.have_account')}{' '}
        <Link
          href={`/${locale}/login`}
          className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          {t('register.login_now')}
        </Link>
      </p>
    </div>
  );
}
