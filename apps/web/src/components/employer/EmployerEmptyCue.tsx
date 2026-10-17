import Image from 'next/image';

type Cue = 'search' | 'jobs' | 'calendar' | 'chart';

const EAGLE_SRC = '/mascots/srsb-eagle-final-cut.png';

/** Brand eagle cue for empty states (no logic). */
export function EmployerEmptyCue({ cue = 'search' }: { cue?: Cue }) {
  return (
    <div className={`ep-empty-cue ep-empty-cue--eagle${cue === 'chart' ? ' ep-empty-cue--lg' : ''}`} aria-hidden>
      <Image
        src={EAGLE_SRC}
        alt=""
        width={cue === 'chart' ? 140 : 110}
        height={cue === 'chart' ? 120 : 96}
        className="ep-empty-cue__eagle"
        unoptimized
      />
    </div>
  );
}
