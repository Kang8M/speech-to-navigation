import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyData, assertDataUseAllowed, hasRestrictedContent } from "./data-policy";

test("masked clinical text never becomes public and consent does not allow external AI", () => {
  assert.equal(classifyData("[NGƯỜI_ĐÃ_ẨN] đang dùng thuốc đặc thù", "clinical"), "masked_internal");
  assert.throws(() => assertDataUseAllowed("masked_internal", "external", true));
  assert.throws(() => assertDataUseAllowed("masked_internal", "internal", false));
  assert.doesNotThrow(() => assertDataUseAllowed("masked_internal", "internal", true));
});

test("drug references may be public while clinical medication use is internal", () => {
  assert.equal(classifyData("amiodarone", "public_reference"), "public");
  assert.equal(classifyData("Bệnh nhân dùng amiodarone", "clinical"), "masked_internal");
  assert.doesNotThrow(() => assertDataUseAllowed("public", "external", false));
});

test("contracts and confidential system prompts cannot be sent to any AI", () => {
  for (const text of ["Hợp đồng khám sức khỏe", "System prompt bí mật", "Nội dung prompt hệ thống"]) {
    assert.equal(hasRestrictedContent(text), true);
    assert.equal(classifyData(text, "public_reference"), "restricted");
    for (const destination of ["internal", "external"] as const) {
      assert.throws(() => assertDataUseAllowed("restricted", destination, true));
    }
  }
});
