"use client";

import { CatalogPicker, describeItem } from "@/client/chung/CatalogPicker";
import { DynamicField, inputClass, type FieldStatus } from "@/client/chung/DynamicField";
import type { Row } from "@/client/workspace/trang-thai";
import { cellStatus } from "@/client/workspace/trang-thai";
import type { CatalogItem, Catalogs, FieldDef, FormConfig, VietTat } from "@/shared/types";

interface Props {
  form: FormConfig;
  rows: Row[];
  warnings: Record<number, Record<string, string[]>>;
  drafted: boolean;
  catalogs: Catalogs;
  vietTat: VietTat;
  onChange: (rowKey: number, fieldId: string, value: string) => void;
  onPick: (rowKey: number, field: FieldDef, item: CatalogItem) => void;
  onClearCode: (rowKey: number, field: FieldDef) => void;
  onAddRow: () => void;
  onRemoveRow: (rowKey: number) => void;
}

export function FormPanel(props: Props) {
  const { form, rows, warnings, drafted, catalogs, vietTat } = props;

  function renderField(row: Row, rowIndex: number, field: FieldDef) {
    const cell = row.cells[field.id];
    const status: FieldStatus = cellStatus(cell, drafted);
    const fieldWarnings = warnings[rowIndex]?.[field.id] ?? [];
    return (
      <div key={field.id} className={field.type === "textarea" ? "md:col-span-2" : undefined}>
        <DynamicField
          field={field}
          value={cell.value}
          status={status}
          warnings={fieldWarnings}
          onChange={(value) => props.onChange(row.key, field.id, value)}
        >
          {field.catalog ? (
            <CatalogPicker
              value={cell.value}
              label={field.label}
              className={inputClass(status, fieldWarnings.length > 0)}
              catalog={catalogs[field.catalog] ?? []}
              vietTat={vietTat}
              onPick={(item) => props.onPick(row.key, field, item)}
              onClear={() => props.onClearCode(row.key, field)}
            />
          ) : undefined}
        </DynamicField>
        {field.catalog && !cell.value && row.candidates.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {row.candidates.map((item) => (
              <button
                key={item.ma}
                type="button"
                onClick={() => props.onPick(row.key, field, item)}
                className="rounded border border-warn/60 bg-white px-1.5 py-0.5 text-xs text-ink hover:bg-soft"
              >
                {item.ma}: {describeItem(item)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (form.mode === "single") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {form.fields.map((field) => renderField(rows[0], 0, field))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-sm text-muted">Chưa có dòng nào.</p>}
      {rows.map((row, index) => (
        <div key={row.key} className="rounded border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-navy">Dòng {index + 1}</span>
            <button
              type="button"
              onClick={() => props.onRemoveRow(row.key)}
              className="text-sm text-muted hover:text-warn-text"
            >
              Xóa dòng
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {form.fields.map((field) => renderField(row, index, field))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={props.onAddRow}
        className="rounded border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-soft"
      >
        + Thêm dòng
      </button>
    </div>
  );
}
