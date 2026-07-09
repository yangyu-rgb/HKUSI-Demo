export function formatDemoDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}


export function formatClock(value: string) {
  return value.slice(11, 16);
}
