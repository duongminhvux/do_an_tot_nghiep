"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Ban,
  ChevronRight,
  LockKeyhole,
  LockOpen,
  MailPlus,
  Plus,
  RefreshCw,
  Search,
  UserCog,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAppSelector } from "@/redux/hooks";
import { canManageIam } from "@/lib/admin-permissions";
import {
  iamService,
  iamErrorCode,
  type AdminQuery,
  type AdminStatus,
  type IamAdmin,
  type IamRole,
  type Delivery,
} from "@/services/iam.service";
import {
  AdminAvatar,
  ConfirmDialog,
  DeliveryNotice,
  IamFrame,
  Notice,
  StatusBadge,
  fieldClass,
  labelClass,
  panelClass,
} from "./iam-shared";

const STATUSES = [
  "ACTIVE",
  "PENDING_ACTIVATION",
  "SUSPENDED",
  "DISABLED",
] as const satisfies readonly AdminStatus[];

interface PendingConfirm {
  run: () => Promise<unknown>;
  title?: string;
  description?: string;
  label?: string;
  destructive?: boolean;
}

function SectionTitle({
  children,
  action,
  id,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 id={id} className="text-sm font-semibold text-slate-900">
        {children}
      </h3>
      {action}
    </div>
  );
}

function AccessAction({
  icon: Icon,
  title,
  help,
  danger = false,
  children,
}: {
  icon: typeof LockKeyhole;
  title: string;
  help: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${danger ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${danger ? "text-red-700" : "text-slate-900"}`}
        >
          {title}
        </p>
        <p className="text-xs text-slate-500">{help}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function AdminAccountsPage() {
  const { t, i18n } = useTranslation("iam"),
    user = useAppSelector((state) => state.auth.user);
  const [query, setQuery] = useState<AdminQuery>({ page: 1, limit: 10 }),
    [search, setSearch] = useState("");
  const [items, setItems] = useState<IamAdmin[]>([]),
    [total, setTotal] = useState(0),
    [counts, setCounts] = useState<Partial<Record<AdminStatus, number>>>({}),
    [roles, setRoles] = useState<IamRole[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<IamAdmin | null>(null),
    [creating, setCreating] = useState(false),
    [email, setEmail] = useState(""),
    [fullName, setFullName] = useState(""),
    [roleIds, setRoleIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [dialogError, setDialogError] = useState(""),
    [delivery, setDelivery] = useState<Delivery | null>(null),
    [success, setSuccess] = useState(""),
    [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({}),
    [now, setNow] = useState(Date.now());
  const sequence = useRef(0);
  const opener = useRef<HTMLElement | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const id = ++sequence.current;
      setLoading(true);
      setError("");
      try {
        // Per-status totals respect the search and role filters, not the status tab itself.
        const scope = {
          search: query.search,
          roleId: query.roleId,
          page: 1,
          limit: 1,
        };
        const [list, available, ...perStatus] = await Promise.all([
          iamService.admins(query, signal),
          iamService.roles(signal),
          ...STATUSES.map((status) =>
            iamService.admins({ ...scope, status }, signal),
          ),
        ]);
        if (id === sequence.current) {
          setItems(list.items);
          setTotal(list.total);
          setRoles(available);
          setCounts(
            Object.fromEntries(
              STATUSES.map((status, index) => [status, perStatus[index]!.total]),
            ),
          );
        }
      } catch (e) {
        if (id === sequence.current) setError(iamErrorCode(e));
      } finally {
        if (id === sequence.current) setLoading(false);
      }
    },
    [query],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
      sequence.current++;
    };
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Debounced search keeps typing responsive without a separate submit step.
  useEffect(() => {
    const value = search.trim();
    if (value === (query.search || "")) return;
    const timer = setTimeout(
      () => setQuery((current) => ({ ...current, search: value, page: 1 })),
      300,
    );
    return () => clearTimeout(timer);
  }, [search, query.search]);

  const open = async (admin?: IamAdmin) => {
    opener.current = document.activeElement as HTMLElement;
    setDialogError("");
    setDelivery(null);
    setSuccess("");
    if (!admin) {
      setCreating(true);
      setSelected(null);
      setEmail("");
      setFullName("");
      setRoleIds([]);
      return;
    }
    try {
      const detail = await iamService.admin(admin.id);
      setSelected(detail);
      setCreating(false);
      setEmail(detail.email);
      setFullName(detail.fullName || "");
      setRoleIds(detail.roles.map((r) => r.id));
    } catch (e) {
      setError(iamErrorCode(e));
    }
  };
  const close = () => {
    if (!busy) {
      setSelected(null);
      setCreating(false);
      setDialogError("");
    }
  };
  const perform = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setDialogError("");
    setSuccess("");
    try {
      await work();
      setConfirm(null);
      setSuccess("saved");
      await load();
      window.dispatchEvent(new Event("admin-permissions-refresh"));
    } catch (e) {
      setConfirm(null);
      setDialogError(iamErrorCode(e));
    } finally {
      setBusy(false);
    }
  };
  const setStatus = (
    status: Exclude<AdminStatus, "PENDING_ACTIVATION">,
    copy: Omit<PendingConfirm, "run">,
  ) =>
    setConfirm({
      ...copy,
      run: async () => {
        await iamService.status(selected!.id, status);
        setSelected({ ...selected!, status });
      },
    });
  const reinvite = () =>
    setConfirm({
      title: t("confirmReinviteTitle"),
      description: t("confirmReinviteHelp"),
      label: t("reinvite"),
      run: async () => {
        const id = selected!.id;
        try {
          const result = await iamService.reinvite(id);
          setDelivery(result);
          // Reinviting a locked, never-activated account returns it to pending.
          setSelected(await iamService.admin(id));
          setCooldowns((values) => ({ ...values, [id]: Date.now() + 60000 }));
        } catch (e) {
          if (iamErrorCode(e) === "cooldownError")
            setCooldowns((values) => ({
              ...values,
              [id]: Date.now() + 60000,
            }));
          throw e;
        }
      },
    });

  // Older API responses lack hasPassword; fall back to the activation timestamp.
  const neverActivated = selected
    ? selected.hasPassword === undefined
      ? !selected.activatedAt
      : !selected.hasPassword
    : false;
  const cooldown = selected
    ? Math.max(0, Math.ceil(((cooldowns[selected.id] || 0) - now) / 1000))
    : 0;
  const rolesChanged =
    !!selected &&
    JSON.stringify([...roleIds].sort()) !==
      JSON.stringify(selected.roles.map((r) => r.id).sort());
  const canEdit = creating
    ? canManageIam(user, "admins.create")
    : canManageIam(user, "admins.update");
  const canLock = canManageIam(user, "admins.lock");
  const showLock =
    canLock &&
    !!selected &&
    (selected.status === "ACTIVE" ||
      selected.status === "PENDING_ACTIVATION");
  const showUnlock =
    canLock &&
    !!selected &&
    (selected.status === "SUSPENDED" || selected.status === "DISABLED") &&
    !neverActivated;
  const showDisable = canLock && !!selected && selected.status !== "DISABLED";
  const showReinvite =
    canManageIam(user, "admins.reinvite") &&
    !!selected &&
    (selected.status === "PENDING_ACTIVATION" ||
      (selected.status !== "ACTIVE" && neverActivated));
  const allCount = STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const formatDate = (value: string | null | undefined, withTime = false) =>
    value
      ? withTime
        ? new Date(value).toLocaleString(i18n.language, {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : new Date(value).toLocaleDateString(i18n.language, {
            dateStyle: "medium",
          })
      : t("notYet");
  const checkRole = (id: string, checked: boolean) =>
    setRoleIds((previous) =>
      checked ? [...previous, id] : previous.filter((value) => value !== id),
    );
  const filtered = !!(query.search || query.roleId || query.status);

  return (
    <IamFrame
      kind="admins"
      action={
        canManageIam(user, "admins.create") && (
          <Button onClick={() => void open()} className="h-10">
            <Plus />
            {t("createAdmin")}
          </Button>
        )
      }
    >
      {delivery && !(creating || selected) && (
        <DeliveryNotice delivery={delivery} />
      )}
      {error && (
        <Notice error>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {t(error)}
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t("retry")}
            </Button>
          </div>
        </Notice>
      )}
      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4">
          <div
            role="tablist"
            aria-label={t("status")}
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5"
          >
            {[undefined, ...STATUSES].map((status) => {
              const active = (query.status || undefined) === status;
              const count = status ? counts[status] : allCount;
              return (
                <button
                  key={status ?? "all"}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() =>
                    setQuery({ ...query, status: status ?? "", page: 1 })
                  }
                  className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                >
                  {status ? t("statuses." + status) : t("statusAll")}
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    {count ?? "–"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="iam-search" className="sr-only">
                {t("search")}
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                id="iam-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={200}
                placeholder={t("search")}
                className="h-10 pl-9"
              />
            </div>
            <div className="flex gap-2">
              <label htmlFor="iam-role" className="sr-only">
                {t("role")}
              </label>
              <select
                id="iam-role"
                className={`${fieldClass} h-10 min-w-0 flex-1 sm:w-52 sm:flex-none`}
                value={query.roleId || ""}
                onChange={(e) =>
                  setQuery({ ...query, roleId: e.target.value, page: 1 })
                }
              >
                <option value="">{t("allRoles")}</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {filtered && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 shrink-0 text-slate-600"
                  onClick={() => {
                    setSearch("");
                    setQuery({ page: 1, limit: query.limit });
                  }}
                >
                  <X aria-hidden="true" />
                  <span className="hidden sm:inline">{t("clearFilters")}</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="size-10 shrink-0 px-0"
                disabled={loading}
                onClick={() => void load()}
                aria-label={t("refresh")}
                title={t("refresh")}
              >
                <RefreshCw
                  className={loading ? "motion-safe:animate-spin" : ""}
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div role="status" aria-label={t("loading")} className="divide-y divide-slate-100">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="hidden h-5 w-24 rounded-full sm:block" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <UserCog className="size-6" aria-hidden="true" />
            </span>
            <h2 className="font-semibold text-slate-900">{t("empty")}</h2>
            <p className="max-w-sm text-sm text-slate-500">{t("emptyHelp")}</p>
          </div>
        ) : (
          <div
            className={`overflow-x-auto transition-opacity ${loading ? "opacity-60" : ""}`}
            aria-busy={loading}
          >
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5">
                    {t("account")}
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    {t("role")}
                  </th>
                  <th scope="col" className="w-40 px-4 py-2.5">
                    {t("status")}
                  </th>
                  <th
                    scope="col"
                    className="hidden w-44 px-4 py-2.5 lg:table-cell"
                  >
                    {t("lastLogin")}
                  </th>
                  <th
                    scope="col"
                    className="hidden w-32 px-4 py-2.5 xl:table-cell"
                  >
                    {t("created")}
                  </th>
                  <th scope="col" className="w-14 px-4 py-2.5">
                    <span className="sr-only">{t("manage")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((admin) => {
                  const name = admin.fullName || admin.username;
                  return (
                    <tr
                      key={admin.id}
                      onClick={() => void open(admin)}
                      className="group cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <AdminAvatar name={name} src={admin.avatarUrl} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">
                              {name}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {admin.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {admin.roles.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {admin.roles.map((r) => (
                              <span
                                key={r.id}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${r.isSystem ? "bg-violet-50 text-violet-700 ring-violet-600/20" : "bg-slate-50 text-slate-700 ring-slate-500/15"}`}
                              >
                                {r.isSystem && (
                                  <LockKeyhole
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                )}
                                {r.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-400">
                            {t("noRoles")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={admin.status} />
                      </td>
                      <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">
                        {formatDate(admin.lastLoginAt, true)}
                      </td>
                      <td className="hidden px-4 py-3 text-slate-500 xl:table-cell">
                        {formatDate(admin.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-slate-400 group-hover:text-slate-900"
                          onClick={(event) => {
                            event.stopPropagation();
                            void open(admin);
                          }}
                          aria-label={`${t("details")}: ${name}`}
                          title={t("details")}
                        >
                          <ChevronRight aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <ListPagination
          disabled={loading}
          pagination={{
            page: query.page,
            pageSize: query.limit,
            totalItems: total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
            setPage: (page) => setQuery({ ...query, page }),
            setPageSize: (limit) => setQuery({ ...query, limit, page: 1 }),
          }}
        />
      </section>

      <Dialog
        open={creating || !!selected}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
          }}
        >
          <DialogHeader className="border-b border-slate-200 px-6 py-5 text-left">
            {selected ? (
              <div className="flex min-w-0 items-center gap-4 pr-6">
                <AdminAvatar
                  size="lg"
                  name={selected.fullName || selected.username}
                  src={selected.avatarUrl}
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="truncate text-lg">
                      {selected.fullName || selected.username}
                    </DialogTitle>
                    <StatusBadge status={selected.status} />
                  </div>
                  <DialogDescription className="truncate">
                    {selected.email}
                  </DialogDescription>
                </div>
              </div>
            ) : (
              <>
                <DialogTitle>{t("createAdmin")}</DialogTitle>
                <DialogDescription>{t("createHelp")}</DialogDescription>
              </>
            )}
          </DialogHeader>

          <div className="space-y-6 px-6 py-5">
            {selected && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                {[
                  [t("username"), "@" + selected.username],
                  [t("created"), formatDate(selected.createdAt)],
                  [t("activatedAt"), formatDate(selected.activatedAt)],
                  [t("lastLogin"), formatDate(selected.lastLoginAt, true)],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-0.5 truncate font-medium text-slate-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {selected?.status === "PENDING_ACTIVATION" && (
              <Notice>{t("pendingHelp")}</Notice>
            )}
            {dialogError && <Notice error>{t(dialogError)}</Notice>}
            {success && <Notice tone="success">{t(success)}</Notice>}
            {delivery && <DeliveryNotice delivery={delivery} />}

            <form
              id="iam-admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (creating)
                  void perform(async () => {
                    const result = await iamService.createAdmin({
                      email,
                      fullName,
                      roleIds,
                    });
                    setDelivery(result.activation);
                    setCreating(false);
                    setSelected(result.admin);
                  });
                else
                  setConfirm({
                    title: t("confirmProfileTitle"),
                    description: t("confirmProfileHelp"),
                    label: t("saveProfile"),
                    run: async () => {
                      const updated = await iamService.updateAdmin(
                        selected!.id,
                        { email, fullName },
                      );
                      setSelected(updated);
                    },
                  });
              }}
              className="space-y-6"
            >
              <section>
                <SectionTitle>{t("sectionProfile")}</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="admin-fullname" className={labelClass}>
                      {t("fullName")}
                    </label>
                    <Input
                      id="admin-fullname"
                      required
                      maxLength={150}
                      autoComplete="name"
                      value={fullName}
                      placeholder={t("fullNamePlaceholder")}
                      disabled={busy || !canEdit}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <div>
                    <label htmlFor="admin-email" className={labelClass}>
                      {t("email")}
                    </label>
                    <Input
                      id="admin-email"
                      type="email"
                      required
                      maxLength={254}
                      value={email}
                      placeholder="name@example.com"
                      disabled={busy || !canEdit}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10"
                      aria-describedby="admin-email-help"
                    />
                    <p
                      id="admin-email-help"
                      className="mt-1 text-xs text-slate-500"
                    >
                      {t("emailLoginHelp")}
                    </p>
                  </div>
                </div>
              </section>

              <fieldset
                aria-labelledby="admin-roles-title"
                disabled={
                  busy || (!creating && !canManageIam(user, "admins.update"))
                }
              >
                <SectionTitle
                  id="admin-roles-title"
                  action={
                    <span className="text-xs text-slate-500">
                      {t("rolesSelected", { count: roleIds.length })}
                    </span>
                  }
                >
                  {t("chooseRoles")}
                </SectionTitle>
                {roles.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                    {t("roleEmpty")}
                  </p>
                ) : (
                  <div className="grid max-h-60 gap-2 overflow-auto pr-0.5 sm:grid-cols-2">
                    {roles.map((role) => {
                      const checked = roleIds.includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring ${checked ? "border-blue-300 bg-blue-50/70" : "border-slate-200 bg-white"} ${role.isSystem ? "opacity-70" : "cursor-pointer hover:border-blue-300"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={role.isSystem}
                            onChange={(e) =>
                              checkRole(role.id, e.target.checked)
                            }
                            className="size-4 shrink-0 accent-primary"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">
                              {role.name}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-slate-500">
                              {role.code}
                            </span>
                          </span>
                          {role.isSystem && (
                            <LockKeyhole
                              className="size-3.5 shrink-0 text-slate-400"
                              aria-label={t("readOnly")}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                {!creating &&
                  selected?.roles.some((role) => role.isSystem) && (
                    <p className="mt-2 text-xs text-slate-500">
                      {t("systemHelp")}
                    </p>
                  )}
                {selected && canManageIam(user, "admins.update") && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy || !rolesChanged}
                      onClick={() =>
                        setConfirm({
                          title: t("confirmRolesTitle"),
                          description: t("confirmRolesHelp"),
                          label: t("saveRoles"),
                          run: async () => {
                            await iamService.assign(selected.id, roleIds);
                            setSelected(await iamService.admin(selected.id));
                          },
                        })
                      }
                    >
                      {t("saveRoles")}
                    </Button>
                  </div>
                )}
              </fieldset>
            </form>

            {(showLock || showUnlock || showReinvite || showDisable) && (
              <section>
                <SectionTitle>{t("sectionAccess")}</SectionTitle>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {showReinvite && (
                    <AccessAction
                      icon={MailPlus}
                      title={t("reinviteTitle")}
                      help={t(
                        neverActivated && selected!.status !== "PENDING_ACTIVATION"
                          ? "reinviteLockedHelp"
                          : "reinviteHelp",
                      )}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || cooldown > 0}
                        onClick={reinvite}
                      >
                        {cooldown > 0
                          ? t("cooldown", { seconds: cooldown })
                          : t("reinvite")}
                      </Button>
                    </AccessAction>
                  )}
                  {showLock && (
                    <AccessAction
                      icon={LockKeyhole}
                      title={t("lockTitle")}
                      help={t("lockHelp")}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          setStatus("SUSPENDED", {
                            title: t("confirmLockTitle"),
                            description: t("confirmLockHelp"),
                            label: t("lock"),
                          })
                        }
                      >
                        {t("lock")}
                      </Button>
                    </AccessAction>
                  )}
                  {showUnlock && (
                    <AccessAction
                      icon={LockOpen}
                      title={t("unlockTitle")}
                      help={t("unlockHelp")}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          setStatus("ACTIVE", {
                            title: t("confirmUnlockTitle"),
                            description: t("confirmUnlockHelp"),
                            label: t("unlock"),
                          })
                        }
                      >
                        {t("unlock")}
                      </Button>
                    </AccessAction>
                  )}
                  {showDisable && (
                    <AccessAction
                      danger
                      icon={Ban}
                      title={t("disableTitle")}
                      help={t("disableHelp")}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() =>
                          setStatus("DISABLED", {
                            title: t("confirmDisableTitle"),
                            description: t("confirmDisableHelp"),
                            label: t("disable"),
                            destructive: true,
                          })
                        }
                      >
                        {t("disable")}
                      </Button>
                    </AccessAction>
                  )}
                </div>
              </section>
            )}
          </div>

          <DialogFooter className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
            <Button variant="outline" disabled={busy} onClick={close}>
              {t("close")}
            </Button>
            {canEdit && (
              <Button type="submit" form="iam-admin-form" disabled={busy}>
                {busy
                  ? t("loading")
                  : creating
                    ? t("sendInvite")
                    : t("saveProfile")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!confirm}
        busy={busy}
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.label}
        destructive={confirm?.destructive}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void perform(confirm.run);
        }}
      />
    </IamFrame>
  );
}
