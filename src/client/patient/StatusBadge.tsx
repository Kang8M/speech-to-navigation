import type { DisplayStatus } from "@/shared/clinic/types";

// Nhãn và màu theo bảng trạng thái của thiết kế (mục 5). Màu lấy từ token theme hiện có.
// Chưa có ef_* trên nhánh này nên dùng primary/xem/accent/navy và đỏ chuẩn Tailwind cho "hủy".
// TODO hợp nhất: nếu dashboard có badge dùng chung ở src/client/clinic/ thì thay file này.
const STATUS: Record<DisplayStatus, { label: string; className: string }> = {
  scheduled: { label: "Chưa khám", className: "border-gray-300 bg-soft text-muted" },
  in_progress: { label: "Đang khám", className: "border-primary/40 bg-primary/10 text-primary" },
  waiting_results: { label: "Chờ kết quả CLS", className: "border-xem/40 bg-xem-nhat text-xem" },
  completed: {
    label: "Hoàn thành",
    className: "border-accent/50 bg-accent/10 text-[color-mix(in_srgb,var(--accent)_55%,black)]",
  },
  cancelled: { label: "Hủy khám", className: "border-red-300 bg-red-50 text-red-700" },
  admitted: { label: "Nhập viện", className: "border-navy/40 bg-navy/10 text-navy" },
  emergency_transfer: { label: "Chuyển cấp cứu", className: "border-red-300 bg-red-50 text-red-700" },
  facility_transfer: { label: "Chuyển cơ sở", className: "border-primary/40 bg-primary/10 text-primary" },
  unknown: { label: "Chưa xác định", className: "border-dashed border-gray-400 bg-white text-muted" },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}
