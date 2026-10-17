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
    <div className="skill-marquee overflow-hidden py-3">
      <div className="marquee-track flex w-max gap-10 pr-10">
        {loop.map((skill, index) => (
          <span
            key={`${skill}-${index}`}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-navy/70"
          >
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}
