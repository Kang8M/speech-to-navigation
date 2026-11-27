import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { requiredApprovalScopes } from "@/shared/clinical/approvals";
import type { Encounter, JsonValue } from "@/shared/clinical/types";
import type { WarningRules } from "@/shared/types";
import type { DongThuoc } from "./dien-phieu";
import { chuanHoaNguonThuoc, dieuKienIn, duyetMoiNhat, duyetPhieuMoiNhat, moTaLieu, tongSoLuong } from "./don-thuoc";

const rules = JSON.parse(fs.readFileSync("config/canh-bao.json", "utf8")) as WarningRules;
const dong = (patch: Partial<DongThuoc> = {}): DongThuoc => ({ ma: "T1", ten: "Paracetamol", ham_luong: "500mg", duong_dung: "uống", lieu_moi_lan: "1 viên", khi_can: false, so_lan_ngay: "3", thoi_diem: "sau ăn", so_ngay: "5", so_luong_ke: "", ghi_chu: "", nguon: "bs", ung_vien: [], ...patch });

test("moTaLieu: thuốc thường, khi cần và SL", () => {
  assert.equal(moTaLieu(dong()), "500mg · uống · 1 viên × 3 lần/ngày · sau ăn · 5 ngày");
  assert.equal(moTaLieu(dong({ khi_can: true, so_lan_ngay: "", thoi_diem: "", so_ngay: "", so_luong_ke: "6" })), "500mg · uống · 1 viên khi cần · SL 6");
  assert.match(moTaLieu(dong({ khi_can: true, so_lan_ngay: "4" })), /1 viên khi cần, tối đa 4 lần\/ngày/);
});

test("tongSoLuong: tự tính, SL bác sĩ gõ thắng, khi cần không số lượng là null", () => {
  assert.equal(tongSoLuong(dong(), rules), 15);
  assert.equal(tongSoLuong(dong({ so_luong_ke: "10" }), rules), 10);
  assert.equal(tongSoLuong(dong({ khi_can: true, so_lan_ngay: "", so_ngay: "" }), rules), null);
});

test("chuanHoaNguonThuoc: ai thành bs, xem và sua giữ, bỏ tu_ai", () => {
  const out = chuanHoaNguonThuoc([dong({ nguon: "ai", tu_ai: true }), dong({ nguon: "xem" }), dong({ nguon: "sua" })]);
  assert.deepEqual(out.map((r) => r.nguon), ["bs", "xem", "sua"]);
  assert.ok(out.every((r) => !("tu_ai" in r)));
});

const base = (): Encounter => ({ ...JSON.parse(fs.readFileSync("docs/task-2/examples/encounter-service.example.json", "utf8")), tom_tat: null });
function approve(record: Encounter, scope: string) {
  record.approval_versions.push({ id: `a-${record.approval_versions.length}`, scope: scope as never, snapshot: structuredClone(record) as unknown as JsonValue, digest: "d", approved_by: "bs", approved_at: "2026-11-14T00:00:00Z", sources: [] });
}
function themThuoc(record: Encounter, deCap: "co_ke_don" | "khong_ke_don" | "chua_de_cap" = "co_ke_don") {
  const mau = record.chi_dinh.items[0];
  record.don_thuoc = { de_cap: deCap, items: deCap === "co_ke_don" ? [{ id: "rx-1", noi_dung: { ten_thuoc: "Paracetamol", ham_luong: "500mg", duong_dung: "uống", lieu_moi_lan: "1 viên", khi_can: false, so_lan_ngay: "3", thoi_diem: null, so_ngay: "5", so_luong_ke: null, ghi_chu: null }, danh_muc: structuredClone(mau.danh_muc), chan_doan_ids: [], requester_id: null, requested_at: null, review: structuredClone(mau.review) }] : [] };
}
const duyetHet = (record: Encounter, tru: string[] = []) => {
  for (const scope of requiredApprovalScopes(record)) if (!tru.includes(scope)) approve(record, scope);
};

