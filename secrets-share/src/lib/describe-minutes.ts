const MINUTES_PER_DAY = 60 * 24;
const MINUTES_PER_HOUR = 60;

export function describeMinutes(minutes: number): string {
  if (minutes % MINUTES_PER_DAY === 0) {
    const days = minutes / MINUTES_PER_DAY;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (minutes % MINUTES_PER_HOUR === 0) {
    const hours = minutes / MINUTES_PER_HOUR;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
