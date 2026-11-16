import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PatientsFixtureSchema } from "@/shared/clinic/schema";
import type { KnownIdentifier } from "@/shared/clinical/pii";
import { ClinicalError } from "@/server/clinical/repository";

const root = process.cwd();
const readJson = (rel: string): unknown => JSON.parse(readFileSync(path.join(root, rel), "utf8"));

interface CaGia { pid: string; ma_luot_kham: string; dang_nhap: string; bac_si_kham: string; bac_si_chinh: string; danh_gia_ban_dau: { gia_tri: string }[] }
interface Directory { doctors: { id: string; name: string }[] }

/** Giá trị định danh đã biết của một bệnh nhân + nhân viên, và cờ đồng ý xử lý AI. Dữ liệu giả. */
export function knownIdentifiersFor(patientId: string): { known: KnownIdentifier[]; consent: { trang_thai: boolean; luc: string | null } } {
  const patient = PatientsFixtureSchema.parse(readJson("data/clinic/patients.json")).find((p) => p.id === patientId);
  if (!patient) throw new ClinicalError("Không tìm thấy bệnh nhân demo.", 404);
  const ca = readJson("data/eform/ca-gia.json") as CaGia;
  const dir = readJson("data/clinic/directory-demo.json") as Directory;

  const known: KnownIdentifier[] = [
    { value: patient.full_name, kind: "BỆNH_NHÂN" },
    { value: patient.id, kind: "MÃ_ĐỊNH_DANH" },
  ];
  if (ca.pid === patient.id) known.push({ value: ca.ma_luot_kham, kind: "MÃ_ĐỊNH_DANH" });
  if (patient.dien_thoai) known.push({ value: patient.dien_thoai, kind: "LIÊN_HỆ" });
  if (patient.dia_chi) known.push({ value: patient.dia_chi, kind: "ĐỊA_DANH" });
  if (patient.noi_lam_viec) known.push({ value: patient.noi_lam_viec, kind: "NƠI_LÀM_VIỆC" });
  for (const n of patient.nguoi_nha ?? []) {
    known.push({ value: n.ho_ten, kind: "NGƯỜI_NHÀ" }, { value: n.dien_thoai, kind: "LIÊN_HỆ" });
  }
  const staff = new Set<string>([ca.bac_si_kham, ca.bac_si_chinh, ...dir.doctors.map((d) => d.name)]);
  for (const g of ca.danh_gia_ban_dau) if (/^ĐD\./.test(g.gia_tri)) staff.add(g.gia_tri.replace(/\s*\(.*\)$/, ""));
  for (const s of staff) known.push({ value: s, kind: "BÁC_SĨ" });

  const c = patient.dong_y_xu_ly_ai;
  return { known, consent: { trang_thai: c?.trang_thai ?? false, luc: c?.luc ?? null } };
}
