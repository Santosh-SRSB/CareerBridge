'use client';

import Link from 'next/link';
import type { ProfileCompletion } from '@careerbridge/shared';

type Props = {
  completion: ProfileCompletion;
  hasResume: boolean;
};

export function HomeWhatToDoSection({ completion, hasResume }: Props) {
  const improve = completion.sections.filter((item) => !item.done).slice(0, 4);

  return (
    <section className="cb-home-section cb-home-section--what-to-do" aria-labelledby="home-what-to-do-title">
      <header className="cb-home-section__head">
        <div>
          <p className="cb-home-section__kicker">Next steps</p>
          <h2 id="home-what-to-do-title">What to do</h2>
        </div>
      </header>

      <ul className="cb-home-what-to-do-list">
        {improve.map((item) => (
          <li key={item.key}>
            <Link href={item.href} className="cb-home-what-to-do-item">
              <span>{item.label.startsWith('Add') ? item.label : `Add ${item.label.toLowerCase()}`}</span>
              <span className="cb-home-what-to-do-item__cta">Add</span>
            </Link>
          </li>
        ))}
        {!hasResume ? (
          <li>
            <Link href="/resume" className="cb-home-what-to-do-item">
              <span>Create your first resume</span>
              <span className="cb-home-what-to-do-item__cta">Start</span>
            </Link>
          </li>
        ) : null}
        {!improve.length && hasResume ? (
          <li className="cb-home-section__empty cb-home-section__empty--inset">
            Your passport is in good shape. Explore recommended jobs next.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
