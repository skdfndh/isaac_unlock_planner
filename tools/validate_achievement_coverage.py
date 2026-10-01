#!/usr/bin/env python3
"""核对其余成就页的 ID 覆盖与解锁条件。"""
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_script_data(name: str) -> dict:
    source = (ROOT / "data" / name).read_text("utf-8")
    return json.loads(source.split("=", 1)[1].strip().rstrip(";"))


def main() -> None:
    unlocks = load_script_data("unlocks.js")
    challenges = load_script_data("challenges.js")["entries"]
    achievements = load_script_data("achievements.js")
    condition_overrides = json.loads(
        (ROOT / "tools" / "achievement_extras.json").read_text("utf-8")
    )["conditionOverrides"]
    challenge_seed = json.loads((ROOT / "tools" / "challenge_rewards.json").read_text("utf-8"))
    challenge_names = {
        entry["challengeId"]: entry.get("achievementName", entry["rewardName"])
        for entry in challenge_seed["entries"]
    }
    if len(challenge_names) != len(challenges) or any(
        challenge.get("achievementName", challenge["rewardName"]) != challenge_names.get(challenge["challengeId"])
        for challenge in challenges
    ):
        raise SystemExit("挑战奖励成就名称与源数据不一致")
    if any(not any("\u4e00" <= character <= "\u9fff" for character in name) for name in challenge_names.values()):
        raise SystemExit("挑战奖励成就缺少中文名称")
    boss_ids = {rule["achievementId"] for rule in unlocks["unlockRules"]}
    lists = [
        achievements["main"],
        achievements["characters"]["normal"],
        achievements["characters"]["tainted"],
        achievements["cumulative"],
        achievements["completion"],
        achievements["challengeUnlock"],
    ]
    entries = [entry for group in lists for entry in group]
    entry_by_id = {str(entry["achievementId"]): entry for entry in entries}
    if any(
        entry_by_id.get(achievement_id, {}).get("condition") != condition
        for achievement_id, condition in condition_overrides.items()
    ):
        raise SystemExit("成就解锁条件与已核对的版本条件不一致")
    listed_ids = [entry["achievementId"] for entry in entries]
    if len(listed_ids) != len(set(listed_ids)):
        raise SystemExit("成就分类中存在重复 ID")
    if any(not entry["condition"].strip() for entry in entries):
        raise SystemExit("成就分类中存在空白解锁条件")
    if any(not any("\u4e00" <= character <= "\u9fff" for character in entry["condition"]) for entry in entries):
        raise SystemExit("成就分类中存在非中文解锁条件")

    prerequisite_ids = {challenge["prerequisiteAchievementId"] for challenge in challenges}
    prerequisite_ids.discard(None)
    challenge_unlock_ids = {entry["achievementId"] for entry in achievements["challengeUnlock"]}
    if challenge_unlock_ids != prerequisite_ids:
        raise SystemExit("挑战开放成就与挑战数据不一致")

    reward_ids = {challenge["rewardAchievementId"] for challenge in challenges}
    visible_ids = (set(listed_ids) | reward_ids) - boss_ids
    expected_ids = set(range(1, 642)) - boss_ids
    if visible_ids != expected_ids:
        missing = sorted(expected_ids - visible_ids)
        extra = sorted(visible_ids - expected_ids)
        raise SystemExit(f"其余成就覆盖错误：缺少 {missing}，多出 {extra}")
    print(f"已核对：角色 Boss {len(boss_ids)} 个，其余成就 {len(visible_ids)} 个，全部有解锁条件。")


if __name__ == "__main__":
    main()
