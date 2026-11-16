"use client";

import { ClinicDialog } from "@/client/clinic/ClinicDialog";
import { StatusBadge } from "@/client/clinic/status";
import { formatClinicDateTime } from "@/shared/clinic/format";
import type { AppointmentItem } from "@/shared/clinic/types";

/** Chọn lịch khi bệnh nhân có nhiều lịch mở được. Danh sách do server lọc. */
export function AppointmentPicker({
  items,
  onSelect,
  onClose,
}: {
  items: AppointmentItem[];
  onSelect: (appointmentId: string) => void;
  onClose: () => void;
}) {
  return (
    <ClinicDialog open title="Chọn lịch để mở phiếu" onClose={onClose}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.appointment.id}>
            <button
              type="button"
              onClick={() => onSelect(item.appointment.id)}
              className="flex w-full flex-col gap-1 rounded border border-gray-300 bg-white p-3 text-left text-[13px] hover:bg-soft sm:flex-row sm:items-center"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {formatClinicDateTime(item.appointment.starts_at)} · {item.appointment.id}
                </span>
                <span className="block break-words text-muted">{item.appointment.content}</span>
              </span>
              <StatusBadge item={item} />
            </button>
          </li>
        ))}
      </ul>
    </ClinicDialog>
  );
}
