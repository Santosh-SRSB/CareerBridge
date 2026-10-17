/**
 * Auth JWT configuration.
 * Access and refresh use separate secrets (JWT_ACCESS_SECRET / JWT_REFRESH_SECRET).
 * No hardcoded fallbacks — unset secrets fail at runtime via requireJwt* helpers.
 */
export const authConfig = () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || '',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '7d',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  devOtp: process.env.AUTH_DEV_OTP === 'true',
});
