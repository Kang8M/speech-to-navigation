"use client";

import type { ReactNode } from "react";
import { useEform } from "@/client/eform/EformContext";
import type { Nguon } from "@/shared/eform/types";

// Kiểu nút và ô nhập theo giao diện EMR: góc vuông, viền xám, chữ nhỏ.
export const BTN_OUTLINE =
  "rounded-sm border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-ink hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_AI =
  "rounded-sm border border-tim bg-tim-nhat px-2 py-0.5 text-xs font-semibold text-tim hover:bg-tim hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

const INPUT_BASE =
  "w-full rounded-none border px-2 py-1 text-[13px] text-ink outline-none focus:border-emr-blue focus:ring-1 focus:ring-emr-blue";

export function inputClass(nguon: Nguon | null) {
  if (nguon === "ai") return `${INPUT_BASE} border-tim-vien bg-tim-nhat`;
  if (nguon === "xem") return `${INPUT_BASE} border-xem bg-xem-nhat`;
  if (nguon === "cu") return `${INPUT_BASE} border-gray-300 bg-gray-50`;
  return `${INPUT_BASE} border-gray-300 bg-white`;
}

/** id của khối bao quanh một trường, để cột Trợ lý AI cuộn tới */
export function anchorId(id: string) {
  return `truong-${id}`;
}

export function SourceBadge({ nguon }: { nguon: Nguon | null }) {
  if (nguon === "ai") {
    return <span className="rounded-sm bg-tim-nhat px-1.5 text-[11px] font-semibold text-tim">✨ AI điền</span>;
  }
  if (nguon === "xem") {
    return <span className="rounded-sm bg-xem-nhat px-1.5 text-[11px] font-semibold text-xem">⚠ AI chưa chắc, cần xem lại</span>;
  }
  if (nguon === "cu") {
    return <span className="rounded-sm bg-gray-200 px-1.5 text-[11px] font-medium text-ink">Dữ liệu cũ</span>;
  }
  if (nguon === "sua") {
    return <span className="rounded-sm bg-emr-navy px-1.5 text-[11px] font-medium text-white">Đã sửa</span>;
  }
  return null;
}

export function BcytTag() {
  return (
    <span className="text-xs font-normal text-emr-blue" title="Trường này được ghép thẳng vào báo cáo y tế">
      (Hiển thị trên báo cáo y tế)
    </span>
  );
}

export function FieldLabel({ label, nguon, bcyt }: { label: string; nguon?: Nguon | null; bcyt?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-[13px] font-bold text-ink">{label}</span>
      {bcyt && <BcytTag />}
      <SourceBadge nguon={nguon ?? null} />
    </span>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-gray-300 bg-white">
      <h2 className="bg-emr-navy px-2 py-1 text-[13px] font-bold text-white">{title}</h2>
      <div className="space-y-4 p-3">{children}</div>
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
    <div id={anchorId(id)} className="scroll-mt-40">
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
    <fieldset id={anchorId(id)} className="scroll-mt-40">
      <legend className="mb-1">
        <FieldLabel label={label} nguon={field.nguon} />
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-1.5 text-[13px]">
            <input
              type="radio"
              name={id}
              checked={field.value === option}
              onChange={() => edit(id, option)}
              className="accent-emr-blue"
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
    <div>
      <div className="mb-0.5 text-xs font-bold text-ink">{label}</div>
      <div className="border border-gray-200 bg-gray-100 px-2 py-1 text-[13px] text-gray-600">{value}</div>
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
      <div className="absolute right-0 z-10 mt-1 w-72 max-w-[80vw] border border-gray-300 bg-white p-1 shadow-lg">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => append(id, item)}
            className="block w-full px-2 py-1 text-left text-[13px] hover:bg-gray-100"
          >
            {item}
          </button>
        ))}
      </div>
    </details>
  );
}
