import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { goiYIcd } from "@/shared/eform/icd";
import type { QuyTacAi } from "@/shared/eform/types";
import { loadIcd10 } from "./danh-muc";

const quyTac = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "eform", "quy-tac.json"), "utf8")) as QuyTacAi;

test("u bã đậu sau tai ra mã kén tuyến bã, không ra viêm tai ngoài ('bã đậu' bỏ dấu giống 'đau')", () => {
  const goiY = goiYIcd("U bã đậu sau tai phải", loadIcd10(), quyTac);
  assert.equal(goiY[0]?.item.ma, "L72.1");
});
