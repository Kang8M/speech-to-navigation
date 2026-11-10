"use client";

import { useState } from "react";
import { MO_PHONG, useEform } from "@/components/eform/EformContext";
import {
  BTN_AI,
  BTN_OUTLINE,
  FieldLabel,
  RadioField,
  ReadonlyItem,
  Section,
  SourceBadge,
  TextBox,
  ThuVienButton,
  inputClass,
} from "@/components/eform/fields";
import { IcdField, IcdMultiField } from "@/components/eform/IcdField";
import { LichSuBlock } from "@/components/eform/LichSuBlock";
import { MauCauPanel } from "@/components/eform/MauCauPanel";
import { demChoTrong } from "@/lib/eform/mau-cau";
import type { KetQuaTheoNgay, SinhHieu } from "@/lib/eform/types";

const CO_KHONG = ["Có", "Không"];

function computeBmi(sinhHieu: SinhHieu): string {
  const metres = sinhHieu.chieu_cao / 100;
  return (sinhHieu.can_nang / (metres * metres)).toFixed(1);
}

function KetQuaGroup({ title, items, extra }: { title: string; items: KetQuaTheoNgay[]; extra?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-navy">{title}</span>
        {items.length > 0 && <SourceBadge nguon="cu" />}
        {extra}
      </div>
      {items.length === 0 && <p className="text-sm text-muted">Chưa có kết quả.</p>}
      <div className="space-y-1">
        {items.map((group) => (
          <details key={group.ngay} className="rounded border border-gray-200 px-2 py-1 text-sm">
            <summary className="cursor-pointer font-medium">{group.ngay}</summary>
            <ul className="mt-1 space-y-0.5">
              {group.muc.map((item) => (
                <li key={item.ten}>
                  <span className="text-muted">{item.ten}:</span> {item.ket_qua}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}

function DateField({ id, label, type }: { id: string; label: string; type: "date" | "datetime-local" }) {
  const { get, edit } = useEform();
  const field = get(id);
  return (
    <label className="block">
      <span className="mb-1 block">
        <FieldLabel label={label} nguon={field.nguon} />
      </span>
      <input type={type} value={field.value} onChange={(e) => edit(id, e.target.value)} className={inputClass(field.nguon)} />
    </label>
  );
}

function KhamChuyenKhoa() {
  const { get } = useEform();
  const [open, setOpen] = useState(false);
  const choTrong = demChoTrong(get("kham_chuyen_khoa").value);
  return (
    <TextBox
      id="kham_chuyen_khoa"
      label="Khám chuyên khoa TMH (Tai/Mũi/Vòm/Họng)"
      rows={4}
      actions={
        <button type="button" className={BTN_AI} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          ✨ Gợi ý mẫu câu
        </button>
      }
    >
      {choTrong > 0 && <p className="mt-0.5 text-xs text-warn-text">⚠ Còn {choTrong} chỗ [ ] chưa chọn, cần điền kết quả khám thực tế.</p>}
      {open && <MauCauPanel />}
    </TextBox>
  );
}

function DanhGiaChung() {
  const { data, get, edit, append, notify } = useEform();
  const { ca, tuyChon } = data;
  const sh = ca.sinh_hieu;
  const diUng = get("di_ung");
  const loaiDiUng = get("di_ung_loai");
  const dangChon = loaiDiUng.value ? loaiDiUng.value.split(",") : [];

  const toggleLoai = (loai: string) => {
    const next = dangChon.includes(loai) ? dangChon.filter((item) => item !== loai) : [...dangChon, loai];
    edit("di_ung_loai", next.join(","));
  };

  return (
    <Section title="1. Đánh giá chung">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-navy">Sinh hiệu (từ phiếu điều dưỡng, chỉ đọc)</span>
          <SourceBadge nguon="cu" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <ReadonlyItem label="Mạch (nhịp/phút)" value={String(sh.mach)} />
          <ReadonlyItem label="Nhiệt độ (°C)" value={String(sh.nhiet_do)} />
          <ReadonlyItem label="Huyết áp (mmHg)" value={`${sh.ha_tam_thu}/${sh.ha_tam_truong}`} />
          <ReadonlyItem label="SpO2 (%)" value={String(sh.spo2)} />
          <ReadonlyItem label="Nhịp thở (lần/phút)" value={String(sh.nhip_tho)} />
          <ReadonlyItem label="Chiều cao (cm)" value={String(sh.chieu_cao)} />
          <ReadonlyItem label="Cân nặng (kg)" value={String(sh.can_nang)} />
          <ReadonlyItem label="BMI (tự tính)" value={computeBmi(sh)} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <DateField id="thoi_gian_kham" label="Thời gian khám" type="datetime-local" />
        <ReadonlyItem label="Bác sĩ khám (tự động)" value={ca.bac_si_kham} />
        <ReadonlyItem label="Phòng khám (tự động)" value={ca.phong_kham} />
        <RadioField id="noi_gioi_thieu" label="Nơi giới thiệu" options={["Cơ quan y tế", "Tự đến"]} />
      </div>

      <TextBox id="ly_do" label="Lý do đến khám" bcyt />

      <TextBox id="tien_su_ban_than" label="Tiền sử bản thân">
        <LichSuBlock targetId="tien_su_ban_than" targetLabel="Tiền sử bản thân" rows={ca.lich_su.tien_su_ban_than} />
      </TextBox>

      <TextBox id="tien_su_gia_dinh" label="Tiền sử gia đình">
        <LichSuBlock targetId="tien_su_gia_dinh" targetLabel="Tiền sử gia đình" rows={ca.lich_su.tien_su_gia_dinh} />
      </TextBox>

      <div className="space-y-2">
        <RadioField id="di_ung" label="Tiền sử dị ứng" options={["Có", "Không", "Không xác định"]} />
        {diUng.value === "Có" && (
          <>
            <fieldset>
              <legend className="mb-1">
                <FieldLabel label="Loại dị ứng" nguon={loaiDiUng.nguon} />
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {tuyChon.loai_di_ung.map((loai) => (
                  <label key={loai} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={dangChon.includes(loai)} onChange={() => toggleLoai(loai)} className="accent-primary" />
                    {loai}
                  </label>
                ))}
              </div>
            </fieldset>
            <TextBox id="di_ung_mo_ta" label="Mô tả dị ứng" rows={1} />
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Lịch sử dị ứng</span>
          {ca.lich_su.di_ung.length > 0 && <SourceBadge nguon="cu" />}
          <button type="button" className={BTN_OUTLINE} onClick={() => notify(MO_PHONG)}>
            Lấy LS dị ứng từ hệ thống khác
          </button>
        </div>
        {ca.lich_su.di_ung.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="bg-soft text-left text-navy">
                  {["Ngày cập nhật", "Loại phiếu", "Loại dị ứng", "Thông tin", "Người cập nhật", ""].map((head) => (
                    <th key={head} className="px-2 py-1 font-medium">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ca.lich_su.di_ung.map((row) => (
                  <tr key={`${row.ngay}-${row.loai_phieu}`} className="border-t border-gray-200 align-top">
                    <td className="whitespace-nowrap px-2 py-1">{row.ngay}</td>
                    <td className="px-2 py-1">{row.loai_phieu}</td>
                    <td className="px-2 py-1">{row.loai}</td>
                    <td className="px-2 py-1">{row.thong_tin}</td>
                    <td className="px-2 py-1">{row.nguoi}</td>
                    <td className="px-2 py-1">
                      <button type="button" className={BTN_OUTLINE} onClick={() => append("di_ung_mo_ta", row.thong_tin, "cu")}>
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TextBox id="benh_su" label="Bệnh sử" rows={4} bcyt>
        <LichSuBlock targetId="benh_su" targetLabel="Bệnh sử" rows={ca.lich_su.benh_su} columnLabel="Bệnh sử" />
      </TextBox>

      <RadioField id="thuoc_dang_dung" label="Thuốc đang dùng (cả kê đơn và không kê đơn)" options={["NB không có", "NB có"]} />

      <div className="space-y-3 rounded border border-gray-200 p-3">
        <FieldLabel label="Khám lâm sàng" bcyt />
        <RadioField id="co_pttt" label="Có phẫu thuật/thủ thuật" options={CO_KHONG} />
        <TextBox id="kham_toan_than" label="Khám toàn thân" actions={<ThuVienButton id="kham_toan_than" />} />
        <KhamChuyenKhoa />
        <TextBox id="kham_khac" label="Khám các bộ phận khác" actions={<ThuVienButton id="kham_khac" />} />
      </div>

      <IcdField id="icd_ban_dau" moTaId="mo_ta_ban_dau" label="Chẩn đoán ban đầu" />

      <div className="space-y-3 rounded border border-gray-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel label="Xét nghiệm, thăm dò chính" bcyt />
          <button type="button" className={BTN_OUTLINE} onClick={() => notify(MO_PHONG)}>
            Lấy kết quả mới nhất
          </button>
        </div>
        <KetQuaGroup title="Kết quả xét nghiệm" items={ca.xet_nghiem} />
        <KetQuaGroup
          title="Kết quả chẩn đoán hình ảnh"
          items={ca.chan_doan_hinh_anh}
          extra={
            <button type="button" className={BTN_OUTLINE} onClick={() => notify(MO_PHONG)}>
              Xem tất cả hình ảnh
            </button>
          }
        />
        <KetQuaGroup
          title="Kết quả cận lâm sàng"
          items={ca.can_lam_sang}
          extra={ca.dong_bo_cls ? <span className="text-xs text-muted">Đồng bộ lần cuối lúc {ca.dong_bo_cls}</span> : undefined}
        />
        <TextBox id="ghi_chu_kq" label="Ghi chú kết quả" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-navy">Thông tin chẩn đoán xác định từ hệ thống ngoài</span>
        <button type="button" className={BTN_OUTLINE} onClick={() => notify(MO_PHONG)}>
          Lấy kết quả
        </button>
      </div>

      <IcdField id="icd_ra_vien" moTaId="mo_ta_ra_vien" label="Chẩn đoán ra viện" />
      <IcdMultiField
        id="icd_kem_theo"
        label="Chẩn đoán kèm theo"
        loaiTru={[get("icd_ban_dau").value, get("icd_ra_vien").value].filter(Boolean)}
      />
      <RadioField id="da_xu_ly" label="Đã xử lý (thuốc, chăm sóc)" options={CO_KHONG} />
    </Section>
  );
}

function DieuTri() {
  const { data, get } = useEform();
  return (
    <Section title="2. Điều trị">
      <TextBox id="huong_dieu_tri" label="Hướng điều trị" bcyt actions={<ThuVienButton id="huong_dieu_tri" />} />
      <TextBox id="loi_dan" label="Lời dặn & theo dõi" bcyt actions={<ThuVienButton id="loi_dan" />} />
      <div className="grid gap-3 md:grid-cols-2">
        <RadioField id="hen_tai_kham" label="Hẹn tái khám" options={CO_KHONG} />
        {get("hen_tai_kham").value === "Có" && <DateField id="ngay_tai_kham" label="Ngày tái khám" type="date" />}
      </div>
      <RadioField id="tinh_trang_ra_vien" label="Tình trạng ra viện" options={data.tuyChon.tinh_trang_ra_vien} />
    </Section>
  );
}

function ThongTinKhac({ noiSoiEnabled }: { noiSoiEnabled: boolean }) {
  const { data, get, edit, notify } = useEform();
  const uyQuyen = get("bs_uy_quyen");
  const noiSoi = get("chuyen_noi_soi");
  return (
    <Section title="3. Thông tin khác">
      <div className="grid gap-3 md:grid-cols-2">
        <ReadonlyItem label="Bác sĩ chính (tự động)" value={data.ca.bac_si_chinh} />
        <div className="flex items-center justify-between gap-2 rounded bg-gray-100 px-2.5 py-1.5">
          <div>
            <div className="text-xs text-muted">Bác sĩ được ủy quyền</div>
            <div className="text-[15px] font-medium text-ink">{uyQuyen.value || "Chưa có"}</div>
          </div>
          <button type="button" className={BTN_OUTLINE} onClick={() => notify(MO_PHONG)}>
            Chỉnh sửa
          </button>
        </div>
      </div>
      <div>
        <label className={`flex items-center gap-1.5 text-sm ${noiSoiEnabled ? "" : "text-muted"}`}>
          <input
            type="checkbox"
            disabled={!noiSoiEnabled}
            checked={noiSoi.value === "Có"}
            onChange={(e) => edit("chuyen_noi_soi", e.target.checked ? "Có" : "")}
            className="accent-primary"
          />
          Chuyển nội soi
        </label>
        {!noiSoiEnabled && <p className="mt-0.5 text-xs text-muted">Chỉ hoạt động khi trạng thái là &quot;Chờ KQ CLS&quot;.</p>}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <RadioField id="xn_benh_tat" label="Xác nhận bệnh tật" options={CO_KHONG} />
        <RadioField id="xn_bhxh" label="Xác nhận nghỉ việc hưởng BHXH" options={CO_KHONG} />
        <RadioField id="xn_me" label="Xác nhận người mẹ không đủ sức khỏe chăm sóc con" options={CO_KHONG} />
      </div>
    </Section>
  );
}

export function EformForm({ noiSoiEnabled }: { noiSoiEnabled: boolean }) {
  return (
    <>
      <DanhGiaChung />
      <DieuTri />
      <ThongTinKhac noiSoiEnabled={noiSoiEnabled} />
    </>
  );
}