test("dieuKienIn: chưa lưu tắt cả hai nút", () => {
  const record = base(); themThuoc(record); duyetHet(record);
  const kq = dieuKienIn(record, true);
  assert.deepEqual([kq.phieu.ok, kq.phieu.lyDo, kq.don.ok, kq.don.lyDo], [false, "Chưa lưu", false, "Chưa lưu"]);
});

test("dieuKienIn: đơn chưa duyệt nhưng phiếu đủ thì chỉ in được phiếu", () => {
  const record = base(); themThuoc(record); duyetHet(record, ["prescription"]);
  const kq = dieuKienIn(record, false);
  assert.equal(kq.phieu.ok, true);
  assert.deepEqual([kq.don.ok, kq.don.lyDo], [false, "Đơn thuốc chưa duyệt"]);
});

test("dieuKienIn: đơn đã duyệt, phiếu thiếu duyệt chỉ định thì in được đơn mà không in được phiếu", () => {
  const record = base(); themThuoc(record);
  const chiDinh = `service_order:${record.chi_dinh.items[0].id}`;
  duyetHet(record, [chiDinh]);
  const kq = dieuKienIn(record, false);
  assert.equal(kq.don.ok, true);
  assert.equal(kq.phieu.ok, false);
});

test("dieuKienIn: chưa có thuốc và không kê đơn thì tắt nút đơn", () => {
  const chua = base(); themThuoc(chua, "chua_de_cap");
  assert.deepEqual([dieuKienIn(chua, false).don.ok, dieuKienIn(chua, false).don.lyDo], [false, "Đơn chưa có thuốc"]);
  const khong = base(); themThuoc(khong, "khong_ke_don"); duyetHet(khong);
  assert.equal(dieuKienIn(khong, false).don.ok, false);
  assert.equal(dieuKienIn(khong, false).don.lyDo, "Không kê đơn thuốc");
});

test("dieuKienIn: coLoiDan theo phần Kết luận", () => {
  const record = base(); themThuoc(record);
  const scopes = requiredApprovalScopes(record);
  duyetHet(record, ["conclusion"]);
  assert.equal(dieuKienIn(record, false).coLoiDan, !scopes.includes("conclusion"));
  if (scopes.includes("conclusion")) { approve(record, "conclusion"); assert.equal(dieuKienIn(record, false).coLoiDan, true); }
});

test("duyetMoiNhat: lấy lần duyệt mới nhất đúng phần, không có thì undefined", () => {
  const record = base();
  assert.equal(duyetMoiNhat(record, "prescription"), undefined);
  approve(record, "prescription");
  approve(record, "conclusion");
  record.approval_versions.push({ ...structuredClone(record.approval_versions[0]), id: "a-moi", approved_at: "2026-11-20T01:00:00Z" });
  assert.equal(duyetMoiNhat(record, "prescription"), "2026-11-20T01:00:00Z");
  assert.equal(duyetMoiNhat(record, "conclusion"), "2026-11-14T00:00:00Z");
});

test("duyetPhieuMoiNhat: bỏ qua lần duyệt đơn thuốc, lấy mới nhất của các phần còn lại", () => {
  const record = base();
  themThuoc(record);
  assert.equal(duyetPhieuMoiNhat(record), undefined);
  duyetHet(record);
  const phieu = requiredApprovalScopes(record).filter((scope) => scope !== "prescription");
  record.approval_versions.find((item) => item.scope === "prescription")!.approved_at = "2026-12-01T00:00:00Z";
  assert.equal(duyetPhieuMoiNhat(record), "2026-11-14T00:00:00Z");
  record.approval_versions.find((item) => item.scope === phieu[0])!.approved_at = "2026-11-15T00:00:00Z";
  assert.equal(duyetPhieuMoiNhat(record), "2026-11-15T00:00:00Z");
});
