/** Phiên bản bộ rule che PII tự động. Đổi rule thì tăng số. */
export const PII_POLICY_VERSION = "pii-auto-1";

export type PiiRule = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8";

export type PiiLabelKind =
  | "BỆNH_NHÂN" | "NGƯỜI_NHÀ" | "BÁC_SĨ" | "NƠI_LÀM_VIỆC" | "NGƯỜI" | "ĐỊA_DANH" | "NGÀY" | "LIÊN_HỆ"
  | "MÃ_ĐỊNH_DANH" | "THÔNG_TIN_NHẠY_CẢM" | "NỘI_DUNG_NGOÀI_KHÁM" | "TUỔI" | "GIỚI_TÍNH";

/** Giá trị định danh đã biết từ hồ sơ (tên bệnh nhân, người nhà, số điện thoại...). */
export interface KnownIdentifier {
  value: string;
  kind: "BỆNH_NHÂN" | "NGƯỜI_NHÀ" | "BÁC_SĨ" | "NƠI_LÀM_VIỆC" | "MÃ_ĐỊNH_DANH" | "LIÊN_HỆ" | "ĐỊA_DANH";
}

/** start/end tính trên bản thô. */
export interface PiiSpan { rule: PiiRule; kind: PiiLabelKind; start: number; end: number; label: string }

export interface RedactionResult { raw: string; clean: string; spans: PiiSpan[]; counts: Record<PiiRule, number> }
