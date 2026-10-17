import Image from "next/image";

const POSES = {
  fly: "/mascots/srsb-eagle-cut.png",
  stand: "/mascots/srsb-eagle-cut.png",
  arrow: "/mascots/srsb-eagle-cut.png",
  fetch: "/mascots/srsb-eagle-cut.png",
  point: "/mascots/srsb-eagle-final-cut.png",
} as const;

export function EagleMascot({
  pose = "stand",
  className = "",
}: {
  pose?: keyof typeof POSES;
  className?: string;
}) {
  return (
    <div className={`eagle eagle-${pose} ${className}`.trim()} aria-hidden="true">
      <Image
        src={POSES[pose]}
        alt=""
        width={pose === "point" ? 383 : 640}
        height={pose === "point" ? 508 : 640}
        className="eagle-photo"
        priority
      />
    </div>
  );
}
