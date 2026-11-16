"use client";

import { useState } from "react";
import { StatusBadge } from "@/client/clinic/status";
import { formatClinicDateTimeLenient } from "@/shared/clinic/format";
import type { HistorySummary } from "@/shared/clinic/types";
import { EncounterHistoryDialog } from "./EncounterHistoryDialog";

/** Danh sách lịch sử khám (đã sắp giảm dần từ server). "Xem phiếu" mở toàn bộ phiếu cũ ở chế độ chỉ đọc. */
export function EncounterHistory({ patientId, items }: { patientId: string; items: HistorySummary[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <section aria-labelledby="history-title" className="space-y-2">
      <h2 id="history-title" className="text-lg font-semibold">
        Lịch sử khám
      </h2>
      {items.length === 0 ? (
        <p className="rounded border border-gray-300 bg-white p-4 text-[13px] text-muted">Chưa có lịch sử khám</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded border border-gray-300 bg-white p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{item.summary}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatClinicDateTimeLenient(item.encounter_at)}
                  {item.appointment_id !== null && <> · Mã lượt {item.appointment_id}</>} · {item.doctor_name}
                </p>
              </div>
              {/* Lịch sử không có encounter_id nên nhãn luôn là "Hủy khám" khi hủy, không hiện "Không khám". */}
              <StatusBadge item={{ status: item.status, encounter_id: null }} />
              <button
                type="button"
                onClick={() => setSelectedId(item.id)}
                className="rounded border border-emr-blue bg-white px-3 py-1 text-xs text-emr-blue hover:bg-soft"
              >
                Xem phiếu
              </button>
            </li>
          ))}
        </ul>
      )}
      {selectedId !== null && (
        <EncounterHistoryDialog
          key={patientId}
          patientId={patientId}
          items={items}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}
