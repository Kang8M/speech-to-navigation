import { approvalState, requiredApprovalScopes, DON_THUOC_TRONG } from "@/shared/clinical/approvals";
import type { Encounter } from "@/shared/clinical/types";
import type { WarningRules } from "@/shared/types";
import { bungDonViLieu, computeTotal } from "@/shared/validate";
import type { DongThuoc } from "./dien-phieu";

function moTaSoLan(row: DongThuoc, rules: WarningRules): string {
  if (!row.lieu_moi_lan) return "";
  const lieu = bungDonViLieu(row.lieu_moi_lan, rules);
  if (!row.khi_can) return `${lieu} × ${row.so_lan_ngay} lần/ngày`;
  return row.so_lan_ngay ? `${lieu} khi cần, tối đa ${row.so_lan_ngay} lần/ngày` : `${lieu} khi cần`;
}

/** Một dòng mô tả cách dùng: hàm lượng, đường dùng, liều, thời điểm, số ngày, SL bác sĩ ghi, ghi chú */
export function moTaLieu(row: DongThuoc, rules: WarningRules): string {
  return [row.ham_luong, row.duong_dung, moTaSoLan(row, rules), row.thoi_diem, row.so_ngay && `${row.so_ngay} ngày`, row.so_luong_ke && `SL ${row.so_luong_ke}`, row.ghi_chu]
    .filter(Boolean)
    .join(" · ");
}

/** Tổng SL: số bác sĩ gõ nếu > 0, không thì tự tính; null khi chưa xác định */
export function tongSoLuong(row: DongThuoc, rules: WarningRules): number | null {
  return computeTotal({ lieu_moi_lan: row.lieu_moi_lan, so_lan_ngay: row.so_lan_ngay, so_ngay: row.so_ngay, so_luong_ke: row.so_luong_ke ?? "" }, rules);
}

/** Dòng thuốc không bao giờ mang nguồn "ai": gợi ý bác sĩ chọn là "bs", chưa chắc giữ "xem"; bỏ cờ tu_ai */
export function chuanHoaNguonThuoc(rows: DongThuoc[]): DongThuoc[] {
  return rows.map((row) => {
    const moi: DongThuoc = { ...row, nguon: row.nguon === "ai" ? "bs" : row.nguon };
    delete moi.tu_ai;
    return moi;
  });
}

/** Dòng thuốc chưa duyệt mà bác sĩ còn phải chọn lại thuốc: chưa có mã, hoặc còn ứng viên khác để chọn */
export function canChonLaiThuoc(row: DongThuoc): boolean {
  return row.nguon === "xem" && (!row.ma || row.ung_vien.length > 0);
}

/** Nhãn nguồn của dòng thuốc (không nhắc AI: thuốc chỉ do bác sĩ chọn); null khi không cần nhãn */
export function nhanThuoc(row: DongThuoc): string | null {
  if (row.nguon === "xem") return canChonLaiThuoc(row) ? "Cần chọn đúng thuốc" : "Chưa duyệt";
  if (row.nguon === "sua") return "Đã sửa";
  return null;
}

interface DieuKien { ok: boolean; lyDo: string }

/** Điều kiện bật nút In phiếu khám / In đơn thuốc, và có in lời dặn, hẹn tái khám trên đơn không */
export function dieuKienIn(record: Encounter, chuaLuu: boolean): { phieu: DieuKien; don: DieuKien; coLoiDan: boolean } {
  const required = requiredApprovalScopes(record);
  const current = (scope: Parameters<typeof approvalState>[1]) => approvalState(record, scope) === "current";
  const phieuThieu = required.some((scope) => scope !== "prescription" && !current(scope));
  const phieu: DieuKien = chuaLuu ? { ok: false, lyDo: "Chưa lưu" } : phieuThieu ? { ok: false, lyDo: "Phiếu còn phần chưa duyệt" } : { ok: true, lyDo: "" };

  const deCap = (record.don_thuoc ?? DON_THUOC_TRONG).de_cap;
  const don: DieuKien = chuaLuu
    ? { ok: false, lyDo: "Chưa lưu" }
    : deCap === "khong_ke_don"
      ? { ok: false, lyDo: "Không kê đơn thuốc" }
      : deCap !== "co_ke_don"
        ? { ok: false, lyDo: "Đơn chưa có thuốc" }
        : !current("prescription")
          ? { ok: false, lyDo: "Đơn thuốc chưa duyệt" }
          : { ok: true, lyDo: "" };

  return { phieu, don, coLoiDan: !required.includes("conclusion") || current("conclusion") };
}

/** Thời điểm duyệt mới nhất của một phần (chuỗi ISO); undefined khi chưa duyệt lần nào */
export function duyetMoiNhat(record: Encounter, scope: Encounter["approval_versions"][number]["scope"]): string | undefined {
  return record.approval_versions.findLast((item) => item.scope === scope)?.approved_at;
}

/** Thời điểm duyệt mới nhất trong các phần của phiếu khám (không tính đơn thuốc); undefined khi chưa phần nào được duyệt */
export function duyetPhieuMoiNhat(record: Encounter): string | undefined {
  return requiredApprovalScopes(record)
    .filter((scope) => scope !== "prescription")
    .map((scope) => duyetMoiNhat(record, scope))
    .filter((luc): luc is string => Boolean(luc))
    .sort()
    .at(-1);
}
