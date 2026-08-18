const skills = [
  "Customer Service",
  "Communication",
  "Retail",
  "MS Excel",
  "Hospitality",
  "Sales",
  "POS",
  "Front Office",
  "Logistics",
  "Complaint Handling",
];

export function SkillMarquee() {
  const loop = [...skills, ...skills];

  return (
    <div className="overflow-hidden border-y border-white/10 bg-navy-deep py-3">
      <div className="marquee-track flex w-max gap-8 pr-8">
        {loop.map((skill, index) => (
          <span
            key={`${skill}-${index}`}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55"
          >
            {skill}
            <span className="ml-8 text-orange">●</span>
          </span>
        ))}
      </div>
    </div>
  );
}
