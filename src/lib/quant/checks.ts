import type { Probabilities } from "./path-eval";

/**
 * Automated mathematical sanity checks. Every engine's output and the combined estimate
 * must pass; failures are reported (and the API refuses to return numbers that fail).
 */
export function sanityCheck(p: Probabilities, name: string, tol = 1e-6): string[] {
  const f: string[] = [];
  const unit = (v: number, label: string) => {
    if (!(v >= -tol && v <= 1 + tol)) f.push(`${name}: ${label} = ${v} is outside [0, 1]`);
  };
  unit(p.fill, "P(fill)");
  unit(p.targetTouched, "P(target touched | fill)");
  unit(p.stopTouched, "P(stop touched | fill)");
  unit(p.both, "P(both | fill)");
  unit(p.neither, "P(neither | fill)");
  unit(p.targetFirst, "P(target first | fill)");
  unit(p.stopFirst, "P(stop first | fill)");
  unit(p.ambiguous, "P(ambiguous | fill)");
  if (p.fill > 0) {
    const firstSum = p.targetFirst + p.stopFirst + p.neither + p.ambiguous;
    if (Math.abs(firstSum - 1) > 1e-4)
      f.push(
        `${name}: target first + stop first + neither + ambiguous = ${firstSum.toFixed(6)}, expected 1`,
      );
    const inclExcl = p.targetTouched + p.stopTouched - p.both + p.neither;
    if (Math.abs(inclExcl - 1) > 1e-4)
      f.push(
        `${name}: P(target) + P(stop) − P(both) + P(neither) = ${inclExcl.toFixed(6)}, expected 1`,
      );
  }
  if (p.both > Math.min(p.targetTouched, p.stopTouched) + tol)
    f.push(`${name}: P(both) exceeds a touch probability`);
  if (p.targetFirst > p.targetTouched + tol)
    f.push(`${name}: P(target first) exceeds P(target touched)`);
  if (p.stopFirst > p.stopTouched + tol) f.push(`${name}: P(stop first) exceeds P(stop touched)`);
  return f;
}
