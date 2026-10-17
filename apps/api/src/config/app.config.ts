export const appConfig = () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  environment: process.env.NODE_ENV || 'development',
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:3000',
});
