"use client";

import { useMemo, useState, useTransition } from "react";

import {
  deleteDocumentTemplateAction,
  upsertDocumentTemplateAction,
} from "@/lib/actions/fi-document-template-actions";
import {
  DOCUMENT_TEMPLATE_CATEGORIES,
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  type DocumentTemplateCategory,
} from "@/src/lib/documentTemplates/documentTemplateConstants";
import type { FiDocumentTemplateRow } from "@/src/lib/documentTemplates/documentTemplateTypes";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

const sectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function DocumentTemplatesSection(props: {
  tenantId: string;
  initialTemplates: FiDocumentTemplateRow[];
}) {
  const { tenantId } = props;
  const [templates, setTemplates] = useState(props.initialTemplates);
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<DocumentTemplateCategory | "all">("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<DocumentTemplateCategory>("sales_terms");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const sorted = useMemo(() => {
    const list =
      filter === "all" ? templates : templates.filter((t) => t.category === filter);
    return [...list].sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });
  }, [templates, filter]);

  function resetForm() {
    setEditingId(null);
    setCategory("sales_terms");
    setName("");
    setSlug("");
    setBody("");
    setIsActive(true);
    setIsDefault(false);
    setMsg(null);
  }

  function startEdit(row: FiDocumentTemplateRow) {
    setEditingId(row.id);
    setCategory(row.category);
    setName(row.name);
    setSlug(row.slug);
    setBody(row.body);
    setIsActive(row.is_active);
    setIsDefault(row.is_default);
    setMsg(null);
  }

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h2 className="mb-2 text-base font-semibold text-[#F8FAFC]">
          Sales documents &amp; policies
        </h2>
        <p className="text-xs leading-relaxed text-[#94A3B8]">
          Long-form copy for sales terms &amp; conditions, invoice payment terms, invoice footers,
          booking and payment policies, and consent summaries. Attach or paste into quotes,
          invoices, and patient packs as your workflows grow.
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className="mb-3 text-base font-semibold text-[#F8FAFC]">
          {editingId ? "Edit document" : "New document"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[#94A3B8]">
            Category
            <select
              className={`${inputClass} mt-1`}
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentTemplateCategory)}
            >
              {DOCUMENT_TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {DOCUMENT_TEMPLATE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[#94A3B8]">
            Name
            <input
              className={`${inputClass} mt-1`}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editingId) setSlug(slugify(e.target.value));
              }}
            />
          </label>
          <label className="block text-xs text-[#94A3B8] sm:col-span-2">
            Slug (stable id)
            <input
              className={`${inputClass} mt-1 font-mono text-xs`}
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              disabled={Boolean(editingId)}
            />
          </label>
          <label className="block text-xs text-[#94A3B8] sm:col-span-2">
            Body
            <textarea
              className={`${inputClass} mt-1 font-mono text-xs`}
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Default for category
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !name.trim() || !body.trim() || !slug.trim()}
            className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md disabled:opacity-50"
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await upsertDocumentTemplateAction({
                  tenantId,
                  id: editingId,
                  category,
                  slug,
                  name: name.trim(),
                  body: body.trim(),
                  is_active: isActive,
                  is_default: isDefault,
                });
                if (!r.ok) {
                  setMsg(r.error);
                  return;
                }
                setTemplates((prev) => {
                  const without = prev.filter((t) => t.id !== r.template.id);
                  return [...without, r.template];
                });
                resetForm();
                setMsg(editingId ? "Document saved." : "Document created.");
              });
            }}
          >
            {editingId ? "Save document" : "Create document"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
              onClick={() => resetForm()}
            >
              Cancel
            </button>
          ) : null}
        </div>
        {msg ? <p className="mt-2 text-xs text-[#94A3B8]">{msg}</p> : null}
      </div>

      <div className={sectionClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[#F8FAFC]">Documents</h2>
          <select
            className={`${inputClass} w-auto min-w-[12rem]`}
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as DocumentTemplateCategory | "all")
            }
          >
            <option value="all">All categories</option>
            {DOCUMENT_TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_TEMPLATE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No documents yet.</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-white/[0.06] bg-[#081020]/50 px-3 py-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[#F8FAFC]">{row.name}</p>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">
                      {DOCUMENT_TEMPLATE_CATEGORY_LABELS[row.category]} ·{" "}
                      <span className="font-mono">{row.slug}</span> · v{row.version}
                      {row.is_default ? " · default" : ""}
                      {!row.is_active ? " · inactive" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      className="text-[#22C1FF] hover:underline"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-rose-300 hover:underline"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm("Delete this document template?")) return;
                        startTransition(async () => {
                          const r = await deleteDocumentTemplateAction({
                            tenantId,
                            templateId: row.id,
                          });
                          if (!r.ok) {
                            setMsg(r.error);
                            return;
                          }
                          setTemplates((prev) => prev.filter((t) => t.id !== row.id));
                          if (editingId === row.id) resetForm();
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
