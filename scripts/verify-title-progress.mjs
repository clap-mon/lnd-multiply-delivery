import assert from "node:assert/strict";
import { campaignIsComplete, getCampaignClearTitle, loadCollectedTitleIds, loadTitleCampaignProgress, saveCollectedTitleId, saveTitleCampaignStage } from "../src/lib/titles.ts";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

const storage = new MemoryStorage();
for (const stageId of [1, 2, 3, 4, 5]) {
  // 화면 상태가 갱신되기 전의 빈 진행도가 들어와도 저장된 기록을 보존해야 한다.
  saveTitleCampaignStage(storage, {}, "clover", "easy", stageId);
}

const completedProgress = loadTitleCampaignProgress(storage);
assert.deepEqual(completedProgress["clover-easy"], [1, 2, 3, 4, 5]);
assert.equal(campaignIsComplete(completedProgress, "clover", "easy"), true);
assert.equal(campaignIsComplete(completedProgress, "clover", "normal"), false);

const campaignTitle = getCampaignClearTitle("clover", "easy", []);
const savedTitleIds = saveCollectedTitleId(storage, campaignTitle.id);
assert.ok(savedTitleIds.includes(campaignTitle.id));
assert.ok(loadCollectedTitleIds(storage).includes(campaignTitle.id));

console.log("title progress checks passed");
