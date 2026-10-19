(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IsaacSaveParser = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MAGIC = 'ISAACNGSAVE09R  ';
  // 成就位不记录难度；事件计数器按角色与标记保存 0/1/2，编号需和游戏角色顺序对应。
  const NORMAL_CHARACTER_MARK_COUNTER_BASES = [27, 41, 55, 69, 83, 97, 116, 130, 144, 173, 423, 457];
  const TAINTED_CHARACTER_MARK_COUNTER_BASES = [199, 218, 237, 256, 275, 294, 313, 332, 351, 389, 423, 457];
  const SPECIAL_CHARACTER_MARK_COUNTERS = [
    [203, 204, 205, 206, 207, 208, 209, 210, 211, 213, 437, 471],
    [214, 233, 252, 271, 290, 309, 328, 347, 366, 404, 438, 472],
    [215, 234, 253, 272, 291, 310, 329, 348, 367, 405, 439, 473]
  ];

  function asDataView(input) {
    if (input instanceof ArrayBuffer) return new DataView(input);
    if (ArrayBuffer.isView(input)) {
      return new DataView(input.buffer, input.byteOffset, input.byteLength);
    }
    throw new TypeError('parsePersistentGameData 需要 ArrayBuffer 或 TypedArray');
  }

  function parsePersistentGameData(input) {
    const dv = asDataView(input);
    if (dv.byteLength < 32) throw new Error('文件过短，不像 persistentgamedata 存档。');

    let cursor = 0;
    let magic = '';
    for (let i = 0; i < 16; i += 1) magic += String.fromCharCode(dv.getUint8(cursor++));
    if (magic !== MAGIC) {
      throw new Error(`存档格式不受支持：文件头为 ${JSON.stringify(magic)}`);
    }

    // 与灰机 Wiki Persistentgamedata.js 一致：0x10 读取一个 32-bit 字段，
    // 随后第一个 block 应为 achievements。
    const headerWord = dv.getUint32(cursor, true);
    cursor += 4;

    const blockType = dv.getUint32(cursor, true); cursor += 4;
    const blockSize = dv.getUint32(cursor, true); cursor += 4;
    const achievementCount = dv.getUint32(cursor, true); cursor += 4;

    if (blockType !== 1) throw new Error(`未找到成就块：第一个 block type = ${blockType}`);
    if (cursor + blockSize > dv.byteLength) throw new Error('成就块长度超过文件大小，存档可能损坏。');

    const achievements = [];
    for (let i = 0; i < blockSize; i += 1) {
      const value = dv.getUint8(cursor + i);
      if (i < achievementCount) achievements.push(value > 0);
    }
    cursor += blockSize;

    let eventCounters = null;
    if (cursor + 12 <= dv.byteLength && dv.getUint32(cursor, true) === 2) {
      const eventSize = dv.getUint32(cursor + 4, true);
      const eventCount = dv.getUint32(cursor + 8, true);
      cursor += 12;
      if (eventCount <= Math.floor((dv.byteLength - cursor) / 4) && eventSize === eventCount * 4) {
        eventCounters = [];
        for (let i = 0; i < eventCount; i += 1) {
          eventCounters.push(dv.getInt32(cursor + i * 4, true));
        }
      }
    }

    let unlockedCount = 0;
    for (let i = 1; i < achievements.length; i += 1) if (achievements[i]) unlockedCount += 1;

    function completionMarkCounterIds(characterIndex) {
      if (!Number.isInteger(characterIndex) || characterIndex < 0 || characterIndex >= 34) return null;
      if (characterIndex < 14) {
        return NORMAL_CHARACTER_MARK_COUNTER_BASES.map((base) => base + characterIndex);
      }
      if (characterIndex < 17) return SPECIAL_CHARACTER_MARK_COUNTERS[characterIndex - 14];
      return TAINTED_CHARACTER_MARK_COUNTER_BASES.map((base) => base + characterIndex);
    }

    function getCompletionMarkStatus(characterIndex) {
      const counterIds = completionMarkCounterIds(characterIndex);
      if (!counterIds) return null;
      const marks = counterIds.map((id) => (
        Number.isInteger(id) && eventCounters && id >= 0 && id < eventCounters.length
          ? eventCounters[id]
          : null
      ));
      if (marks.some((value) => value === null)) return null;
      return {
        normal: marks.every((value) => value >= 1),
        hard: marks.every((value) => value >= 2)
      };
    }

    return {
      magic,
      headerWord,
      achievementBlockSize: blockSize,
      achievementCount,
      achievements,
      eventCounters,
      unlockedCount,
      isAchievementUnlocked(id) {
        return Number.isInteger(id) && id >= 0 && id < achievements.length && achievements[id] === true;
      },
      getEventCounter(id) {
        return Number.isInteger(id) && eventCounters && id >= 0 && id < eventCounters.length
          ? eventCounters[id]
          : null;
      },
      getCompletionMarkStatus
    };
  }

  return { MAGIC, parsePersistentGameData };
});
