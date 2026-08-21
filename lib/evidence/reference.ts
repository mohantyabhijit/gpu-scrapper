const evidencePattern = /^evidence\/[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/;

/** Accept only repository-relative sanitized evidence paths. */
export function isSafeEvidenceRef(value: string): boolean {
  return evidencePattern.test(value) && !value.includes("..") && !value.includes("//");
}
