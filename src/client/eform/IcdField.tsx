"use client";

import { useState } from "react";
import { useEform } from "@/client/eform/EformContext";
import { BTN_AI, FieldLabel, anchorId, inputClass } from "@/client/eform/fields";
import { GoiYIcdPanel } from "@/client/eform/GoiYIcdPanel";

const SEPARATOR = ",";

export function splitCodes(value: string): string[] {
  return value ? value.split(SEPARATOR) : [];
}

function GoiYButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={BTN_AI} aria-expanded={open} onClick={onToggle}>
      ✨ Gợi ý ICD10
    </button>
  );
}

/** Một mã ICD10 kèm ô mô tả */
export function IcdField({ id, moTaId, label }: { id: string; moTaId: string; label: string }) {
  const { data, get, put, edit } = useEform();
  const [open, setOpen] = useState(false);
  const field = get(id);
  const moTa = get(moTaId);
  return (
    <div className="space-y-2">
      <div id={anchorId(id)} className="scroll-mt-40">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <FieldLabel label={`${label} (ICD10)`} nguon={field.nguon} />
          <GoiYButton open={open} onToggle={() => setOpen((value) => !value)} />
        </div>
        <select
          aria-label={`${label} (ICD10)`}
          value={field.value}
          onChange={(e) => put(id, e.target.value, e.target.value ? "bs" : null)}
          className={inputClass(field.nguon)}
        >
          <option value="">-- Chọn mã ICD10 --</option>
          {data.icd10.map((item) => (
            <option key={item.ma} value={item.ma}>
              {item.ma} – {item.ten}
            </option>
          ))}
        </select>
        {open && (
          <GoiYIcdPanel
            onPick={(ma) => {
              put(id, ma, "ai");
              setOpen(false);
            }}
          />
        )}
      </div>
      <div id={anchorId(moTaId)} className="scroll-mt-40">
        <div className="mb-1">
          <FieldLabel label={`Mô tả ${label.toLowerCase()}`} nguon={moTa.nguon} />
        </div>
        <textarea
          aria-label={`Mô tả ${label.toLowerCase()}`}
          rows={1}
          value={moTa.value}
          onChange={(e) => edit(moTaId, e.target.value)}
          className={inputClass(moTa.nguon)}
        />
      </div>
    </div>
  );
}

/** Nhiều mã ICD10, hiển thị thành các thẻ có nút xóa */
export function IcdMultiField({ id, label, loaiTru }: { id: string; label: string; loaiTru: string[] }) {
  const { data, get, put } = useEform();
  const [open, setOpen] = useState(false);
  const field = get(id);
  const codes = splitCodes(field.value);

  const add = (code: string, nguon: "ai" | "bs") => {
    if (code && !codes.includes(code)) put(id, [...codes, code].join(SEPARATOR), nguon);
  };
  const remove = (code: string) => {
    const next = codes.filter((item) => item !== code);
    put(id, next.join(SEPARATOR), next.length > 0 ? field.nguon : null);
  };

  return (
    <div id={anchorId(id)} className="scroll-mt-40">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <FieldLabel label={`${label} (ICD10)`} nguon={field.nguon} bcyt />
        <GoiYButton open={open} onToggle={() => setOpen((value) => !value)} />
      </div>
      {codes.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {codes.map((code) => (
            <span
              key={code}
              className={`flex items-center gap-1 rounded-sm px-2 py-0.5 text-[13px] ${field.nguon === "xem" ? "border border-xem bg-xem-nhat" : field.nguon === "ai" ? "bg-tim-nhat" : "bg-gray-100"}`}
            >
              {code} – {data.icd10.find((item) => item.ma === code)?.ten}
              <button type="button" aria-label={`Bỏ ${code}`} onClick={() => remove(code)} className="text-muted hover:text-warn-text">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <select aria-label={`Thêm ${label.toLowerCase()}`} value="" onChange={(e) => add(e.target.value, "bs")} className={inputClass(null)}>
        <option value="">-- Thêm mã ICD10 --</option>
        {data.icd10
          .filter((item) => !codes.includes(item.ma))
          .map((item) => (
            <option key={item.ma} value={item.ma}>
              {item.ma} – {item.ten}
            </option>
          ))}
      </select>
      {open && (
        <GoiYIcdPanel
          loaiTru={[...codes, ...loaiTru]}
          onPick={(ma) => {
            add(ma, "ai");
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
