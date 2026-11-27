"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { luuLuotThu } from "@/client/api";
import { approveScopes, docHoSo, luuHoSo, transitionEncounter, type ClinicalResponse } from "@/client/clinical-api";
import { BanIn } from "@/client/eform/BanIn";
import { BaoCaoDialog } from "@/client/eform/BaoCaoDialog";
import { ChiDinhTab } from "@/client/eform/ChiDinhTab";
import type { EncounterBridge } from "@/client/eform/encounter-bridge";
import { EformContext, MO_PHONG, type EformApi } from "@/client/eform/EformContext";
import { EformForm } from "@/client/eform/EformForm";
import { EformHeader } from "@/client/eform/EformHeader";
import { BTN_CHINH, BTN_OUTLINE, BcytTag, SourceBadge, anchorId } from "@/client/eform/fields";
import { splitCodes } from "@/client/eform/IcdField";
import { LenhNhanh } from "@/client/eform/LenhNhanh";
import { RecordingSessions } from "@/client/eform/RecordingSessions";
import { TroLyAi, type TabId } from "@/client/eform/TroLyAi";
import { apKetQuaLenh } from "@/shared/eform/ap-lenh";
import type { DongChiDinh, DongThuoc, KetQuaDien } from "@/shared/eform/dien-phieu";
import { demLuot } from "@/shared/eform/do-luong";
import type { LenhDien } from "@/shared/eform/lenh-nhanh";
import { doiNguonKhiLuu } from "@/shared/eform/nguon-mau";
import { ghepGoiY } from "@/shared/eform/thoi-quen";
import type { EformData, KichBan, Nguon, Truong } from "@/shared/eform/types";
import { approvalState, requiredApprovalScopes, type ApprovalScope } from "@/shared/clinical/approvals";
import { projectEform } from "@/shared/clinical/eform";
import type { Encounter } from "@/shared/clinical/types";
import type { ClinicalExtraction } from "@/shared/clinical/api";
import type { InputMode } from "@/shared/metrics";

const TRANG_THAI_NOI_SOI = "Chờ KQ CLS";
const TRANG_THAI_DANG_KHAM = "Đang khám";
/** Trạng thái này khóa phiếu (chỉ đọc). Chỉ vào được qua nút Hoàn tất lượt khám, sau khi các phần cần duyệt đều đã duyệt */
const TRANG_THAI_HOAN_THANH = "Hoàn thành khám";
const KHONG_CHI_DINH: DongChiDinh[] = [];
const KHONG_THUOC: DongThuoc[] = [];
const EMPTY: Truong = { value: "", nguon: null };
/** Chiều cao header và thanh dưới đáy (màn rộng), để cột Trợ lý AI ghim vừa khoảng giữa */
const KHUNG = { "--cao-dau": "5.75rem", "--cao-day": "5.75rem" } as CSSProperties;

const TABS: { id: TabId; nhan: string }[] = [
  { id: "phieu", nhan: "Phiếu khám" },
  { id: "chi_dinh", nhan: "Chỉ định dịch vụ" },
];

type TrangThai = ReturnType<typeof projectEform>["trangThai"];
const NHAN_DUYET: Record<"unapproved" | "current" | "changed", string> = { unapproved: "Chưa duyệt", current: "Đã duyệt", changed: "Đã sửa sau khi duyệt" };

function scopeLabel(record: Encounter, scope: ApprovalScope): string {
  if (scope === "initial_note") return "Phiếu khám ban đầu";
  if (scope === "conclusion") return "Kết luận";
  if (scope === "summary") return "Tóm tắt buổi khám";
  const item = record.chi_dinh.items.find((row) => `service_order:${row.id}` === scope);
  return `Chỉ định: ${item?.danh_muc.display || item?.noi_dung.ten_dich_vu || "dịch vụ"}`;
}

/** Số dòng chỉ định, thuốc AI đã thêm và số dòng khớp chắc danh mục lúc thêm (chỉ còn dùng cho trang trình diễn) */
interface DongAi {
  tong: number;
  khop: number;
}

/** Một lượt thử: từ lúc bắt đầu nói, gõ hoặc nạp câu mẫu đến lần bấm Lưu đầu tiên sau khi AI điền */
interface Luot {
  batDau: number | null;
  kieuNhap: InputMode;
  tuCaMau: boolean;
  provider: string;
  /** Phiếu mẫu đã gọi gần nhất trong lượt */
  mauId: string | null;
  /** Đã ghi số đo; muốn thử lượt mới thì tải lại trang */
  daGhi: boolean;
}

function initFields(values: Record<string, string>): Record<string, Truong> {
  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => [id, { value, nguon: value ? ("cu" as const) : null }]),
  );
}

