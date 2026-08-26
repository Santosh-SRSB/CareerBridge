const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_INDEX = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

function text(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function stringList(value) {
  return asList(value).map((item) => {
    if (item && typeof item === "object") return text(item.name || item.text || item.value);
    return text(item);
  }).filter(Boolean);
}

function monthName(index) {
  return MONTHS[index - 1] || "";
}

function parseMonthToken(raw) {
  const key = text(raw).toLowerCase();
  return MONTH_INDEX[key] || null;
}

function parseYearToken(raw) {
  const match = String(raw || "").match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
}

function isPresent(raw) {
  return /^(present|current|now|ongoing)$/i.test(text(raw));
}

function toMonthNumber(year, month) {
  if (!year || !month) return null;
  return year * 12 + month;
}

function parsePartialDate(monthValue, yearValue, fallbackText, { present } = {}) {
  if (present || isPresent(fallbackText) || isPresent(yearValue) || isPresent(monthValue)) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, present: true };
  }
  const month = parseMonthToken(monthValue) || parseMonthToken(String(fallbackText || "").split(/\s+/)[0]);
  const year = parseYearToken(yearValue) || parseYearToken(fallbackText);
  if (year && month) return { year, month, present: false };
  if (year) return { year, month: null, present: false };
  return null;
}

function formatMonthYear(monthValue, yearValue, fallbackText) {
  if (isPresent(fallbackText) || isPresent(yearValue)) return "Present";
  const parsed = parsePartialDate(monthValue, yearValue, fallbackText);
  if (!parsed) return text(fallbackText);
  if (parsed.present) return "Present";
  if (parsed.month) return `${monthName(parsed.month)} ${parsed.year}`;
  return String(parsed.year);
}

function durationMonths(start, end) {
  if (!start || !end || !start.year || !end.year) return null;
  const startMonth = start.month || 1;
  const endMonth = end.month || 12;
  const value = (end.year - start.year) * 12 + (endMonth - startMonth);
  return value < 0 ? null : value;
}

function formatDuration(months) {
  if (months == null) return "";
  if (months < 1) return "Less than 1 month";
  if (months === 1) return "1 month";
  return `${months} months`;
}

function visibleCareerGaps(resume) {
  return (Array.isArray(resume && resume.careerGaps) ? resume.careerGaps : [])
    .concat(Array.isArray(resume && resume.careerBreaks) ? resume.careerBreaks : [])
    .filter((gap) => gap && typeof gap === "object")
    .filter((gap) =>
      text(gap.type || gap.reason || gap.title)
      || text(gap.startDate || gap.startYear || gap.startMonth)
      || text(gap.endDate || gap.endYear || gap.endMonth)
      || text(gap.description)
      || stringList(gap.activities).length
      || stringList(gap.skills).length
      || stringList(gap.certifications).length
      || stringList(gap.projects).length
    );
}

