"use client";

import type { ReactNode } from "react";
import { useEform } from "@/components/eform/EformContext";
import type { Nguon } from "@/lib/eform/types";

export const BTN_OUTLINE =
  "rounded border border-primary px-2.5 py-1 text-sm font-medium text-primary hover:bg-soft disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_AI =
  "rounded bg-accent px-2.5 py-1 text-sm font-semibold text-on-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const INPUT_BASE =
  "w-full rounded border border-gray-300 px-2.5 py-1.5 text-[15px] text-ink outline-none focus:border-primary focus:ring-1 focus:ring-primary";

export function inputClass(nguon: Nguon | null) {
  const bg = nguon === "ai" ? "bg-ai" : nguon === "cu" ? "bg-gray-100" : "bg-white";
  return `${INPUT_BASE} ${bg}`;
}

export function SourceBadge({ nguon }: { nguon: Nguon | null }) {
  if (nguon === "ai") {
    return <span className="rounded bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">✨ AI gợi ý</span>;
  }
  if (nguon === "cu") {
    return <span className="rounded bg-gray-200 px-1.5 text-[11px] font-medium text-ink">Dữ liệu cũ</span>;
  }
  if (nguon === "sua") {
    return <span className="rounded bg-navy px-1.5 text-[11px] font-medium text-white">Đã sửa</span>;
  }
  return null;
}

export function BcytTag() {
  return (
    <span className="rounded border border-navy/40 px-1.5 text-[11px] text-navy" title="Trường này được ghép thẳng vào báo cáo y tế">
      Hiển thị trên BCYT
    </span>
  );
}

export function FieldLabel({ label, nguon, bcyt }: { label: string; nguon?: Nguon | null; bcyt?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-sm font-medium text-navy">{label}</span>
      {bcyt && <BcytTag />}
      <SourceBadge nguon={nguon ?? null} />
    </span>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-primary">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface TextBoxProps {
  id: string;
  label: string;
  rows?: number;
  bcyt?: boolean;
  /** Nút đặt cùng hàng với nhãn */
  actions?: ReactNode;
  /** Nội dung đặt ngay dưới ô nhập */
  children?: ReactNode;
}

export function TextBox({ id, label, rows = 2, bcyt, actions, children }: TextBoxProps) {
  const { get, edit } = useEform();
  const field = get(id);
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <FieldLabel label={label} nguon={field.nguon} bcyt={bcyt} />
        {actions && <div className="flex flex-wrap gap-1.5">{actions}</div>}
      </div>
      <textarea
        aria-label={label}
        rows={rows}
        value={field.value}
        onChange={(e) => edit(id, e.target.value)}
        className={inputClass(field.nguon)}
      />
      {children}
    </div>
  );
}

export function RadioField({ id, label, options }: { id: string; label: string; options: string[] }) {
  const { get, edit } = useEform();
  const field = get(id);
  return (
    <fieldset>
      <legend className="mb-1">
        <FieldLabel label={label} nguon={field.nguon} />
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={id}
              checked={field.value === option}
              onChange={() => edit(id, option)}
              className="accent-primary"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReadonlyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-gray-100 px-2.5 py-1.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-[15px] font-medium text-ink">{value}</div>
    </div>
  );
}

/** Nút thư viện mẫu câu tĩnh: bấm một mẫu để thêm vào cuối ô */
export function ThuVienButton({ id }: { id: string }) {
  const { data, append } = useEform();
  const items = data.thuVien[id] ?? [];
  return (
    <details className="relative">
      <summary className={`${BTN_OUTLINE} cursor-pointer list-none`}>Mở thư viện tham khảo</summary>
      <div className="absolute right-0 z-10 mt-1 w-72 max-w-[80vw] rounded border border-gray-200 bg-white p-1 shadow-lg">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => append(id, item)}
            className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-soft"
          >
            {item}
          </button>
        ))}
      </div>
    </details>
  );
}
