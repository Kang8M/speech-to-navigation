import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { foldVietnamese } from "@/shared/clinical/pii";
import type { KichBan } from "@/shared/demo-luong/types";
import { ClinicalError } from "@/server/clinical/repository";

const dir = () => path.join(process.cwd(), "data", "demo-luong", "kich-ban");
const ID = /^[a-z0-9-]+$/;

export function listKichBan(): Pick<KichBan, "id" | "ten" | "benh_nhan_id">[] {
  return readdirSync(dir())
    .filter((f) => f.endsWith(".json") && ID.test(f.slice(0, -5)))
    .map((f) => loadKichBan(f.slice(0, -5)))
    .map(({ id, ten, benh_nhan_id }) => ({ id, ten, benh_nhan_id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function loadKichBan(id: string): KichBan {
  if (!ID.test(id)) throw new ClinicalError("Không tìm thấy kịch bản.", 404);
  const file = path.join(dir(), `${id}.json`);
  if (!existsSync(file)) throw new ClinicalError("Không tìm thấy kịch bản.", 404);
  return JSON.parse(readFileSync(file, "utf8")) as KichBan;
}

/** Các đoạn của một phiên; không truyền `phien` thì lấy tất cả. */
export function doanForPhien(k: KichBan, phien?: number): KichBan["doan"] {
  return phien === undefined ? k.doan : k.doan.filter((d) => d.phien === phien);
}

/** Cụm từ lâm sàng TMH bắt đầu bằng họ hoặc từ trùng họ: không phải tên người. */
const TERMS = [
  "dịch nhầy", "phù thanh quản", "sốt cao", "cao liên tục", "co giật", "cổ chướng", "mạc treo",
  "ung thư", "ung thư vòm", "vòm họng", "mạc nhĩ", "thông khí", "dị vật", "đường thở",
  "hạ họng", "tai ngoài", "tai giữa", "tai trong", "viêm xoang", "viêm mũi", "viêm họng", "viêm amidan",
  "ho khan", "ho có đờm", "đau họng", "nghẹt mũi", "chảy mũi", "ù tai", "nghe kém", "thủng màng nhĩ", "chóng mặt",
  "cao huyết áp", "huyết áp cao", "tiền sử", "dương tính", "phù nề", "niêm mạc", "dịch mủ", "mô phỏng bệnh",
];

function readList(rel: string): { ten: string; ten_khac?: string[] }[] {
  return JSON.parse(readFileSync(path.join(process.cwd(), rel), "utf8"));
}

/** Allowlist R11c cho demo: thuật ngữ TMH, tên thuốc và tên dịch vụ trong danh mục (đã bỏ dấu). */
export function demoAllowlist(): ReadonlySet<string> {
  const out = new Set<string>(TERMS.map(foldVietnamese));
  for (const rel of ["data/catalog/thuoc.json", "data/catalog/dich-vu.json"]) {
    for (const it of readList(rel)) for (const n of [it.ten, ...(it.ten_khac ?? [])]) if (n) out.add(foldVietnamese(n));
  }
  return out;
}
