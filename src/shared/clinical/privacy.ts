/** Heuristic local redaction, not a guarantee of anonymity. Human review is mandatory. */
export const PRIVACY_POLICY_VERSION = "local-review-2";
export function redactTranscript(input: string, knownIdentifiers: string[] = []): { text: string; changes: number } {
  let text = input.normalize("NFC");
  let changes = 0;
  const replace = (pattern: RegExp, value: string) => { text = text.replace(pattern, () => { changes++; return value; }); };
  for (const value of [...knownIdentifiers].map(value => value.normalize("NFC").trim()).filter(value => value.length > 2).sort((a, b) => b.length - a.length)) {
    replace(new RegExp(`(?<![\\p{L}\\d])${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "giu"), "[NGƯỜI_ĐÃ_ẨN]");
  }
  replace(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/giu, "[EMAIL_ĐÃ_ẨN]");
  replace(/(?:số\s*)?(?:điện thoại|sđt|phone)\s*[:：]?\s*\+?[\d\s().-]{8,20}/giu, "[ĐIỆN_THOẠI_ĐÃ_ẨN]");
  replace(/(?:\+84|0)(?:[\s.-]*\d){8,10}(?!\d)/gu, "[ĐIỆN_THOẠI_ĐÃ_ẨN]");
  replace(/(?:ngày sinh|sinh ngày|năm sinh)\s*[:：]?\s*\d{1,4}(?:[\s/.-]+\d{1,4}){0,2}/giu, "[NGÀY_SINH_ĐÃ_ẨN]");
  // Quasi-identifiers remain identifying in combination even after direct IDs are removed.
  // Restrict demographics to explicit age/sex references, not drug names or clinical durations.
  replace(/(?:tuổi\s*[:：]\s*\d{1,3}(?:[.,]\d+)?|(?<![\p{L}\d])\d{1,3}(?:[.,]\d+)?\s*(?:(?:tháng|năm)\s*)?tuổi)(?![\p{L}\d])/giu, "[TUỔI_ĐÃ_ẨN]");
  replace(/(?:giới tính\s*[:：]?\s*|bệnh nhân\s+|tôi là\s+)(?:nam|nữ)(?![\p{L}])/giu, "[GIỚI_TÍNH_ĐÃ_ẨN]");
  replace(/(?<=\bBN\s*[:：]\s*)(?:nam|nữ)(?![\p{L}])/giu, "[GIỚI_TÍNH_ĐÃ_ẨN]");
  replace(/(?<![\d/.-])(?:\d{1,2}[/.\-]\d{1,2}[/.\-](?:19|20)\d{2}|(?:19|20)\d{2}-\d{2}-\d{2})(?!\d)/gu, "[NGÀY_ĐÃ_ẨN]");
  replace(/(?:ngày\s+)?\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+(?:19|20)\d{2}/giu, "[NGÀY_ĐÃ_ẨN]");
  replace(/(?:ngày\s+(?:khám|nhập viện|xuất viện|điều trị|tái khám)|(?:khám|nhập viện|xuất viện|điều trị|tái khám)\s+ngày)\s*[:：]?\s*\d{1,2}[/.\-]\d{1,2}(?![\d/.\-])/giu, "[NGÀY_ĐIỀU_TRỊ_ĐÃ_ẨN]");
  replace(/(?:lúc|vào lúc|giờ\s+(?:khám|nhập viện|xuất viện|điều trị))\s*[:：]?\s*\d{1,2}\s*[:h]\s*\d{2}(?!\d)/giu, "[GIỜ_ĐÃ_ẨN]");
  replace(/(?:số\s*)?(?:cccd|cmnd|căn cước(?: công dân)?|hộ chiếu|(?:thẻ\s*)?bhyt|thẻ\s*bảo hiểm|bảo hiểm(?: y tế| bảo lãnh)?|mã bảo lãnh)\s*[:：]?\s*(?=[a-z0-9/ -]{0,60}\d)[a-z0-9]+(?:[ /-]+[a-z0-9]+)*/giu, "[GIẤY_TỜ_ĐÃ_ẨN]");
  replace(/(?<![\p{L}\d])(?:[A-Z]{2}\d{13}|\d{9,15})(?!\d)/gu, "[ĐỊNH_DANH_ĐÃ_ẨN]");
  replace(/(?:địa chỉ(?: nhà)?|nhà ở|sống tại|cư trú tại)\s*[:：]?[^\n;.!?]+/giu, "[ĐỊA_CHỈ_ĐÃ_ẨN]");
  replace(/(?:tôi tên(?: là)?|họ(?: và)? tên|bệnh nhân tên|bác sĩ tên|tên bác sĩ|tên bệnh nhân)\s*[:：]?\s*[^\n,;.!?]+?(?=\s+(?:bị|đau|ho|sốt|đến khám|khám vì|có triệu chứng)(?=\s|[,;.!?]|$)|[\n,;.!?]|$)/giu, "[HỌ_TÊN_ĐÃ_ẨN]");
  replace(/(?:bác sĩ|bệnh nhân|anh|chị|ông|bà)\s+[\p{Lu}][\p{L}]*(?:\s+[\p{Lu}][\p{L}]*){1,4}/gu, "[NGƯỜI_ĐÃ_ẨN]");
  // Remove only explicit unrelated topics, not clinical family history such as inherited illness.
  replace(/[^\n.!?]*(?:chuyện\s+(?:vay tiền|mua nhà)|nợ nần|tranh chấp tài sản)[^\n.!?]*[.!?]?/giu, " [NỘI_DUNG_NGOÀI_KHÁM_ĐÃ_LOẠI].");
  return { text: text.trim(), changes };
}


/** Review cues, never a certificate of anonymization or an automatic rare-disease classifier. */
export function privacyReviewRisks(input: string): string[] {
  const risks = ["reidentification_review"];
  if (/(?:bệnh|hội chứng)\s+(?:rất\s+)?hiếm|rare\s+disease/iu.test(input.normalize("NFC"))) risks.push("rare_disease_review");
  return risks;
}
