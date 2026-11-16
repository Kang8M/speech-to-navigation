import "server-only";
import path from "node:path";
import { demoStore, type DemoStore } from "./store";

/** Kho demo dùng chung cho mọi route. `DEMO_LUONG_DIR` (đường dẫn thư mục) chỉ để test trỏ vào thư mục tạm. */
export function getDemoStore(): DemoStore {
  const dir = process.env.DEMO_LUONG_DIR;
  return dir ? demoStore(path.resolve(dir)) : demoStore();
}
