import Image from "next/image";

type PassportCard = {
  variant: "back" | "mid" | "front";
  name: string;
  meta: string;
  photo?: string;
  initials: string;
  note?: string;
  chips?: string[];
};

const CARDS: PassportCard[] = [
  {
    variant: "back",
    name: "Ananya Rao",
    meta: "Bengaluru · Fresher",
    photo: "/landing/candidate-student.webp",
    initials: "AR",
  },
  {
    variant: "mid",
    name: "Arjun Mehta",
    meta: "Pune · Data Analyst",
    initials: "AM",
  },
  {
    variant: "front",
    name: "Priya Sharma",
    meta: "Chennai · Customer Service",
    photo: "/landing/candidate-graduate.webp",
    initials: "PS",
    note: "Profile rising to a stronger match.",
    chips: ["Communication", "MS Excel"],
  },
];

/** Decorative Career Passport illustration for the hero; not real candidate data. */
export function HeroPassportCards() {
  return (
    <div className="hl-passports" aria-hidden="true">
      {CARDS.map((card) => (
        <div key={card.variant} className={`hl-passport hl-passport--${card.variant}`}>
          <div className="hl-passport__photo">
            {card.photo ? (
              <Image src={card.photo} alt="" width={330} height={424} />
            ) : (
              <span className="hl-passport__initials">{card.initials}</span>
            )}
          </div>
          <div className="hl-passport__info">
            <div className="hl-passport__top">
              Career Passport<span className="hl-passport__tag">FREE</span>
            </div>
            <p className="hl-passport__name">{card.name}</p>
            <p className="hl-passport__meta">{card.meta}</p>
            {card.note ? <p className="hl-passport__note">{card.note}</p> : null}
            {card.chips ? (
              <div className="hl-passport__chips">
                {card.chips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            ) : null}
            <div className="hl-passport__scores">
              <div>
                Resume<b>0</b>
              </div>
              <div>
                Interview<b>0</b>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
