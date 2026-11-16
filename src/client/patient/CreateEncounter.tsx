"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { openAppointment } from "@/client/clinic/api";
import { chooseAppointment, openHref } from "@/client/clinic/open-appointment";
import type { AppointmentItem } from "@/shared/clinic/types";
import { AppointmentPicker } from "./AppointmentPicker";

/** Nút "Tạo phiếu khám" trên hồ sơ bệnh nhân: 0 lịch tắt, 1 lịch mở thẳng, nhiều lịch thì chọn. */
export function CreateEncounter({
  items,
  selectedAppointmentId,
}: {
  items: AppointmentItem[];
  selectedAppointmentId: string | null;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const choice = chooseAppointment(items, selectedAppointmentId);
  const note =
    choice.action === "disabled"
      ? "Chưa có lịch khám mở được phiếu cho bệnh nhân này"
      : choice.action === "pick"
        ? `${items.length} lịch có thể mở, chọn lịch khi bấm`
        : "";

  async function open(appointmentId: string) {
    setPicking(false);
    setPending(true);
    setError("");
    try {
      const { encounter_id } = await openAppointment(appointmentId);
      router.push(openHref(encounter_id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không mở được phiếu khám.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        disabled={choice.action === "disabled" || pending}
        aria-describedby="create-note"
        onClick={() => (choice.action === "open" ? void open(choice.appointmentId) : setPicking(true))}
        className="rounded bg-emr-blue px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-muted"
      >
        {pending ? "Đang mở phiếu…" : "Tạo phiếu khám"}
      </button>
      <p id="create-note" className="text-xs text-muted">
        {note}
      </p>
      {error !== "" && (
        <p role="alert" className="text-xs text-[#a02622]">
          {error}
        </p>
      )}
      {picking && <AppointmentPicker items={items} onSelect={(id) => void open(id)} onClose={() => setPicking(false)} />}
    </div>
  );
}
