"use client";

import { useMemo, useState } from "react";
import { goiAiDienNhap, luuLuotThu } from "@/client/api";
import { DynamicField } from "@/client/chung/DynamicField";
import { MicButton } from "@/client/chung/MicButton";
import { FormPanel } from "@/client/workspace/FormPanel";
import { matchCatalog } from "@/shared/match";
import type { InputMode, SessionInput } from "@/shared/metrics";
import type { AppConfig, CaseData, CatalogItem, FieldDef, FormConfig, Values } from "@/shared/types";
import { computeTotal, computeWarnings } from "@/shared/validate";
import {
  blankRow,
  countFields,
  initialRows,
  rowFromValues,
  rowValues,
  toText,
  type Row,
  type RowsState,
} from "@/client/workspace/trang-thai";

interface CatalogStats {
  total: number;
  matched: number;
}

const NO_CATALOG_STATS: CatalogStats = { total: 0, matched: 0 };

const nowMs = () => Date.now();

function blankHanhChinh(form: FormConfig): Record<string, string> {
  return Object.fromEntries(form.fields.map((field) => [field.id, ""]));
}

export function Workspace({ config }: { config: AppConfig }) {
  const { forms, hanhChinh: hanhChinhForm, catalogs, vietTat, rules, cases } = config;

  const [activeForm, setActiveForm] = useState(forms[0].id);
  const [hanhChinh, setHanhChinh] = useState(() => blankHanhChinh(hanhChinhForm));
  const [rows, setRows] = useState<RowsState>(() => initialRows(forms));
  const [input, setInput] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("go");
  const [drafted, setDrafted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCases, setShowCases] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [provider, setProvider] = useState(config.provider);
  const [catalogStats, setCatalogStats] = useState(NO_CATALOG_STATS);
  const [removedAiFields, setRemovedAiFields] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState<SessionInput | null>(null);

  const warnings = useMemo(() => {
    const rowsByForm = Object.fromEntries(
      forms.map((form) => [form.id, (rows[form.id] ?? []).map(rowValues)]),
    );
    const reasons = Object.fromEntries(
      forms.map((form) => [form.id, (rows[form.id] ?? []).map((row) => row.matchReason)]),
    );
    return computeWarnings(forms, rowsByForm, hanhChinh, rules, reasons);
  }, [forms, rows, hanhChinh, rules]);

  function warningCount(formId: string): number {
    return Object.values(warnings.fields[formId] ?? {}).reduce(
      (sum, row) => sum + Object.values(row).reduce((s, list) => s + list.length, 0),
      0,
    );
  }

  function resetForms() {
    setRows(initialRows(forms));
    setDrafted(false);
    setError(null);
    setCatalogStats(NO_CATALOG_STATS);
    setRemovedAiFields(0);
    setConfirmed(null);
  }

  function markStarted() {
    setStartedAt((current) => current ?? Date.now());
  }

  function startNewSession() {
    resetForms();
    setHanhChinh(blankHanhChinh(hanhChinhForm));
    setInput("");
    setInputMode("go");
    setStartedAt(null);
    setCaseId(null);
    setActiveForm(forms[0].id);
  }

  function loadCase(item: CaseData, mode: InputMode) {
    resetForms();
    setHanhChinh(
      Object.fromEntries(hanhChinhForm.fields.map((field) => [field.id, toText(item.hanh_chinh[field.id])])),
    );
    setInput(mode === "noi" ? item.input_noi : item.input_go_tat);
    setInputMode(mode);
    setShowCases(false);
    setCaseId(item.id);
    setStartedAt(nowMs());
  }

  async function runDraft() {
    setLoading(true);
    setError(null);
    try {
      const result = await goiAiDienNhap(input);
      const next: RowsState = {};
      for (const form of forms) {
        const value = result.draft[form.id];
        next[form.id] =
          form.mode === "single"
            ? [rowFromValues(form, value as Values)]
            : (value as Values[]).map((row, i) => rowFromValues(form, row, result.matches[form.id]?.[i]));
      }
      setRows(next);
      setDrafted(true);
      setProvider(result.provider);
      setRemovedAiFields(0);
      const catalogRows = forms.flatMap((f) => {
        const hasCatalog = f.fields.some((field) => field.catalog);
        return hasCatalog ? (result.matches[f.id] ?? []) : [];
      });
      setCatalogStats({
        total: catalogRows.length,
        matched: catalogRows.filter((match) => match.status === "khop").length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gọi được AI.");
    } finally {
      setLoading(false);
    }
  }

  function updateRow(formId: string, rowKey: number, update: (row: Row) => Row) {
    setRows((current) => ({
      ...current,
      [formId]: current[formId].map((row) => (row.key === rowKey ? update(row) : row)),
    }));
  }

  /** Tính lại tổng số lượng, trừ khi bác sĩ đã tự sửa ô tổng */
  function withTotal(form: FormConfig, row: Row): Row {
    const config = rules.tinh_tong;
    if (form.id !== config.form) return row;
    const cell = row.cells[config.truong_tong];
    if (!cell || cell.value !== cell.ai) return row;
    const total = toText(computeTotal(rowValues(row), rules));
    return { ...row, cells: { ...row.cells, [config.truong_tong]: { value: total, ai: total } } };
  }

  function changeCell(form: FormConfig, rowKey: number, fieldId: string, value: string) {
    markStarted();
    updateRow(form.id, rowKey, (row) => {
      const cells = { ...row.cells, [fieldId]: { ...row.cells[fieldId], value } };
      let next: Row = { ...row, cells };
      // Sửa tên hoặc hàm lượng thì mã cũ không còn đúng, phải khớp lại danh mục
      const codeField = form.fields.find(
        (field) => field.catalog && (field.name_field === fieldId || field.strength_field === fieldId),
      );
      if (codeField?.catalog && codeField.name_field) {
        const result = matchCatalog(
          cells[codeField.name_field].value,
          codeField.strength_field ? cells[codeField.strength_field].value : "",
          catalogs[codeField.catalog] ?? [],
          vietTat,
        );
        cells[codeField.id] = { ...cells[codeField.id], value: result.item?.ma ?? "" };
        next = { ...next, cells, matchReason: result.reason, candidates: result.candidates };
      }
      return withTotal(form, next);
    });
  }

  function pickItem(form: FormConfig, rowKey: number, field: FieldDef, item: CatalogItem) {
    updateRow(form.id, rowKey, (row) => {
      const cells = { ...row.cells, [field.id]: { ...row.cells[field.id], value: item.ma } };
      if (field.name_field) cells[field.name_field] = { ...cells[field.name_field], value: item.ten };
      if (field.strength_field) {
        cells[field.strength_field] = { ...cells[field.strength_field], value: item.ham_luong ?? "" };
      }
      return { ...row, cells, matchReason: undefined, candidates: [] };
    });
  }

  function clearCode(form: FormConfig, rowKey: number, field: FieldDef) {
    updateRow(form.id, rowKey, (row) => ({
      ...row,
      cells: { ...row.cells, [field.id]: { ...row.cells[field.id], value: "" } },
    }));
  }

  function addRow(form: FormConfig) {
    setRows((current) => ({ ...current, [form.id]: [...current[form.id], blankRow(form)] }));
  }

  function removeRow(form: FormConfig, rowKey: number) {
    const removed = rows[form.id].find((row) => row.key === rowKey);
    const aiFilled = form.fields.filter((field) => field.ai_fill && removed?.cells[field.id].ai !== "").length;
    setRemovedAiFields((current) => current + aiFilled);
    setRows((current) => ({
      ...current,
      [form.id]: current[form.id].filter((row) => row.key !== rowKey),
    }));
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    const session: SessionInput = {
      kieu_nhap: inputMode,
      tu_ca_mau: caseId !== null,
      ca_mau_id: caseId,
      provider,
      thoi_gian_giay: startedAt === null ? 0 : Math.round((Date.now() - startedAt) / 100) / 10,
      ...countFields(forms, rows, removedAiFields),
      so_muc_danh_muc: catalogStats.total,
      so_muc_khop: catalogStats.matched,
      so_muc_khong_khop: catalogStats.total - catalogStats.matched,
      so_canh_bao: warnings.count,
    };
    try {
      await luuLuotThu(session);
      setConfirmed(session);
    } catch {
      setError("Không lưu được lượt thử, hãy bấm Xác nhận lại.");
    } finally {
      setSaving(false);
    }
  }

  const form = forms.find((f) => f.id === activeForm) ?? forms[0];

  return (
    <main className="grid flex-1 items-start gap-4 p-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <h2 className="mb-3 font-semibold text-navy">{hanhChinhForm.title}</h2>
          <div className="grid grid-cols-2 gap-3">
            {hanhChinhForm.fields.map((field) => (
              <DynamicField
                key={field.id}
                field={field}
                value={hanhChinh[field.id]}
                onChange={(value) => setHanhChinh((current) => ({ ...current, [field.id]: value }))}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="font-semibold text-navy">Bác sĩ tóm tắt ca khám</h2>
            <button
              type="button"
              onClick={() => setShowCases((value) => !value)}
              aria-expanded={showCases}
              className="rounded border border-primary px-2.5 py-1 text-sm font-medium text-primary hover:bg-soft"
            >
              Chọn ca mẫu
            </button>
          </div>
          {showCases && (
            <ul className="mb-2 max-h-72 divide-y divide-gray-100 overflow-auto rounded border border-gray-200">
              {cases.map((item) => (
                <li key={item.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                  <span className="flex-1">{item.ten}</span>
                  <button type="button" onClick={() => loadCase(item, "noi")} className="text-primary hover:underline">
                    Nói
                  </button>
                  <button type="button" onClick={() => loadCase(item, "go")} className="text-primary hover:underline">
                    Gõ tắt
                  </button>
                </li>
              ))}
            </ul>
          )}
          <textarea
            aria-label="Nội dung bác sĩ tóm tắt"
            rows={10}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              markStarted();
            }}
            placeholder="Gõ tắt hoặc đọc tóm tắt ca khám. Chỉ dùng dữ liệu giả."
            className="w-full rounded border border-gray-300 px-2.5 py-2 text-[15px] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <div className="mt-1.5">
            <MicButton
              onStart={() => {
                setInputMode("noi");
                markStarted();
              }}
              onText={(text) => setInput((current) => (current ? `${current} ${text}` : text))}
            />
          </div>
          <button
            type="button"
            onClick={runDraft}
            disabled={loading || input.trim() === ""}
            className="mt-2 w-full rounded bg-accent py-2.5 font-semibold text-on-accent hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "AI đang điền nháp…" : "AI điền nháp"}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-sm text-warn-text">
              {error}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Kiểu nhập: {inputMode === "noi" ? "Nói" : "Gõ"}. AI chỉ chuyển lời bác sĩ thành dữ liệu, bác sĩ là người duyệt và quyết định.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div role="tablist" className="mb-4 flex gap-1 border-b border-gray-200">
          {forms.map((f) => {
            const count = warningCount(f.id);
            return (
              <button
                key={f.id}
                role="tab"
                aria-selected={f.id === form.id}
                onClick={() => setActiveForm(f.id)}
                className={`-mb-px px-4 py-2 font-medium ${
                  f.id === form.id ? "border-b-2 border-primary text-primary" : "text-muted hover:text-ink"
                }`}
              >
                {f.title}
                {count > 0 && <span className="ml-1.5 text-sm text-warn-text">⚠ {count}</span>}
              </button>
            );
          })}
        </div>

        <FormPanel
          key={form.id}
          form={form}
          rows={rows[form.id]}
          warnings={warnings.fields[form.id] ?? {}}
          drafted={drafted}
          catalogs={catalogs}
          vietTat={vietTat}
          onChange={(rowKey, fieldId, value) => changeCell(form, rowKey, fieldId, value)}
          onPick={(rowKey, field, item) => pickItem(form, rowKey, field, item)}
          onClearCode={(rowKey, field) => clearCode(form, rowKey, field)}
          onAddRow={() => addRow(form)}
          onRemoveRow={(rowKey) => removeRow(form, rowKey)}
        />

        {warnings.global.map((message) => (
          <p key={message} className="mt-4 rounded border border-warn bg-white px-3 py-2 text-sm text-warn-text">
            ⚠ {message}
          </p>
        ))}

        <div className="mt-5 border-t border-gray-200 pt-4">
          {confirmed ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="status">
              <p className="text-sm">
                <strong className="text-navy">Đã lưu lượt thử.</strong> Thời gian {confirmed.thoi_gian_giay} giây, AI điền{" "}
                {confirmed.so_truong_ai_dien} trường, bác sĩ sửa {confirmed.so_truong_sua} trường.
              </p>
              <button
                type="button"
                onClick={startNewSession}
                className="rounded border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-soft"
              >
                Bắt đầu lượt mới
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-3">
              {warnings.count > 0 && (
                <span className="text-sm text-warn-text">⚠ Còn {warnings.count} cảnh báo (vẫn có thể xác nhận)</span>
              )}
              <button
                type="button"
                onClick={confirm}
                disabled={saving}
                className="rounded bg-accent px-6 py-2.5 font-semibold text-on-accent hover:brightness-95 disabled:opacity-50"
              >
                {saving ? "Đang lưu…" : "Xác nhận"}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
