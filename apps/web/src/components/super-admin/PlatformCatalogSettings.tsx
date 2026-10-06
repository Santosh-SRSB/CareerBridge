'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CATALOG_KIND_LABELS, catalogKindFromSlug, type CatalogItem, type LocationState } from '@careerbridge/shared';
import {
  createAdminCatalogItem,
  deleteAdminCatalogItem,
  getAdminCatalog,
  getAdminNotificationTemplates,
  listPublicStates,
  resetAdminNotificationTemplate,
  updateAdminCatalogItem,
  updateAdminNotificationTemplate,
  type AdminNotificationTemplate,
} from '@/lib/api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/StateViews';
import { toast } from '@/components/ui/Toast';
import { userFacingError } from '@/lib/client-errors';

const SECTIONS = [
  { id: 'job-categories', label: 'Job Categories' },
  { id: 'locations', label: 'Locations' },
  { id: 'experience-levels', label: 'Experience Levels' },
  { id: 'languages', label: 'Languages' },
  { id: 'notification-templates', label: 'Notification Templates' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const JOB_CATEGORY_GROUPS = [
  { value: 'TECH', label: 'Tech' },
  { value: 'NON_TECH', label: 'Non-tech' },
];

const inputClass = 'min-h-12 w-full border border-[#ccc] bg-white px-3 text-sm outline-none focus:border-[#333]';
const buttonClass =
  'min-h-12 min-w-12 border border-[#999] bg-white px-3 text-xs font-bold text-[#333] hover:bg-[#f2f2f2] disabled:opacity-50';
const primaryButtonClass = 'min-h-12 bg-[#333] px-4 text-sm font-bold text-white hover:bg-[#111] disabled:opacity-50';

export function PlatformCatalogSettings() {
  const [section, setSection] = useState<SectionId>('job-categories');
  return (
    <div className="border border-[#ddd] bg-white">
      <div className="bg-[#555] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
        Reference data
      </div>
      <div role="tablist" aria-label="Settings lists" className="flex flex-wrap gap-1 border-b border-[#eee] bg-[#fafafa] p-2">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`settings-tab-${item.id}`}
            aria-selected={section === item.id}
            aria-controls={`settings-panel-${item.id}`}
            onClick={() => setSection(item.id)}
            className={`min-h-12 px-3 text-xs font-bold ${
              section === item.id ? 'bg-[#333] text-white' : 'border border-[#ccc] bg-white text-[#333]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`settings-panel-${section}`}
        aria-labelledby={`settings-tab-${section}`}
        className="p-4"
      >
        {section === 'notification-templates' ? (
          <NotificationTemplatesPanel />
        ) : (
          <CatalogPanel key={section} slug={section} />
        )}
      </div>
    </div>
  );
}

function CatalogPanel({ slug }: { slug: Exclude<SectionId, 'notification-templates'> }) {
  const kind = catalogKindFromSlug(slug)!;
  const title = CATALOG_KIND_LABELS[kind];
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [states, setStates] = useState<LocationState[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newParent, setNewParent] = useState(kind === 'JOB_CATEGORY' ? 'NON_TECH' : '');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    setLoadError('');
    setItems(null);
    getAdminCatalog(slug)
      .then(setItems)
      .catch((err) => setLoadError(userFacingError(err, `load ${title.toLowerCase()}`)));
  }, [slug, title]);

  useEffect(() => {
    load();
    if (kind === 'LOCATION_CITY') {
      listPublicStates()
        .then(setStates)
        .catch(() => setStates([]));
    }
  }, [kind, load]);

  const parentLabel = useCallback(
    (value: string | null) => {
      if (!value) return '—';
      if (kind === 'LOCATION_CITY') return states.find((s) => s.id === value)?.name ?? value;
      if (kind === 'JOB_CATEGORY') return JOB_CATEGORY_GROUPS.find((g) => g.value === value)?.label ?? value;
      return value;
    },
    [kind, states],
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!items) return [];
    return q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items;
  }, [filter, items]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const label = newLabel.trim();
    if (label.length < 2) {
      setFormError('Enter a name of at least 2 characters.');
      return;
    }
    if (kind === 'LOCATION_CITY' && !newParent) {
      setFormError('Select the state this city belongs to.');
      return;
    }
    setFormError('');
    setBusy('add');
    try {
      const created = await createAdminCatalogItem(slug, {
        label,
        ...(kind === 'LOCATION_CITY' || kind === 'JOB_CATEGORY' ? { parentValue: newParent } : {}),
      });
      setItems((prev) => [...(prev ?? []), created]);
      setNewLabel('');
      toast.success(`${created.label} added`);
    } catch (err) {
      setFormError(userFacingError(err, 'add this item'));
    } finally {
      setBusy(null);
    }
  }

  async function saveRename() {
    if (!editing) return;
    const label = editing.label.trim();
    if (label.length < 2) {
      toast.error('Enter a name of at least 2 characters.');
      return;
    }
    setBusy(editing.id);
    try {
      const updated = await updateAdminCatalogItem(slug, editing.id, { label });
      setItems((prev) => (prev ?? []).map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
      toast.success('Saved');
    } catch (err) {
      toast.error(userFacingError(err, 'rename this item'));
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(item: CatalogItem) {
    setBusy(item.id);
    try {
      const updated = await updateAdminCatalogItem(slug, item.id, { active: !item.active });
      setItems((prev) => (prev ?? []).map((row) => (row.id === updated.id ? updated : row)));
      toast.success(updated.active ? `${updated.label} activated` : `${updated.label} deactivated`);
    } catch (err) {
      toast.error(userFacingError(err, 'update this item'));
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusy(target.id);
    try {
      await deleteAdminCatalogItem(slug, target.id);
      setItems((prev) => (prev ?? []).filter((row) => row.id !== target.id));
      toast.success(`${target.label} deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(userFacingError(err, 'delete this item'));
    } finally {
      setBusy(null);
    }
  }

  const showParent = kind === 'LOCATION_CITY' || kind === 'JOB_CATEGORY';

  return (
    <section aria-label={title} className="space-y-4">
      <form onSubmit={onAdd} noValidate className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="block text-xs font-bold text-[#444]">
          {kind === 'LOCATION_CITY' ? 'New city' : `New ${title.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '')}`}
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            maxLength={80}
            className={`${inputClass} mt-1`}
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? `${slug}-form-error` : undefined}
          />
        </label>
        {showParent ? (
          <label className="block text-xs font-bold text-[#444]">
            {kind === 'LOCATION_CITY' ? 'State' : 'Group'}
            <select value={newParent} onChange={(e) => setNewParent(e.target.value)} className={`${inputClass} mt-1`}>
              {kind === 'LOCATION_CITY' ? <option value="">Select state</option> : null}
              {(kind === 'LOCATION_CITY'
                ? states.map((s) => ({ value: s.id, label: s.name }))
                : JOB_CATEGORY_GROUPS
              ).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit" disabled={busy === 'add'} className={primaryButtonClass}>
          {busy === 'add' ? 'Adding…' : 'Add'}
        </button>
        {formError ? (
          <p id={`${slug}-form-error`} role="alert" className="text-xs font-semibold text-red-700 md:col-span-3">
            {formError}
          </p>
        ) : null}
      </form>

      <label className="block text-xs font-bold text-[#444]">
        Filter
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${inputClass} mt-1 md:max-w-xs`}
        />
      </label>

      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : items === null ? (
        <SkeletonList rows={4} label={`Loading ${title.toLowerCase()}…`} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={items.length ? 'No matches' : `No ${title.toLowerCase()} yet`}
          message={items.length ? 'Try a different filter.' : 'Add the first one above.'}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-[#ddd] text-left text-xs uppercase text-[#555]">
                <th scope="col" className="py-2 pr-2">Name</th>
                {showParent ? <th scope="col" className="py-2 pr-2">{kind === 'LOCATION_CITY' ? 'State' : 'Group'}</th> : null}
                <th scope="col" className="py-2 pr-2">Status</th>
                <th scope="col" className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.id} className="border-b border-[#eee]" data-testid="catalog-row">
                  <td className="py-2 pr-2">
                    {editing?.id === item.id ? (
                      <input
                        value={editing.label}
                        onChange={(e) => setEditing({ id: item.id, label: e.target.value })}
                        aria-label={`Rename ${item.label}`}
                        maxLength={80}
                        className={inputClass}
                        autoFocus
                      />
                    ) : (
                      item.label
                    )}
                  </td>
                  {showParent ? <td className="py-2 pr-2">{parentLabel(item.parentValue)}</td> : null}
                  <td className="py-2 pr-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-bold ${
                        item.active ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {editing?.id === item.id ? (
                        <>
                          <button type="button" onClick={() => void saveRename()} disabled={busy === item.id} className={buttonClass}>
                            Save
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className={buttonClass}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditing({ id: item.id, label: item.label })}
                          aria-label={`Edit ${item.label}`}
                          className={buttonClass}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void toggleActive(item)}
                        disabled={busy === item.id}
                        aria-label={`${item.active ? 'Deactivate' : 'Activate'} ${item.label}`}
                        className={buttonClass}
                      >
                        {item.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        disabled={busy === item.id}
                        aria-label={`Delete ${item.label}`}
                        className={`${buttonClass} text-red-800`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.label ?? ''}?`}
        message="It will no longer be offered to candidates or employers. Existing profiles and jobs keep their saved value. Deactivate instead if you may need it again."
        confirmLabel="Delete"
        destructive
        busy={Boolean(deleteTarget && busy === deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

function NotificationTemplatesPanel() {
  const [templates, setTemplates] = useState<AdminNotificationTemplate[] | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoadError('');
    setTemplates(null);
    getAdminNotificationTemplates()
      .then(setTemplates)
      .catch((err) => setLoadError(userFacingError(err, 'load notification templates')));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (templates === null) return <SkeletonList rows={4} label="Loading notification templates…" />;

  return (
    <section aria-label="Notification templates" className="space-y-4">
      <p className="text-xs text-[#666]">
        Edit the in-app notification text. Use placeholders such as {'{{jobTitle}}'}; each template lists the ones it
        supports. Changes apply to new notifications immediately.
      </p>
      {templates.map((template) => (
        <TemplateEditor
          key={template.key}
          template={template}
          onSaved={(next) => setTemplates((prev) => (prev ?? []).map((t) => (t.key === next.key ? next : t)))}
        />
      ))}
    </section>
  );
}

function TemplateEditor({
  template,
  onSaved,
}: {
  template: AdminNotificationTemplate;
  onSaved: (next: AdminNotificationTemplate) => void;
}) {
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);
  const [active, setActive] = useState(template.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = title !== template.title || body !== template.body || active !== template.active;
  const idBase = `tpl-${template.key}`;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const next = await updateAdminNotificationTemplate(template.key, { title, body, active });
      onSaved(next);
      toast.success('Template saved');
    } catch (err) {
      setError(userFacingError(err, 'save this template'));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError('');
    try {
      const next = await resetAdminNotificationTemplate(template.key);
      setTitle(next.title);
      setBody(next.body);
      setActive(next.active);
      onSaved(next);
      toast.success('Template reset to default');
    } catch (err) {
      setError(userFacingError(err, 'reset this template'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="border border-[#e5e5e5] bg-[#fafafa] p-3" data-testid="notification-template">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-[#222]">{template.label}</h3>
        <span className="bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-800">
          To {template.audience === 'CANDIDATE' ? 'candidate' : 'employer'}
        </span>
        {template.customized ? (
          <span className="bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">Customised</span>
        ) : null}
      </div>
      <p className="mb-2 text-[11px] text-[#555]">
        Placeholders: {template.variables.map((v) => `{{${v}}}`).join(', ')}
      </p>
      <label htmlFor={`${idBase}-title`} className="block text-xs font-bold text-[#444]">
        Title
      </label>
      <input
        id={`${idBase}-title`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        className={`${inputClass} mb-2 mt-1`}
      />
      <label htmlFor={`${idBase}-body`} className="block text-xs font-bold text-[#444]">
        Message
      </label>
      <textarea
        id={`${idBase}-body`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
        rows={3}
        className="mt-1 w-full border border-[#ccc] bg-white px-3 py-2 text-sm outline-none focus:border-[#333]"
      />
      <label className="mt-2 flex min-h-12 items-center gap-2 text-xs font-bold text-[#444]">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5" />
        Use this text (when off, the built-in default is sent)
      </label>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !dirty} className={primaryButtonClass}>
          {busy ? 'Saving…' : 'Save template'}
        </button>
        <button type="button" disabled={busy || !template.customized} onClick={() => void reset()} className={buttonClass}>
          Reset to default
        </button>
      </div>
    </form>
  );
}
