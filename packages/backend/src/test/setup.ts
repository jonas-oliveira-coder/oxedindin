import 'dotenv/config';

// Match production behavior: database money columns are BigInt, and
// JSON.stringify cannot serialize them by default.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://oxedindin:oxedindin@localhost:5432/oxedindin_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-min-32-chars-long';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-chars';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test-cookie-secret-min-32-chars-long';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
process.env.WEB_AUTHN_RP_ID = process.env.WEB_AUTHN_RP_ID || 'localhost';
process.env.WEB_AUTHN_RP_NAME = process.env.WEB_AUTHN_RP_NAME || 'OxeDinDin';
process.env.WEB_AUTHN_ORIGIN = process.env.WEB_AUTHN_ORIGIN || 'http://localhost:5173';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.API_URL = process.env.API_URL || 'http://localhost:3000';