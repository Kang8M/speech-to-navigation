/** User-defined data-use rules, not an automatic anonymization guarantee. */
export const DATA_POLICY_VERSION = "medical-data-use-2";
export type DataLevel = "public" | "masked_internal" | "restricted";
export type AiDestination = "internal" | "external";

/** Conservative local recognition; manual classification remains mandatory. */
export function hasRestrictedContent(text: string): boolean {
  return /(?:hợp\s*đồng|\bcontracts?\b|system\s*prompts?|prompt\s*hệ\s*thống|chỉ\s*dẫn\s*hệ\s*thống)/iu.test(text.normalize("NFC"));
}

/** public_reference is an explicit provenance classification, never inferred from masking.
 * Clinical endpoints always pass clinical, including drug names within a patient record.
 */
export function classifyData(text: string, source: "clinical" | "public_reference" = "clinical"): DataLevel {
  if (hasRestrictedContent(text)) return "restricted";
  return source === "public_reference" ? "public" : "masked_internal";
}

export function assertDataUseAllowed(level: DataLevel, destination: AiDestination, consent: boolean): void {
  if (level === "restricted") throw new Error("Dữ liệu cấp 3 không được đưa vào AI, kể cả AI nội bộ.");
  if (level === "masked_internal" && destination !== "internal") {
    throw new Error("Bệnh án đã masking thuộc cấp 2, chỉ được xử lý nội bộ; không gửi tới AI bên ngoài.");
  }
  if (level === "masked_internal" && !consent) throw new Error("Cần sự đồng ý rõ ràng trước khi xử lý dữ liệu cấp 2 nội bộ.");
}
