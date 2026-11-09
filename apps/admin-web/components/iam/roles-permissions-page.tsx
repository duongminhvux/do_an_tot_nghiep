"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LockKeyhole,
  Plus,
  Save,
  Pencil,
  Check,
  KeyRound,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppSelector } from "@/redux/hooks";
import { canManageIam } from "@/lib/admin-permissions";
import {
  iamService,
  iamErrorCode,
  type IamRole,
  type IamPermission,
  type PermissionMatrix,
} from "@/services/iam.service";
import {
  ConfirmDialog,
  IamFrame,
  Loading,
  Notice,
  fieldClass,
  panelClass,
} from "./iam-shared";

export default function RolesPermissionsPage() {
  const { t } = useTranslation("iam"),
    user = useAppSelector((state) => state.auth.user);
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null),
    [catalogue, setCatalogue] = useState<IamPermission[]>([]),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const [roleDialog, setRoleDialog] = useState<"create" | "edit" | null>(null),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [description, setDescription] = useState(""),
    [dialogError, setDialogError] = useState(""),
    [switchTo, setSwitchTo] = useState<string | null>(null),
    [confirmSave, setConfirmSave] = useState(false);
  const current = matrix?.roles.find((role) => role.id === selected);
  const baseline = useMemo(
    () =>
      matrix?.grants
        .filter((g) => g.roleId === selected)
        .map((g) => g.permission) || [],
    [matrix, selected],
  );
  const dirty = [...new Set([...baseline, ...draft])].filter(
    (code) => baseline.includes(code) !== draft.includes(code),
  ).length;
  const readOnly = !!current?.isSystem || !canManageIam(user, "roles.manage");
  const load = useCallback(async (preferred?: string) => {
    setLoading(true);
    setError("");
    try {
      const [roles, data, permissions] = await Promise.all([
        iamService.roles(),
        iamService.matrix(),
        iamService.permissions(),
      ]);
      const id =
        preferred ||
        roles.find((role) => !role.isSystem)?.id ||
        roles[0]?.id ||
        "";
      setMatrix({ ...data, roles });
      setCatalogue(permissions);
      setSelected(id);
      setDraft(
        data.grants.filter((g) => g.roleId === id).map((g) => g.permission),
      );
    } catch (e) {
      setError(iamErrorCode(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const choose = (id: string) => {
    setSelected(id);
    setDraft(
      matrix?.grants.filter((g) => g.roleId === id).map((g) => g.permission) ||
        [],
    );
    setSuccess(false);
    setSearch("");
  };
  const groups = useMemo(() => {
    const result: Record<string, IamPermission[]> = {};
    for (const permission of catalogue) {
      const module = permission.code.split(".")[0]!;
      if (
        !search ||
        `${permission.code} ${t("modules." + module)} ${t("actions." + permission.action)}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())
      )
        (result[module] ??= []).push(permission);
    }
    return result;
  }, [catalogue, search, t]);
  const toggle = (codes: string[], checked: boolean) =>
    setDraft((previous) =>
      checked
        ? [...new Set([...previous, ...codes])]
        : previous.filter((code) => !codes.includes(code)),
    );
  const opener = useRef<HTMLElement | null>(null);
  const openRole = (editing: boolean) => {
    opener.current = document.activeElement as HTMLElement;
    setRoleDialog(editing ? "edit" : "create");
    setName(editing ? current?.name || "" : "");
    setCode(editing ? current?.code || "" : "");
    setDescription(editing ? current?.description || "" : "");
    setDialogError("");
  };
  const saveRole = async () => {
    setBusy(true);
    setDialogError("");
    try {
      const role: IamRole =
        roleDialog === "create"
          ? await iamService.createRole({
              code,
              name,
              description: description || null,
            })
          : await iamService.updateRole(selected, {
              name,
              description: description || null,
            });
      setRoleDialog(null);
      await load(role.id);
      setSuccess(true);
      window.dispatchEvent(new Event("admin-permissions-refresh"));
    } catch (e) {
      setDialogError(iamErrorCode(e));
    } finally {
      setBusy(false);
    }
  };
  const savePermissions = async () => {
    setBusy(true);
    setError("");
    try {
      await iamService.savePermissions(selected, draft);
      await load(selected);
      setSuccess(true);
      window.dispatchEvent(new Event("admin-permissions-refresh"));
    } catch (e) {
      setError(iamErrorCode(e));
    } finally {
      setBusy(false);
      setConfirmSave(false);
    }
  };
  return (
    <IamFrame
      kind="roles"
      action={
        canManageIam(user, "roles.manage") && (
          <Button
            className="h-11"
            disabled={busy || dirty > 0}
            onClick={() => openRole(false)}
          >
            <Plus />
            {t("createRole")}
          </Button>
        )
      }
    >
      {error && (
        <Notice error>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {t(error)}
            <Button variant="outline" onClick={() => void load(selected)}>
              {t("retry")}
            </Button>
          </div>
        </Notice>
      )}
      {success && <Notice>{t("saved")}</Notice>}
      {loading ? (
        <Loading />
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside
            className={`${panelClass} h-fit overflow-hidden lg:sticky lg:top-20`}
          >
            <h2 className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("role")}
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {matrix?.roles.length || 0}
              </span>
            </h2>
            <div className="max-h-[calc(100dvh-14rem)] space-y-1 overflow-y-auto p-2">
              {matrix?.roles.map((role) => {
                const isActive = role.id === selected;
                return (
                  <button
                    type="button"
                    key={role.id}
                    onClick={() => {
                      if (role.id !== selected) {
                        if (dirty) setSwitchTo(role.id);
                        else choose(role.id);
                      }
                    }}
                    disabled={busy}
                    aria-pressed={isActive}
                    className={`flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "border-blue-600 bg-blue-50" : "border-transparent hover:bg-slate-50"}`}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${role.isSystem ? "bg-violet-50 text-violet-600" : isActive ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}
                    >
                      {role.isSystem ? (
                        <LockKeyhole className="size-4" aria-hidden="true" />
                      ) : (
                        <KeyRound className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate font-medium ${isActive ? "text-blue-700" : "text-slate-900"}`}
                      >
                        {role.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {role.code}
                      </span>
                    </span>
                    <span
                      className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600"
                      title={t("permissionCount", {
                        count: matrix.grants.filter((g) => g.roleId === role.id)
                          .length,
                      })}
                    >
                      {matrix.grants.filter((g) => g.roleId === role.id).length}
                    </span>
                  </button>
                );
              })}
            </div>
            {!matrix?.roles.length && (
              <p className="p-4 text-sm text-slate-500">{t("roleEmpty")}</p>
            )}
          </aside>
          <section className="min-w-0 space-y-4">
            {current ? (
              <>
                <header
                  className={`${panelClass} flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between`}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {current.name}
                      </h2>
                      <code className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {current.code}
                      </code>
                      {current.isSystem && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                          <LockKeyhole className="size-3" aria-hidden="true" />
                          {t("readOnly")}
                        </span>
                      )}
                    </div>
                    {current.description && (
                      <p className="max-w-3xl break-words text-sm text-slate-500">
                        {current.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1 text-xs font-medium">
                      <span className="rounded-md bg-blue-50 px-2 py-1 text-blue-700">
                        {t("permissionCount", { count: draft.length })}
                      </span>
                      <span
                        className={`rounded-md px-2 py-1 ${dirty ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
                      >
                        {dirty
                          ? t("unsaved", { count: dirty })
                          : t("noChanges")}
                      </span>
                    </div>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="outline"
                      className="shrink-0"
                      disabled={busy || dirty > 0}
                      onClick={() => openRole(true)}
                    >
                      <Pencil />
                      {t("editRole")}
                    </Button>
                  )}
                </header>
                {current.isSystem && (
                  <Notice>
                    <div className="flex gap-3">
                      <LockKeyhole
                        className="size-5 shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium">{t("systemRole")}</p>
                        <p className="mt-1 text-muted-foreground">
                          {t("systemHelp")}
                        </p>
                      </div>
                    </div>
                  </Notice>
                )}
                <div className="relative">
                  <label htmlFor="permission-search" className="sr-only">
                    {t("searchPermissions")}
                  </label>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <Input
                    id="permission-search"
                    value={search}
                    placeholder={t("searchPermissions")}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-11 bg-white pl-9"
                  />
                </div>
                <div className="grid min-w-0 items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {Object.entries(groups).map(([module, permissions]) => {
                    const reserved = ["admins", "roles"].includes(module),
                      editable = permissions
                        .filter(() => !reserved)
                        .map((p) => p.code);
                    return (
                      <section
                        key={module}
                        className={`${panelClass} overflow-hidden`}
                      >
                        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {t("modules." + module)}
                          </h3>
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600 ring-1 ring-slate-200">
                            {
                              permissions.filter((p) => draft.includes(p.code))
                                .length
                            }
                            /{permissions.length}
                          </span>
                        </header>
                        <div className="p-2">
                          {!readOnly && !reserved && (
                            <label className="mb-1 flex min-h-10 cursor-pointer items-center gap-3 rounded-md border-b border-dashed border-slate-200 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50/60">
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={
                                  editable.length > 0 &&
                                  editable.every((code) => draft.includes(code))
                                }
                                onChange={(e) =>
                                  toggle(editable, e.target.checked)
                                }
                                disabled={busy}
                              />
                              {t("selectAll", {
                                module: t("modules." + module),
                              })}
                            </label>
                          )}
                          {permissions.map((permission) => (
                            <label
                              key={permission.code}
                              className={`flex min-h-12 items-center gap-3 rounded-md px-2 py-2 ${readOnly || reserved ? "" : "cursor-pointer hover:bg-slate-50"}`}
                            >
                              <input
                                type="checkbox"
                                checked={draft.includes(permission.code)}
                                disabled={readOnly || reserved || busy}
                                onChange={(e) =>
                                  toggle([permission.code], e.target.checked)
                                }
                                className="size-4 shrink-0 accent-primary"
                              />
                              <span className="min-w-0">
                                <span className="text-sm text-slate-900">
                                  {t("actions." + permission.action)}
                                  {permission.resource
                                    .split(".")
                                    .slice(1)
                                    .map(
                                      (resource) =>
                                        ` · ${t("resources." + resource)}`,
                                    )
                                    .join("")}
                                </span>
                                <code className="mt-0.5 block break-all text-[11px] text-slate-400">
                                  {permission.code}
                                </code>
                              </span>
                            </label>
                          ))}
                        </div>
                        {reserved && (
                          <p className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
                            {t("reserved")}
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
                {Object.keys(groups).length === 0 && (
                  <Notice>{t("permissionEmpty")}</Notice>
                )}
                <footer className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                  <p
                    className={`text-sm font-medium ${dirty ? "text-amber-700" : "text-slate-500"}`}
                    role="status"
                  >
                    {dirty ? t("unsaved", { count: dirty }) : t("noChanges")}
                  </p>
                  {!readOnly && (
                    <Button
                      disabled={busy || dirty === 0}
                      onClick={() => setConfirmSave(true)}
                    >
                      <Save />
                      {t("save")}
                    </Button>
                  )}
                  {readOnly && (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="size-4" />
                      {t("readOnly")}
                    </span>
                  )}
                </footer>
              </>
            ) : (
              <Notice>{t("matrixEmpty")}</Notice>
            )}
          </section>
        </div>
      )}
      <Dialog
        open={!!roleDialog}
        onOpenChange={(open) => {
          if (!open && !busy) setRoleDialog(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(roleDialog === "create" ? "createRole" : "editRole")}
            </DialogTitle>
            <DialogDescription>{t("codeHelp")}</DialogDescription>
          </DialogHeader>
          {dialogError && <Notice error>{t(dialogError)}</Notice>}
          <form
            id="iam-role-form"
            onSubmit={(e) => {
              e.preventDefault();
              void saveRole();
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="role-code"
                className="mb-2 block text-sm font-medium"
              >
                {t("code")}
              </label>
              <Input
                id="role-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                pattern="[A-Z][A-Z0-9_]*"
                maxLength={100}
                required
                disabled={busy || roleDialog === "edit"}
                className="h-11"
              />
            </div>
            <div>
              <label
                htmlFor="role-name"
                className="mb-2 block text-sm font-medium"
              >
                {t("name")}
              </label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
                disabled={busy}
                className="h-11"
              />
            </div>
            <div>
              <label
                htmlFor="role-description"
                className="mb-2 block text-sm font-medium"
              >
                {t("description")}
              </label>
              <textarea
                id="role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                disabled={busy}
                className={`${fieldClass} min-h-24 py-3`}
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setRoleDialog(null)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" form="iam-role-form" disabled={busy}>
              {busy ? t("loading") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!switchTo}
        busy={busy}
        title={t("discardTitle")}
        description={t("discardHelp")}
        onClose={() => setSwitchTo(null)}
        onConfirm={() => {
          choose(switchTo!);
          setSwitchTo(null);
        }}
      />
      <ConfirmDialog
        open={confirmSave}
        busy={busy}
        onClose={() => setConfirmSave(false)}
        onConfirm={() => void savePermissions()}
      />
    </IamFrame>
  );
}
