export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function getLastMonday(d: Date): Date {
  const monday = getMonday(d);
  monday.setDate(monday.getDate() - 7);
  return monday;
}