/** Sửa tay vào dữ liệu cũ hoặc phần AI thêm thì chuyển thành "Đã sửa" */
function afterEdit(nguon: Nguon | null | undefined): Nguon {
  return nguon === "cu" || nguon === "ai" || nguon === "xem" || nguon === "sua" ? "sua" : "bs";
}

function nowText(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Trạng thái lúc mở phiếu. Trang /trinh-dien truyền kichBan: kiểu 1 mở ra đã có nháp AI (server đổ sẵn),
 * kiểu 2 và 3 đã chọn sẵn chẩn đoán; kiểu 2 mở thẳng tab Đơn thuốc.
 */
function trangThaiDau(data: EformData, kichBan?: KichBan) {
  const fields = initFields(data.ca.gia_tri);
  const td = data.trinhDien;
  if (td && (kichBan === 2 || kichBan === 3)) {
    // Có mã thì ô ghi chẩn đoán bằng chữ để trống, như phiếu thật
    fields.icd_ra_vien = { value: td.icd, nguon: "bs" };
  }
  if (td && kichBan === 1) {
    const kq = { ...td.phieuMau, donThuoc: [] };
    const them = [...kq.chiDinh, ...kq.donThuoc];
    return {
      fields: { ...fields, ...kq.truong },
      chiDinh: kq.chiDinh,
      donThuoc: kq.donThuoc,
      ketQua: kq,
      dongAi: { tong: them.length, khop: them.filter((row) => row.nguon === "ai").length },
      tab: "phieu" as TabId,
    };
  }
  return { fields, chiDinh: KHONG_CHI_DINH, donThuoc: KHONG_THUOC, ketQua: null, dongAi: { tong: 0, khop: 0 }, tab: "phieu" as TabId };
}

/** Bác sĩ đã nhận gợi ý Tab bấy nhiêu lần thì thôi hiện dòng nhắc phím Tab, Esc dưới ô */
const NHAN_DE_QUEN = 2;

/**
 * Màn phiếu khám. Trong một lượt khám thật, `bridge` do EncounterWorkspace cấp: hồ sơ, phiên bản và điều phối ghi âm đều ở đó.
 * Không có `bridge` (trang /trinh-dien) thì màn chỉ để trình diễn, không ghi hồ sơ.
 */
export function EformScreen({ data, kichBan, bridge }: { data: EformData; kichBan?: KichBan; bridge?: EncounterBridge }) {
  const [dau] = useState(() => trangThaiDau(data, kichBan));
  const record = bridge?.response.record ?? null;
  const clinical = record ? { id: record.id, revision: record.revision } : null;
  const [clinicalError, setClinicalError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const saveLock = useRef(false);
  const [summary, setSummary] = useState("");
  const [lastExtraction, setLastExtraction] = useState<ClinicalExtraction | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [scopesChosen, setScopesChosen] = useState<ApprovalScope[]>([]);
  const [clinicalInfo, setClinicalInfo] = useState("");
  const [noServices, setNoServices] = useState(false);
  const [fields, setFields] = useState(dau.fields);
  const [chiDinh, setChiDinh] = useState(dau.chiDinh);
  const [donThuoc] = useState(dau.donThuoc);
  // Dữ liệu lúc Lưu gần nhất (ban đầu là lúc mở phiếu); khác tham chiếu nghĩa là có thay đổi chưa Lưu
  const [banLuu, setBanLuu] = useState(() => ({ fields, chiDinh, donThuoc, trangThai: data.ca.trang_thai, summary: "", noServices: false, clinicalInfo: "" }));
  const [ketQua, setKetQua] = useState<KetQuaDien | null>(dau.ketQua);
  /** Ô do phiếu mẫu điền, chưa Lưu (để phân biệt với dữ liệu cũ thật cũng mang nguồn "cu"); lúc Lưu đổi thành bác sĩ nhập */
  const [oTuMau, setOTuMau] = useState<ReadonlySet<string>>(() => new Set());
  /** Chữ ô Lệnh nhanh chép xuống ô Nội dung buổi khám của Trợ lý */
  const [noiDungThem, setNoiDungThem] = useState<{ seq: number; text: string } | undefined>(undefined);
  const [dongAi, setDongAi] = useState<DongAi>(dau.dongAi);
  const [luot, setLuot] = useState<Luot>({
    batDau: null,
    kieuNhap: "go",
    tuCaMau: false,
    provider: data.provider,
    mauId: null,
    daGhi: false,
  });
  const [tab, setTab] = useState<TabId>(dau.tab);
  const [trangThai, setTrangThai] = useState(data.ca.trang_thai);
  const [lastEdit, setLastEdit] = useState(data.ca.chinh_sua_cuoi);
  const [expanded, setExpanded] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hydrated = useRef(false);
  // Gợi ý chữ mờ (Tab): tắt đi để đo lượt đối chứng không có gợi ý. Bộ đếm để trong ref, không cần vẽ lại
  const [tabBat, setTabBat] = useState(true);
  const demTab = useRef({ hien: new Set<string>(), nhan: [] as { id: string; cau: string }[], kyTuGoiY: 0, kyTuGo: 0 });
  const [daQuenTab, setDaQuenTab] = useState(false);
  /** Số lần bấm chuột trên màn hình từ lúc mở phiếu */
  const soLanBam = useRef(0);

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  /** Đặt lại toàn bộ phiếu theo bản hồ sơ từ server (lúc mở, sau khi duyệt, đổi trạng thái hoặc quyết định đề xuất AI). */
  const applyLoaded = useCallback((response: ClinicalResponse) => {
    setFields(response.snapshot.fields);
    setSummary(response.record.tom_tat ?? "");
    setLastExtraction(response.latest_ai ?? null);
    setReviewConfirmed(false);
    setScopesChosen([]);
    setNoServices(response.record.chi_dinh.de_cap === "khong_chi_dinh");
    setClinicalInfo(response.snapshot.chiDinhLyDo ?? "");
    setChiDinh(response.snapshot.chiDinh);
    setTrangThai(response.snapshot.trangThai);
    setBanLuu({ fields: response.snapshot.fields, chiDinh: response.snapshot.chiDinh, donThuoc: [], trangThai: response.snapshot.trangThai, summary: response.record.tom_tat ?? "", noServices: response.record.chi_dinh.de_cap === "khong_chi_dinh", clinicalInfo: response.snapshot.chiDinhLyDo ?? "" });
    setKetQua(null);
    setOTuMau(new Set());
    setDongAi({ tong: 0, khop: 0 });
    setLastEdit({ nguoi: response.record.audit.updated_by, luc: new Date(response.record.audit.updated_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) });
    setClinicalError("");
  }, []);

  // Lúc mở lượt khám: đổ hồ sơ server vào phiếu một lần. Sau đó phiếu là của bác sĩ; ghi âm làm đổi phiên bản hồ sơ nhưng không đè các ô đang sửa.
  useEffect(() => {
    if (!bridge || hydrated.current) return;
    hydrated.current = true;
    applyLoaded(bridge.response);
  }, [bridge, applyLoaded]);

  const finish = (response: ClinicalResponse) => {
    bridge?.publish(response);
    applyLoaded(response);
  };

  const reloadSaved = async () => {
    if (!clinical || loadingRecord || saving) return;
    setLoadingRecord(true);
    try { finish(await docHoSo(clinical.id)); }
    catch (error) { setClinicalError(error instanceof Error ? error.message : "Không đọc được hồ sơ."); }
    finally { setLoadingRecord(false); }
  };

  const api = useMemo<EformApi>(
    () => ({
      data,
      notify,
      get: (id) => fields[id] ?? EMPTY,
      edit: (id, value) =>
        setFields((prev) => ({ ...prev, [id]: { value, nguon: afterEdit(prev[id]?.nguon) } })),
      put: (id, value, nguon) => setFields((prev) => ({ ...prev, [id]: { value, nguon } })),
      append: (id, text, nguon) =>
        setFields((prev) => {
          const current = prev[id]?.value ?? "";
          return {
            ...prev,
            [id]: { value: current ? `${current}\n${text}` : text, nguon: nguon ?? afterEdit(prev[id]?.nguon) },
          };
        }),
      goiYTab: {
        bat: tabBat,
        daQuen: daQuenTab,
        daHien: (khoa) => demTab.current.hien.add(khoa),
        daNhan: (id, cau, soKyTu) => {
          demTab.current.nhan.push({ id, cau });
          demTab.current.kyTuGoiY += Math.max(0, soKyTu);
          if (demTab.current.nhan.length >= NHAN_DE_QUEN) setDaQuenTab(true);
        },
        daGo: (soKyTu) => {
          demTab.current.kyTuGo += soKyTu;
          // Gõ vào ô phiếu cũng là bắt đầu lượt, để đo được cả lượt không gọi AI
          setLuot((prev) => (prev.daGhi || prev.batDau !== null ? prev : { ...prev, batDau: Date.now() }));
        },
      },
    }),
    [data, fields, notify, tabBat, daQuenTab],
  );

  const goTo = (id: string) => {
    setTab("phieu");
    // Đợi tab phiếu khám hiện ra rồi mới cuộn và đặt con trỏ vào ô
    setTimeout(() => {
      const el = document.getElementById(anchorId(id));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("textarea, select, input")?.focus({ preventScroll: true });
    }, 50);
  };

  const chuaLuu = fields !== banLuu.fields || chiDinh !== banLuu.chiDinh || trangThai !== banLuu.trangThai || summary !== banLuu.summary || noServices !== banLuu.noServices || clinicalInfo !== banLuu.clinicalInfo;
  const bridgeSetDirty = bridge?.setDirty;
  useEffect(() => { bridgeSetDirty?.(chuaLuu); }, [chuaLuu, bridgeSetDirty]);
  const khoa = trangThai === TRANG_THAI_HOAN_THANH || record?.status === "hoan_thanh_kham";

  const required = record ? requiredApprovalScopes(record) : [];
  const duyet = record ? required.map((scope) => ({ scope, state: approvalState(record, scope) })) : [];
  const duyetDu = duyet.length > 0 && duyet.every((item) => item.state === "current");
  const printable = record && duyetDu && !chuaLuu ? record : null;
  const banInSnapshot = useMemo(() => (printable ? projectEform(printable) : null), [printable]);
  const printApi = useMemo<EformApi>(() => (banInSnapshot ? { ...api, get: (id) => banInSnapshot.fields[id] ?? EMPTY } : api), [api, banInSnapshot]);

  /** Thao tác ghi lên server: chạy một lần, cập nhật phiên bản hồ sơ và đổ lại phiếu theo kết quả. */
  const runAction = async (fallback: string, action: (current: Encounter) => Promise<ClinicalResponse>, done: string) => {
    if (!bridge || saving || loadingRecord) return;
    setSaving(true); setClinicalError("");
    try {
      finish(await action(bridge.latest().record));
      notify(done);
    } catch (error) { setClinicalError(error instanceof Error ? error.message : fallback); }
    finally { setSaving(false); }
  };

  const approveChosen = () => {
    if (chuaLuu || !reviewConfirmed || scopesChosen.length === 0) return;
    void runAction("Không duyệt được hồ sơ.", (current) => approveScopes({ id: current.id, expected_revision: current.revision, scopes: scopesChosen, acknowledged_issues: true }), "Bác sĩ đã duyệt các phần đã chọn. Các phần chưa chọn vẫn là bản nháp.");
  };

  const transition = (action: "wait" | "resume" | "complete") => {
    if (chuaLuu) { notify("Phiếu còn thay đổi chưa Lưu. Bấm Lưu trước khi đổi trạng thái lượt khám."); return; }
    if (bridge?.recordingActive) { notify("Hãy dừng ghi âm trước khi đổi trạng thái lượt khám."); return; }
    if (action === "resume" && fields.chuyen_noi_soi?.value) {
      api.put("chuyen_noi_soi", "", null);
      notify("Đã xóa mục chuyển nội soi vì lượt khám không còn chờ kết quả. Bấm Lưu rồi chọn Tiếp tục khám.");
      return;
    }
    const done = { wait: "Lượt khám chuyển sang chờ kết quả. Có thể chuyển sang bệnh nhân khác.", resume: "Đã tiếp tục khám.", complete: "Đã hoàn tất lượt khám." }[action];
    void runAction("Không đổi được trạng thái lượt khám.", (current) => transitionEncounter({ id: current.id, expected_revision: current.revision, action }), done);
  };

  const changeStatus = (next: string) => {
    if (next === TRANG_THAI_HOAN_THANH) { if (bridge) transition("complete"); return; }
    if (next === TRANG_THAI_NOI_SOI) { if (bridge) transition("wait"); return; }
    if (next === TRANG_THAI_DANG_KHAM && bridge && (record?.status === "cho_kq_cls" || record?.status === "hoan_thanh_kham")) { transition("resume"); return; }
    setTrangThai(next);
    if (fields.chuyen_noi_soi?.value) api.put("chuyen_noi_soi", "", null);
  };

  const conXem =
    Object.values(fields).filter((f) => f.nguon === "xem").length +
    [...chiDinh, ...donThuoc].filter((row) => row.nguon === "xem").length;

  const batDauNhap = (kieuNhap: InputMode, tuCaMau: boolean) =>
    setLuot((prev) =>
      prev.daGhi
        ? prev
        : {
            ...prev,
            batDau: prev.batDau ?? Date.now(),
            kieuNhap: prev.kieuNhap === "noi" ? "noi" : kieuNhap,
            tuCaMau: prev.tuCaMau || tuCaMau,
          },
    );

  /** Ô Lệnh nhanh: áp mẫu và gõ tắt vào phiếu ngay trên máy, trả câu báo */
  const apLenh = (kq: LenhDien): string => {
    const r = apKetQuaLenh(kq, data, api.get, chiDinh);
    const daDoi = Object.keys(r.truong);
    if (daDoi.length > 0) setFields((prev) => ({ ...prev, ...r.truong }));
    if (r.chiDinhThem.length > 0) setChiDinh((prev) => [...prev, ...r.chiDinhThem]);
    // Ô gõ tắt vừa thay chữ mẫu là chữ bác sĩ, không còn tính là do mẫu điền
    if (daDoi.length > 0) {
      setOTuMau((prev) => {
        const moi = new Set([...prev].filter((id) => !r.truong[id]));
        for (const id of r.oTuMau) moi.add(id);
        return moi;
      });
    }
    const them = r.ketQua;
    if (them) setKetQua((prev) => (prev ? { ...prev, daDien: [...prev.daDien, ...them.daDien] } : them));
    const mauId = kq.mau?.id;
    if (mauId) setLuot((prev) => ({ ...prev, mauId }));
    batDauNhap("go", false);
    return r.thongBao;
  };

  /** Ghi số đo lượt thử vào data/sessions/ (chỉ số đếm), hiện ở trang Kết quả thử nghiệm. Trả câu báo thêm */
  const ghiLuot = async (): Promise<string> => {
    const dem = demTab.current;
    if (!ketQua && dem.kyTuGo === 0 && dem.nhan.length === 0) return "";
    if (luot.daGhi) return "";
    try {
      await luuLuotThu({
        kieu_nhap: luot.kieuNhap,
        tu_ca_mau: luot.tuCaMau,
        ca_mau_id: luot.tuCaMau ? data.cauMau.id : null,
        mau_id: luot.mauId,
        provider: luot.provider,
        thoi_gian_giay: luot.batDau === null ? 0 : Math.round((Date.now() - luot.batDau) / 100) / 10,
        ...demLuot(fields, ketQua?.daDien ?? [], dongAi.tong, chiDinh, donThuoc, data.danhMuc.thuoc, data.ca.canh_bao_di_ung),
        so_muc_danh_muc: dongAi.tong,
        so_muc_khop: dongAi.khop,
        so_muc_khong_khop: dongAi.tong - dongAi.khop,
        goi_y_tab: tabBat,
        so_goi_y_hien: dem.hien.size,
        so_goi_y_nhan: dem.nhan.length,
        so_goi_y_nhan_roi_sua: dem.nhan.filter(({ id, cau }) => !(fields[id]?.value ?? "").includes(cau)).length,
        so_ky_tu_goi_y: dem.kyTuGoiY,
        so_ky_tu_go: dem.kyTuGo,
        giao_dien: "cu",
        so_lan_bam_chuot: soLanBam.current,
      });
      setLuot((prev) => ({ ...prev, daGhi: true }));
      return "";
    } catch {
      return " Chưa ghi được số đo lượt thử, hãy bấm Lưu lại.";
    }
  };

  const save = async () => {
    if (saveLock.current || loadingRecord) return;
    if (data.trinhDien) {
      notify("Trang trình diễn không ghi hồ sơ. Mở trang chính để lưu phiếu và chỉ định.");
      return;
    }
    if (!bridge || !clinical) {
      setClinicalError("Chưa mở lượt khám để lưu phiếu.");
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setClinicalError("");
    const snapshot = { fields: doiNguonKhiLuu(fields, oTuMau), chiDinh, chiDinhLyDo: clinicalInfo, chiDinhDeCap: noServices ? "khong_chi_dinh" as const : "chua_de_cap" as const, trangThai: trangThai as TrangThai };
    try {
      const current = bridge.latest().record;
      const response = await luuHoSo(snapshot, { id: current.id, revision: current.revision }, summary || null);
      bridge.publish(response);
      const savedRows = response.snapshot.chiDinh;
      setChiDinh(rows => rows === snapshot.chiDinh ? savedRows : rows);
      // Ô do mẫu điền đã lưu như bác sĩ nhập: đổi nguồn trên màn hình theo bản vừa lưu
      setFields(prev => prev === fields ? snapshot.fields : prev);
      setOTuMau(new Set());
      setBanLuu({ fields: snapshot.fields, chiDinh: savedRows, donThuoc, trangThai: snapshot.trangThai, summary, noServices, clinicalInfo });
      setReviewConfirmed(false); setScopesChosen([]);
      setLastEdit({ nguoi: response.record.audit.updated_by, luc: nowText() });
      const ghiChu = await ghiLuot();
      notify(`Đã lưu phiếu và chỉ định, phiên bản ${response.record.revision}.` + ghiChu);
    } catch (error) {
      setClinicalError(error instanceof Error ? error.message : "Không lưu được hồ sơ.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const soDong = { chi_dinh: chiDinh.length, don_thuoc: donThuoc.length, phieu: 0 };
  // Có gợi ý khớp chẩn đoán (đơn đã kê hoặc bộ mẫu) thì đánh dấu ✨ trên tab, để bác sĩ đang ở phiếu khám biết
  const boMau = ghepGoiY(
    [...new Set(["icd_ra_vien", "icd_ban_dau", "icd_kem_theo"].flatMap((id) => splitCodes(api.get(id).value)))],
    data,
  ).map((item) => item.mau);
  const coGoiY = {
    phieu: false,
    chi_dinh: boMau.some((mau) => mau.chiDinh.length > 0),
    don_thuoc: false,
  };
  const khoaThaoTac = saving || loadingRecord || chuaLuu;
  const duyetMoiNhat = record?.approval_versions.at(-1)?.approved_at;

  return (
    <EformContext.Provider value={api}>
      <div
        className="flex flex-1 flex-col bg-ef-nen text-sm text-ef-chu print:hidden"
        style={KHUNG}
        onClickCapture={() => {
          soLanBam.current += 1;
        }}
      >
        <EformHeader lastEdit={lastEdit} expanded={expanded} onToggleExpand={() => setExpanded((open) => !open)} />

        <div className={`mx-auto grid w-full flex-1 items-start gap-5 px-4 pb-8 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_23rem] ${expanded ? "" : "max-w-[90rem]"}`}>
          <main className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-ef-vien">
              <div>
                <h1 className="text-xl font-semibold text-ef-dam">Phiếu khám ngoại trú</h1>
                <div role="tablist" className="mt-2 flex flex-wrap gap-1">
                  {TABS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === item.id}
                      onClick={() => setTab(item.id)}
                      className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ef-xanh ${
                        tab === item.id ? "border-ef-xanh font-semibold text-ef-dam" : "border-transparent text-ef-phu hover:text-ef-dam"
                      }`}
                    >
                      {item.nhan}
                      {coGoiY[item.id] && (
                        <span className="text-tim" title="Có gợi ý theo chẩn đoán">
                          ✨
                        </span>
                      )}
                      {item.id !== "phieu" && soDong[item.id] > 0 && (
                        <span className="rounded-full bg-tim px-1.5 text-[11px] font-semibold leading-[18px] text-white">{soDong[item.id]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {tab === "phieu" && (
                <div className="flex flex-wrap items-center gap-1.5 pb-2.5 text-xs text-ef-phu">
                  <span>Chú giải:</span>
                  <SourceBadge nguon="ai" />
                  <SourceBadge nguon="xem" />
                  <SourceBadge nguon="sua" />
                  <BcytTag />
                  <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-ef-chu" title="Tắt để đo lượt đối chứng không có gợi ý">
                    <input type="checkbox" checked={tabBat} onChange={(e) => setTabBat(e.target.checked)} className="accent-ef-xanh" />
                    Gợi ý chữ mờ, bấm Tab để nhận
                  </label>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-ef-vien bg-white px-4 py-3 text-[13px] text-ef-phu">
              <p>Phiếu khám và chỉ định dịch vụ · {clinical ? `Bản lưu ${clinical.revision}` : "Chưa có bản lưu"}</p>
              <p>Bác sĩ kê đơn thuốc bằng quy trình riêng.</p>
              {clinical && <button type="button" className={`${BTN_OUTLINE} mt-2`} onClick={reloadSaved} disabled={saving || loadingRecord}>{loadingRecord ? "Đang tải…" : chuaLuu ? "Tải bản lưu (bỏ thay đổi trên màn)" : "Tải bản lưu"}</button>}
            </div>
            {bridge && record && <RecordingSessions sessions={record.recording_sessions} busy={saving || bridge.busy} onDiscard={(session) => { void bridge.discardSession(session).catch((error) => setClinicalError(error instanceof Error ? error.message : "Không bỏ được phần chưa duyệt.")); }} />}
            <div className="space-y-2 rounded-lg border border-ef-vien bg-white px-4 py-3">
              <label className="block text-sm font-semibold" htmlFor="clinical-summary">Tóm tắt buổi khám</label>
              <textarea id="clinical-summary" aria-label="Tóm tắt buổi khám" className="w-full rounded border border-ef-vien p-2" rows={3} value={summary} onChange={event => { setSummary(event.target.value); setReviewConfirmed(false); }} disabled={saving || loadingRecord} />
              {lastExtraction && <details className="text-xs"><summary>Nguồn và điểm cần kiểm tra của lượt AI gần nhất</summary>
                <ul className="list-disc pl-5">{lastExtraction.draft.can_xem_lai.map((issue, i) => <li key={i}>{issue.mo_ta}</li>)}</ul>
                <ul className="mt-2 list-disc pl-5">{lastExtraction.draft.bang_chung.map((item, i) => <li key={i}>{item.field_path}: “{item.trich_doan}”</li>)}</ul>
              </details>}
            </div>
            {bridge && record && (
              <section aria-label="Duyệt và trạng thái lượt khám" className="space-y-2 rounded-lg border border-ef-vien bg-white px-4 py-3">
                <h2 className="text-sm font-semibold">Duyệt theo từng phần</h2>
                <p className="text-xs text-ef-phu">Duyệt không kết thúc lượt khám. Sửa phần nào thì chỉ phần đó cần duyệt lại; các bản đã duyệt trước đó vẫn được lưu.</p>
                <ul className="space-y-1">
                  {duyet.map(({ scope, state }) => (
                    <li key={scope} className="flex items-center gap-2 text-[13px]">
                      <input
                        id={`duyet-${scope}`}
                        type="checkbox"
                        disabled={khoaThaoTac || state === "current" || khoa}
                        checked={scopesChosen.includes(scope)}
                        onChange={(event) => setScopesChosen((current) => event.target.checked ? [...current, scope] : current.filter((item) => item !== scope))}
                      />
                      <label htmlFor={`duyet-${scope}`}>{scopeLabel(record, scope)}</label>
                      <span className={`rounded-full px-2 text-[11px] ${state === "current" ? "bg-ef-xanh/10 text-ef-xanh" : "bg-ef-nen text-ef-phu"}`}>{NHAN_DUYET[state]}</span>
                    </li>
                  ))}
                </ul>
                <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={reviewConfirmed} onChange={event => setReviewConfirmed(event.target.checked)} disabled={khoaThaoTac || khoa} />Tôi đã kiểm tra nội dung các phần đã chọn và các điểm AI đánh dấu.</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={BTN_OUTLINE} onClick={approveChosen} disabled={khoaThaoTac || khoa || !reviewConfirmed || scopesChosen.length === 0}>Duyệt các phần đã chọn</button>
                  <span className="text-xs">{duyetDu && !chuaLuu ? "Đã duyệt đủ các phần" : chuaLuu ? "Còn thay đổi chưa lưu — lưu rồi mới duyệt" : "Bản nháp — lưu rồi duyệt trước khi in"}</span>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-ef-vien/70 pt-2">
                  <button type="button" className={BTN_OUTLINE} disabled={khoaThaoTac || record.status !== "dang_kham"} onClick={() => transition("wait")}>Chờ kết quả</button>
                  <button type="button" className={BTN_OUTLINE} disabled={khoaThaoTac || record.status !== "cho_kq_cls"} onClick={() => transition("resume")}>Tiếp tục khám</button>
                  <button type="button" className={BTN_OUTLINE} disabled={khoaThaoTac || khoa || !["dang_kham", "cho_kq_cls"].includes(record.status)} onClick={() => transition("complete")}>Hoàn tất lượt khám</button>
                </div>
              </section>
            )}
            {clinicalError && <p role="alert" className="rounded-lg border border-ef-do bg-ef-do-nhat px-4 py-3 text-ef-do">{clinicalError}</p>}

            {khoa && (
              <p role="status" className="rounded-lg border border-ef-vien bg-white px-4 py-2.5 text-[13px] text-ef-chu">
                🔒 Lượt khám đã <strong>Hoàn tất</strong>, phiếu chỉ đọc.
              </p>
            )}

            {/* fieldset disabled khóa mọi ô nhập và nút bên trong khi phiếu đã hoàn thành */}
            <fieldset disabled={khoa || saving || loadingRecord} className="contents">
              {tab === "phieu" && <EformForm noiSoiEnabled={trangThai === TRANG_THAI_NOI_SOI} />}
              {tab === "chi_dinh" && <ChiDinhTab rows={chiDinh} onChange={setChiDinh} onSave={save} saving={saving} noServices={noServices} onNoServices={setNoServices} clinicalInfo={clinicalInfo} onClinicalInfo={setClinicalInfo} />}
            </fieldset>
          </main>

          <fieldset disabled={khoa || saving || loadingRecord} className="contents">
            {/* Tạm đặt ô Lệnh nhanh trên đầu cột Trợ lý; cả cột ghim giữa header và thanh đáy */}
            <div className="flex flex-col gap-3 self-start lg:sticky lg:top-[calc(var(--cao-dau)+1rem)] lg:max-h-[calc(100vh-var(--cao-dau)-var(--cao-day)-2rem)] lg:overflow-y-auto">
              <LenhNhanh
                onDien={apLenh}
                onChepXuong={bridge ? (text) => setNoiDungThem((prev) => ({ seq: (prev?.seq ?? 0) + 1, text })) : undefined}
                chuaLuu={chuaLuu}
                onLuu={bridge ? () => void save() : undefined}
                saving={saving}
              />
              <TroLyAi
                bridge={bridge ?? null}
                dirty={chuaLuu}
                onDecided={(response) => { finish(response); notify("Đã lưu quyết định về các đề xuất AI. Hãy xem lại phiếu trước khi duyệt."); }}
                onBatDau={batDauNhap}
                onGoTo={goTo}
                onOpenTab={setTab}
                soChiDinh={chiDinh.length}
                vanBanDau={kichBan === 3 ? data.trinhDien?.lenh : undefined}
                hoiThoai={kichBan === 4 ? data.trinhDien?.hoiThoai : undefined}
                noiDungThem={noiDungThem}
              />
            </div>
          </fieldset>
        </div>

        {toast && (
          <div role="status" className="fixed bottom-20 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 rounded-lg bg-ef-dam px-4 py-2.5 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}

        {/* Thanh đáy 2 tầng như EMR: dải trạng thái lượt khám, rồi hàng nút thao tác. Ghim ở mọi khổ màn */}
        <div className="sticky bottom-0 z-30 border-t border-ef-vien bg-white/95 shadow-[0_-2px_8px_rgba(26,37,51,0.06)] backdrop-blur">
          <div className="border-b border-ef-vien/70 bg-ef-nen/70">
            <div
              role="radiogroup"
              aria-label="Trạng thái lượt khám"
              className="mx-auto flex gap-1.5 overflow-x-auto px-4 py-1.5 sm:flex-wrap sm:justify-center sm:px-6"
            >
              {data.tuyChon.trang_thai.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={trangThai === item}
                  onClick={() => changeStatus(item)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ef-xanh ${
                    trangThai === item
                      ? "border-ef-xanh bg-ef-xanh font-semibold text-white"
                      : "border-ef-vien bg-white text-ef-chu hover:border-ef-phu/50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto flex items-center gap-1.5 px-4 py-2 sm:gap-2 sm:px-6">
            <button
              type="button"
              aria-label="Quay lại"
              className={`${BTN_OUTLINE} whitespace-nowrap`}
              onClick={() => notify(MO_PHONG)}
            >
              ←<span className="hidden sm:inline"> Quay lại</span>
            </button>
            <button type="button" className={`${BTN_OUTLINE} whitespace-nowrap`} onClick={() => setShowReport(true)}>
              Báo cáo y tế
            </button>
            <button type="button" className={`${BTN_OUTLINE} whitespace-nowrap`} onClick={() => { if (printable) window.print(); }} disabled={!printable || saving} title="Chỉ in bản đã lưu và đã được bác sĩ duyệt đủ các phần">
              In ngay
            </button>
            <button type="button" className={`${BTN_CHINH} ml-auto inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap sm:max-w-sm`} onClick={save} disabled={saving || loadingRecord || khoa}>
              {saving ? "Đang lưu…" : "Lưu phiếu & chỉ định"}
              {conXem > 0 && (
                <span className="rounded-full bg-xem-nhat px-2 py-px text-[11px] font-semibold text-xem" title="Số chỗ AI chưa chắc, bác sĩ nên xem lại trước khi Lưu">
                  {conXem} cần xem lại
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="Lên đầu trang"
              className={BTN_OUTLINE}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              ↑
            </button>
          </div>
        </div>

        {showReport && <BaoCaoDialog onClose={() => setShowReport(false)} />}
      </div>

      {printable && banInSnapshot ? (
        <EformContext.Provider value={printApi}>
          <BanIn chiDinh={banInSnapshot.chiDinh} donThuoc={[]} trangThai={banInSnapshot.trangThai} summary={printable.tom_tat ?? ""} followUpText={printable.phieu_kham.hen_tai_kham.nguyen_van ?? undefined} duyet={`Bản đã duyệt đủ các phần · phiên bản hồ sơ ${printable.revision}${duyetMoiNhat ? ` · duyệt lúc ${new Date(duyetMoiNhat).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : ""}`} />
        </EformContext.Provider>
      ) : <p className="hidden print:block">Hồ sơ đang là bản nháp hoặc còn phần chưa duyệt. Hãy lưu và duyệt đủ các phần trước khi in.</p>}
    </EformContext.Provider>
  );
}
