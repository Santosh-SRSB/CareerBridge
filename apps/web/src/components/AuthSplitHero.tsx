'use client';

type Props = {
  mode?: 'signin' | 'register';
};

/** Left illustration panel — crisp HD art + light motion. */
export function AuthSplitHero({ mode = 'signin' }: Props) {
  const isRegister = mode === 'register';
  const phoneLabel = isRegister ? 'REGISTER' : 'LOGIN';

  return (
    <aside
      className={`cb-auth-hero is-illust${isRegister ? ' is-register' : ' is-login'}`}
      aria-hidden
    >
      <div className="cb-auth-hero__frame">
        <span className="cb-auth-hero__accent" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="cb-auth-hero__photo"
          src="/auth-illust-hd.png"
          alt=""
          decoding="async"
        />
        <span className="cb-auth-hero__float cb-auth-hero__float--a" />
        <span className="cb-auth-hero__float cb-auth-hero__float--b" />
        <span className="cb-auth-hero__float cb-auth-hero__float--c" />
        <span className="cb-auth-hero__phone-tag">{phoneLabel}</span>
      </div>
    </aside>
  );
}
