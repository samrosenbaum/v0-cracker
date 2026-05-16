export function toISODateTime(dateInput?: string | null, timeInput?: string | null): string | null {
  if (!dateInput && !timeInput) {
    return null;
  }

  const parseDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // If only one argument is provided, interpret it as a combined date/time value
  if (dateInput && !timeInput) {
    const parsed = parseDate(dateInput);
    return parsed ? parsed.toISOString() : null;
  }

  const baseDate = parseDate(dateInput);
  if (!baseDate) {
    const fallback = parseDate(timeInput);
    return fallback ? fallback.toISOString() : null;
  }

  if (!timeInput) {
    return baseDate.toISOString();
  }

  // Attempt to parse the time input directly as a timestamp first
  const timeAsDate = parseDate(timeInput);
  if (timeAsDate) {
    return timeAsDate.toISOString();
  }

  // Fallback to parsing expressions like "8:30 PM" or "14:05"
  const match = timeInput.match(/(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const seconds = match[3] ? parseInt(match[3], 10) : 0;
    const meridiem = match[4]?.toLowerCase();

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    baseDate.setHours(hours, minutes, seconds, 0);
    return baseDate.toISOString();
  }

  return baseDate.toISOString();
}

export function toISODateString(dateInput?: string | null): string | null {
  if (!dateInput) return null;
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}
