"use client";

import type { ReactNode } from "react";
import type { FieldDef } from "@/shared/types";

export type FieldStatus = "none" | "ai" | "edited";

const INPUT_BASE =
  "w-full rounded border px-2.5 py-1.5 text-[15px] text-ink outline-none focus:border-primary focus:ring-1 focus:ring-primary";

export function inputClass(status: FieldStatus, warned: boolean) {
  const bg = status === "ai" ? "bg-ai" : "bg-white";
  const border = warned ? "border-warn ring-1 ring-warn" : "border-gray-300";
  return `${INPUT_BASE} ${bg} ${border}`;
}

function StatusBadge({ status }: { status: FieldStatus }) {
  if (status === "ai") {
    return <span className="rounded bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">AI</span>;
  }
  if (status === "edited") {
    return <span className="rounded bg-navy px-1.5 text-[11px] font-medium text-white">Đã sửa</span>;
  }
  return null;
}

interface Props {
  field: FieldDef;
  value: string;
  status?: FieldStatus;
  warnings?: string[];
  onChange: (value: string) => void;
  /** Thay ô nhập mặc định, dùng cho ô chọn mã từ danh mục */
  children?: ReactNode;
}

export function DynamicField({ field, value, status = "none", warnings = [], onChange, children }: Props) {
  const warned = warnings.length > 0;
  const className = inputClass(status, warned);
  const common = { value, className, title: field.hint || undefined, "aria-label": field.label };

  let control: ReactNode = children;
  if (!control) {
    if (field.type === "textarea") {
      control = <textarea {...common} rows={2} onChange={(e) => onChange(e.target.value)} />;
    } else if (field.type === "select") {
      control = (
        <select {...common} onChange={(e) => onChange(e.target.value)}>
          <option value="">-- Chọn --</option>
          {/* Giữ được giá trị nằm ngoài danh sách để không làm mất dữ liệu */}
          {value && !field.options?.includes(value) && <option value={value}>{value}</option>}
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    } else {
      const type = field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
      control = (
        <input
          {...common}
          type={type}
          step={field.type === "number" ? "any" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
  }

  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1.5">
        <span className="text-sm font-medium text-navy">
          {field.label}
          {field.required && <span className="text-warn-text"> *</span>}
        </span>
        <StatusBadge status={status} />
      </div>
      {control}
      {warnings.map((warning) => (
        <p key={warning} className="mt-0.5 text-xs text-warn-text">
          ⚠ {warning}
        </p>
      ))}
    </div>
  );
}
