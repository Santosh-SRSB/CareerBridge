export const authConfig = () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'careerbridge-access-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'careerbridge-refresh-secret',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  devOtp: process.env.AUTH_DEV_OTP === 'true',
});
