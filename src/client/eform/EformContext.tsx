"use client";

import { createContext, useContext } from "react";
import type { EformData, Nguon, Truong } from "@/shared/eform/types";

export const MO_PHONG = "Chưa kết nối hệ thống thật.";

export interface EformApi {
  data: EformData;
  get: (id: string) => Truong;
  /** Bác sĩ gõ trực tiếp vào ô */
  edit: (id: string, value: string) => void;
  /** Đặt cả giá trị và nguồn, dùng khi chọn từ danh sách */
  put: (id: string, value: string, nguon: Nguon | null) => void;
  /** Thêm vào cuối ô, không ghi đè nội dung đang có */
  append: (id: string, text: string, nguon?: Nguon) => void;
  notify: (message: string) => void;
  goiYTab: GoiYTabApi;
}

/** Gợi ý chữ mờ trong ô chữ tự do (bấm Tab để nhận) và bộ đếm số đo của nó */
export interface GoiYTabApi {
  bat: boolean;
  /** Bác sĩ đã nhận gợi ý vài lần: thôi hiện dòng nhắc phím Tab, Esc dưới ô */
  daQuen: boolean;
  /** Một gợi ý vừa hiện; cùng ô cùng câu thì chỉ đếm một lần */
  daHien: (khoa: string) => void;
  /** Bác sĩ bấm Tab nhận gợi ý: `cau` là câu đã chèn vào ô `id`, ô dài thêm `soKyTu` ký tự */
  daNhan: (id: string, cau: string, soKyTu: number) => void;
  /** Bác sĩ tự gõ thêm `soKyTu` ký tự vào một ô */
  daGo: (soKyTu: number) => void;
}

export const EformContext = createContext<EformApi | null>(null);

export function useEform(): EformApi {
  const api = useContext(EformContext);
  if (!api) throw new Error("useEform phải nằm trong EformContext");
  return api;
}
