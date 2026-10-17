export const whatsappConfig = () => ({
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  appSecret: process.env.WHATSAPP_APP_SECRET || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  displayPhone: process.env.WHATSAPP_DISPLAY_PHONE || '',
  apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  requireSignature: process.env.WHATSAPP_REQUIRE_SIGNATURE === 'true',
  requireOptIn: process.env.WHATSAPP_REQUIRE_OPT_IN === 'true',
  useTemplates: process.env.WHATSAPP_USE_TEMPLATES === 'true',
  templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en',
});
