"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  RefreshCw,
  ChevronRight,
  LockKeyhole,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ConfirmDialog,
  DeliveryNotice,
  IamFrame,
  Loading,
  Notice,
  StatusBadge,
  fieldClass,
  labelClass,
  panelClass,
} from "./iam-shared";

export default function AdminAccountsPage() {
  const { t, i18n } = useTranslation("iam"),
    user = useAppSelector((state) => state.auth.user);
  const [query, setQuery] = useState<AdminQuery>({ page: 1, limit: 10 }),
    [search, setSearch] = useState("");
  const [items, setItems] = useState<IamAdmin[]>([]),
    [total, setTotal] = useState(0),
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
    [confirm, setConfirm] = useState<null | (() => Promise<unknown>)>(null);
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
        const [list, available] = await Promise.all([
          iamService.admins(query, signal),
          iamService.roles(signal),
        ]);
        if (id === sequence.current) {
          setItems(list.items);
          setTotal(list.total);
          setRoles(available);
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
  const setStatus = (status: Exclude<AdminStatus, "PENDING_ACTIVATION">) =>
    setConfirm(() => async () => {
      await iamService.status(selected!.id, status);
      setSelected({ ...selected!, status });
    });
  const cooldown = selected
    ? Math.max(0, Math.ceil(((cooldowns[selected.id] || 0) - now) / 1000))
    : 0;
  const checkRole = (id: string, checked: boolean) =>
    setRoleIds((previous) =>
      checked ? [...previous, id] : previous.filter((value) => value !== id),
    );
  return (
    <IamFrame
      kind="admins"
      action={
        canManageIam(user, "admins.create") && (
          <Button onClick={() => void open()} className="h-11">
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
            <Button variant="outline" onClick={() => void load()}>
              {t("retry")}
            </Button>
          </div>
        </Notice>
      )}
      <section className={`${panelClass} overflow-hidden`}>
        <form
          className="grid grid-cols-2 items-end gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_200px_200px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery({ ...query, search, page: 1 });
          }}
        >
          <div className="col-span-2 min-w-0 lg:col-span-1">
            <label htmlFor="iam-search" className={labelClass}>
              {t("search")}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                id="iam-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={200}
                className="h-11 pl-9"
              />
            </div>
          </div>
          <div>
            <label htmlFor="iam-status" className={labelClass}>
              {t("status")}
            </label>
            <select
              id="iam-status"
              className={fieldClass}
              value={query.status || ""}
              onChange={(e) =>
                setQuery({ ...query, status: e.target.value, page: 1 })
              }
            >
              <option value="">{t("allStatuses")}</option>
              {(
                [
                  "PENDING_ACTIVATION",
                  "ACTIVE",
                  "SUSPENDED",
                  "DISABLED",
                ] as const
              ).map((status) => (
                <option key={status} value={status}>
                  {t("statuses." + status)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="iam-role" className={labelClass}>
              {t("role")}
            </label>
            <select
              id="iam-role"
              className={fieldClass}
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
          </div>
          <div className="col-span-2 flex gap-2 lg:col-span-1">
            <Button type="submit" className="h-11 flex-1 lg:flex-none">
              <Search />
              {t("searchAction")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-11 px-0"
              onClick={() => void load()}
              aria-label={t("refresh")}
              title={t("refresh")}
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          </div>
        </form>
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <UserCog className="size-6" aria-hidden="true" />
            </span>
            <h2 className="font-semibold text-slate-900">{t("empty")}</h2>
            <p className="text-sm text-slate-500">{t("emptyHelp")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    {t("account")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("role")}
                  </th>
                  <th scope="col" className="w-40 px-4 py-3">
                    {t("status")}
                  </th>
                  <th scope="col" className="hidden w-36 px-4 py-3 lg:table-cell">
                    {t("created")}
                  </th>
                  <th scope="col" className="w-28 px-4 py-3 text-right">
                    {t("manage")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((admin) => (
                  <tr
                    key={admin.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold uppercase text-blue-600"
                        >
                          {(admin.fullName || admin.username).slice(0, 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {admin.fullName || admin.username}
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
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${r.isSystem ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-700"}`}
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
                        <span className="text-xs text-slate-400">
                          {t("noRoles")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={admin.status} />
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">
                      {new Date(admin.createdAt).toLocaleDateString(
                        i18n.language,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void open(admin)}
                        aria-label={`${t("details")}: ${admin.fullName || admin.email}`}
                      >
                        {t("details")}
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3">
          <p className="text-xs text-slate-500">
            {t("page", { page: query.page, total })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={loading || query.page <= 1}
              onClick={() => setQuery({ ...query, page: query.page - 1 })}
            >
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              disabled={loading || query.page * query.limit >= total}
              onClick={() => setQuery({ ...query, page: query.page + 1 })}
            >
              {t("next")}
            </Button>
          </div>
        </footer>
      </section>
      <Dialog
        open={creating || !!selected}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {creating
                ? t("createAdmin")
                : selected?.fullName || selected?.username}
            </DialogTitle>
            <DialogDescription>
              {creating ? t("createHelp") : t("pendingHelp")}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">{t("status")}</dt>
                <dd className="mt-1">
                  <StatusBadge status={selected.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("lastLogin")}</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {selected.lastLoginAt
                    ? new Date(selected.lastLoginAt).toLocaleString(
                        i18n.language,
                      )
                    : t("notYet")}
                </dd>
              </div>
            </dl>
          )}
          {dialogError && <Notice error>{t(dialogError)}</Notice>}
          {success && <Notice>{t(success)}</Notice>}
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
                setConfirm(() => async () => {
                  const updated = await iamService.updateAdmin(selected!.id, {
                    email,
                    fullName,
                  });
                  setSelected(updated);
                });
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
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
                  disabled={
                    busy || (!creating && !canManageIam(user, "admins.update"))
                  }
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  aria-describedby="admin-email-help"
                />
                <p id="admin-email-help" className="mt-1 text-xs text-slate-500">
                  {t("emailLoginHelp")}
                </p>
              </div>
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
                  disabled={
                    busy || (!creating && !canManageIam(user, "admins.update"))
                  }
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
            <fieldset
              disabled={
                busy || (!creating && !canManageIam(user, "admins.update"))
              }
            >
              <legend className={labelClass}>{t("chooseRoles")}</legend>
              <div className="grid max-h-56 gap-2 overflow-auto sm:grid-cols-2">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${roleIds.includes(role.id) ? "border-blue-200 bg-blue-50/60" : "border-slate-200"} ${role.isSystem ? "opacity-70" : "cursor-pointer hover:border-blue-200"}`}
                  >
                    <input
                      type="checkbox"
                      checked={roleIds.includes(role.id)}
                      disabled={role.isSystem}
                      onChange={(e) => checkRole(role.id, e.target.checked)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {role.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
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
                ))}
              </div>
            </fieldset>
            {!creating && selected?.roles.some((role) => role.isSystem) && (
              <p className="text-xs text-muted-foreground">{t("systemHelp")}</p>
            )}
          </form>
          {selected && (
            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              {canManageIam(user, "admins.update") && (
                <Button
                  variant="outline"
                  disabled={
                    busy ||
                    JSON.stringify([...roleIds].sort()) ===
                      JSON.stringify(selected.roles.map((r) => r.id).sort())
                  }
                  onClick={() =>
                    setConfirm(() => async () => {
                      await iamService.assign(selected.id, roleIds);
                      const updated = await iamService.admin(selected.id);
                      setSelected(updated);
                    })
                  }
                >
                  {t("saveRoles")}
                </Button>
              )}
              {canManageIam(user, "admins.lock") &&
                selected.status !== "PENDING_ACTIVATION" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      setStatus(
                        selected.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                      )
                    }
                  >
                    {t(selected.status === "ACTIVE" ? "lock" : "unlock")}
                  </Button>
                )}
              {canManageIam(user, "admins.lock") &&
                selected.status !== "DISABLED" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setStatus("DISABLED")}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 sm:ml-auto"
                  >
                    {t("disable")}
                  </Button>
                )}
              {canManageIam(user, "admins.reinvite") &&
                selected.status === "PENDING_ACTIVATION" && (
                  <Button
                    variant="outline"
                    disabled={busy || cooldown > 0}
                    onClick={() =>
                      setConfirm(() => async () => {
                        try {
                          const result = await iamService.reinvite(selected.id);
                          setDelivery(result);
                          setCooldowns((values) => ({
                            ...values,
                            [selected.id]: Date.now() + 60000,
                          }));
                        } catch (e) {
                          if (iamErrorCode(e) === "cooldownError")
                            setCooldowns((values) => ({
                              ...values,
                              [selected.id]: Date.now() + 60000,
                            }));
                          throw e;
                        }
                      })
                    }
                  >
                    {cooldown > 0
                      ? t("cooldown", { seconds: cooldown })
                      : t("reinvite")}
                  </Button>
                )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={close}>
              {t("close")}
            </Button>
            {(creating
              ? canManageIam(user, "admins.create")
              : canManageIam(user, "admins.update")) && (
              <Button type="submit" form="iam-admin-form" disabled={busy}>
                {busy
                  ? t("loading")
                  : t(creating ? "createAdmin" : "saveProfile")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!confirm}
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void perform(confirm);
        }}
      />
    </IamFrame>
  );
}
