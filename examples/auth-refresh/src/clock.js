// Session timestamps use Unix seconds; JavaScript clocks use milliseconds.
export function unixSeconds(nowMs) {
  return Math.floor(nowMs / 1000);
}