function gapDateRange(gap) {
  const start = formatMonthYear(gap.startMonth, gap.startYear, gap.startDate);
  const end = gap.current
    ? "Present"
    : formatMonthYear(gap.endMonth, gap.endYear, gap.endDate);
  if (!start && !end) return "";
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

function careerGapCorpus(gap) {
  return [
    gap && (gap.type || gap.reason || gap.title),
    gap && gap.description,
    gapDateRange(gap),
    stringList(gap && gap.activities).join(" "),
    stringList(gap && gap.skills).join(" "),
    stringList(gap && gap.certifications).join(" "),
    stringList(gap && gap.projects).join(" "),
  ].map(text).filter(Boolean).join("\n");
}

function allCareerGapCorpus(resume) {
  return visibleCareerGaps(resume).map(careerGapCorpus).filter(Boolean).join("\n");
}

function parseGapBounds(gap) {
  const start = parsePartialDate(gap.startMonth, gap.startYear, gap.startDate);
  const end = gap.current
    ? parsePartialDate("", "", "Present", { present: true })
    : parsePartialDate(gap.endMonth, gap.endYear, gap.endDate);
  return { start, end, months: durationMonths(start, end) };
}

function parseJobBounds(job) {
  const start = parsePartialDate("", "", job.startDate);
  const end = job.current
    ? parsePartialDate("", "", "Present", { present: true })
    : parsePartialDate("", "", job.endDate || job.startDate);
  return { start, end, months: durationMonths(start, end) };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const a0 = toMonthNumber(aStart.year, aStart.month || 1);
  const a1 = toMonthNumber(aEnd.year, aEnd.month || 12);
  const b0 = toMonthNumber(bStart.year, bStart.month || 1);
  const b1 = toMonthNumber(bEnd.year, bEnd.month || 12);
  if ([a0, a1, b0, b1].some((n) => n == null)) return false;
  return a0 <= b1 && b0 <= a1;
}

function analyzeCareerTimeline(resume, { significantMonths = 3 } = {}) {
  const jobs = (Array.isArray(resume && resume.experience) ? resume.experience : [])
    .filter((job) => text(job && (job.role || job.company)))
    .map((job) => ({ job, ...parseJobBounds(job) }))
    .filter((row) => row.start && row.start.year);

  const parsedJobs = [...jobs].sort((a, b) => {
    const av = toMonthNumber(a.start.year, a.start.month || 1) || 0;
    const bv = toMonthNumber(b.start.year, b.start.month || 1) || 0;
    return av - bv;
  });

  const gaps = visibleCareerGaps(resume).map((gap) => ({ gap, ...parseGapBounds(gap) }));
  const explainedGaps = gaps.filter((row) => row.start && row.start.year);
  const parsedCount = parsedJobs.filter((row) => row.start && (row.end || row.job.current)).length;
  const dateConsistency = parsedJobs.length === 0
    ? "Not enough employment dates"
    : parsedCount === parsedJobs.length
      ? "Good"
      : "Needs review";

  const detected = [];
  for (let i = 0; i < parsedJobs.length - 1; i += 1) {
    const current = parsedJobs[i];
    const next = parsedJobs[i + 1];
    if (!current.end || !next.start) continue;
    const holeStart = {
      year: current.end.year,
      month: (current.end.month || 12) + 1,
    };
    if (holeStart.month > 12) {
      holeStart.month = 1;
      holeStart.year += 1;
    }
    const holeEnd = {
      year: next.start.year,
      month: (next.start.month || 1) - 1,
    };
    if (holeEnd.month < 1) {
      holeEnd.month = 12;
      holeEnd.year -= 1;
    }
    const months = durationMonths(holeStart, holeEnd);
    if (months == null || months < significantMonths) continue;
    const labelStart = `${monthName(current.end.month || 12)} ${current.end.year}`;
    const labelEnd = `${monthName(next.start.month || 1)} ${next.start.year}`;
    const explained = explainedGaps.some((entry) =>
      entry.end && rangesOverlap(entry.start, entry.end, holeStart, { ...holeEnd, month: holeEnd.month || 12 })
    );
    detected.push({
      months,
      from: labelStart,
      to: labelEnd,
      explained,
      status: explained ? "Clearly explained" : "Unexplained",
    });
  }

  const longest = detected.reduce((max, gap) => Math.max(max, gap.months), 0);
  const explainedCount = detected.filter((gap) => gap.explained).length;
  const unexplained = detected.filter((gap) => !gap.explained);
  const userProvided = explainedGaps.length > 0;
  const gapExplanation = detected.length === 0
    ? (userProvided ? "Provided" : "None detected")
    : unexplained.length === 0
      ? "Provided"
      : explainedCount
        ? "Partially provided"
        : "Not provided";

  const recommendations = [];
  for (const gap of unexplained) {
    recommendations.push(
      `Employment gap detected between ${gap.from} and ${gap.to}. Consider adding a brief Career Break entry if appropriate.`
    );
  }
  if (detected.length && unexplained.length === 0) {
    recommendations.push("Career gap is clearly represented. No action required.");
  }
  if (userProvided && detected.length === 0) {
    recommendations.push("Career gap is clearly represented. No action required.");
  }

  return {
    employmentGapsDetected: detected.length,
    longestGapMonths: longest,
    longestGap: longest ? formatDuration(longest) : "None",
    gapExplanation,
    dateConsistency,
    atsImpact: "No direct penalty",
    atsPenalty: 0,
    status: unexplained.length
      ? "Unexplained gap detected"
      : userProvided || detected.length
        ? "Clearly explained"
        : "No significant employment gap detected",
    recommendation: recommendations[0] || "No action required.",
    recommendations,
    gaps: detected,
    entries: visibleCareerGaps(resume).map((gap) => ({
      title: text(gap.type || gap.reason || gap.title) || "Career Break",
      dates: gapDateRange(gap),
      months: parseGapBounds(gap).months,
      explained: true,
    })),
  };
}

module.exports = {
  MONTHS,
  text,
  stringList,
  formatMonthYear,
  gapDateRange,
  visibleCareerGaps,
  careerGapCorpus,
  allCareerGapCorpus,
  analyzeCareerTimeline,
  parsePartialDate,
  durationMonths,
};
