(function (root) {
  function nonNegative(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new Error("OT 발생 시간은 0 이상의 숫자로 입력해 주세요.");
    return number;
  }

  // null means a legacy total whose early/other split has not been confirmed.
  function getSplit(record) {
    if (record.earlyOt == null && record.otherOt == null) return null;
    if (record.earlyOt == null || record.otherOt == null) throw new Error("조출 OT와 기타 OT를 함께 저장해야 합니다.");
    const earlyOt = nonNegative(record.earlyOt);
    const otherOt = nonNegative(record.otherOt);
    return { earlyOt, otherOt, otEarned: earlyOt + otherOt };
  }

  function resolveLegacy(record, earlyValue) {
    const total = nonNegative(record.otEarned || 0);
    const earlyOt = nonNegative(earlyValue);
    if (earlyOt > total) throw new Error("조출 시간은 기존 발생 OT 합계를 넘을 수 없습니다.");
    return { ...record, earlyOt, otherOt: total - earlyOt };
  }

  const api = { nonNegative, getSplit, resolveLegacy };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OtModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
