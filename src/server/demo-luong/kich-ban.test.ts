import assert from "node:assert/strict";
import { test } from "node:test";
import { checkResidualPii, foldVietnamese, redactPii } from "@/shared/clinical/pii";
import { ClinicalError } from "@/server/clinical/repository";
import { demoAllowlist, doanForPhien, listKichBan, loadKichBan } from "./kich-ban";
import { knownIdentifiersFor } from "./known-identifiers";

test("danh sách có đủ 3 kịch bản", () => {
  assert.deepEqual(listKichBan().map((k) => k.id), ["ca-bi-chan", "ca-chua-dong-y", "ca-chuan"]);
});

test("danh sách trả các phần của từng kịch bản: ca chuẩn có phần 1, 2; ca không chia phần trả rỗng", () => {
  const phien = Object.fromEntries(listKichBan().map((k) => [k.id, k.phien]));
  assert.deepEqual(phien, { "ca-bi-chan": [], "ca-chua-dong-y": [], "ca-chuan": [1, 2] });
});

for (const { id } of listKichBan()) {
  test(`kịch bản ${id}: che đúng, giữ đúng, chốt chặn đúng`, () => {
    const kb = loadKichBan(id);
    const { known } = knownIdentifiersFor(kb.benh_nhan_id);
    const raw = kb.doan.map((d) => d.text).join("\n");
    const r = redactPii(raw, known);
    const clean = foldVietnamese(r.clean);
    for (const s of kb.expected.phai_che) assert.equal(clean.includes(foldVietnamese(s)), false, `còn sót: ${s}`);
    for (const s of kb.expected.phai_giu) assert.equal(clean.includes(foldVietnamese(s)), true, `mất: ${s}`);
    const gate = checkResidualPii(r.clean, known, demoAllowlist());
    assert.equal(gate.passed, !kb.expected.bi_chan, JSON.stringify(gate.reasons));
    if (id === "ca-bi-chan") assert.ok(gate.reasons.some((x) => x.reason === "R11c_ten_rieng_con_sot"), JSON.stringify(gate.reasons));
  });
}

test("ca chuẩn chia 2 phần, ca chưa đồng ý bị route local_only", () => {
  assert.ok(loadKichBan("ca-chuan").doan.length >= 2);
  assert.equal(knownIdentifiersFor(loadKichBan("ca-chua-dong-y").benh_nhan_id).consent.trang_thai, false);
  assert.equal(knownIdentifiersFor(loadKichBan("ca-chuan").benh_nhan_id).consent.trang_thai, true);
});

test("knownIdentifiersFor gom tên, SĐT, địa chỉ, người nhà, nhân viên", () => {
  const { known } = knownIdentifiersFor("GIA-000123");
  const vals = known.map((k) => k.value);
  for (const v of ["Nguyễn Thị Giả", "GIA-000123", "0900000123", "Công ty TNHH Mô Phỏng", "Trần Văn Phụ", "0900000321", "BS. A"]) assert.ok(vals.includes(v), v);
  assert.throws(() => knownIdentifiersFor("khong-co"), ClinicalError);
});

test("loadKichBan chặn id lạ bằng 404", () => {
  for (const bad of ["../x", "a/b", "CA", "", "khong-co"]) {
    assert.throws(() => loadKichBan(bad), (e: unknown) => e instanceof ClinicalError && e.status === 404, bad);
  }
});

test("allowlist chứa cụm lâm sàng bắt buộc, và câu sạch chứa chúng qua chốt chặn", () => {
  const allow = demoAllowlist();
  for (const p of ["dịch nhầy", "phù thanh quản", "sốt cao", "cao liên tục", "co giật", "cổ chướng", "mạc treo", "ung thư"]) {
    assert.ok(allow.has(foldVietnamese(p)), p);
    const sentence = `bệnh nhân ghi nhận ${p} từ hai ngày nay`;
    const g = checkResidualPii(sentence, [], allow);
    assert.equal(g.passed, true, `${p}: ${JSON.stringify(g.reasons)}`);
  }
  const catalog = ["Augmentin", "Amoxicillin", "Nội soi tai mũi họng", "Khám Tai Mũi Họng"];
  for (const n of catalog) assert.ok(allow.has(foldVietnamese(n)), n);
});

test("tôn thất + tên riêng không lọt qua allowlist", () => {
  for (const s of ["gặp tôn thất minh hôm qua", "tôn thất minh đưa tôi đi khám"]) {
    const r = redactPii(s, []);
    assert.equal(checkResidualPii(r.clean, [], demoAllowlist()).passed, false, s);
  }
});

test("ca chuẩn có phiên 1 và 2, mỗi phần riêng đều qua chốt chặn", () => {
  const kb = loadKichBan("ca-chuan");
  const { known } = knownIdentifiersFor(kb.benh_nhan_id);
  assert.equal(doanForPhien(kb).length, kb.doan.length);
  for (const phien of [1, 2]) {
    const part = doanForPhien(kb, phien);
    assert.ok(part.length > 0, `phiên ${phien}`);
    const r = redactPii(part.map((d) => d.text).join(" "), known);
    assert.equal(checkResidualPii(r.clean, known, demoAllowlist()).passed, true, `phiên ${phien}`);
  }
});
