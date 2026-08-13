import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Production дээр fallback байхгүй — хувьсагч дутуу бол сервер огт асахгүй.
 * Dev дээр л тохь тухын үүднээс тогтмол утга зөвшөөрнө.
 */
function secret(key: string, devFallback: string): string {
  const value = process.env[key];
  if (value) {
    if (isProd && value === devFallback) {
      throw new Error(`${key}: production дээр dev түлхүүрийг ашиглаж болохгүй`);
    }
    return value;
  }
  if (isProd) throw new Error(`Орчны хувьсагч дутуу байна: ${key}`);
  return devFallback;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  accessSecret: secret('JWT_ACCESS_SECRET', 'dev-access-secret-solino'),
  refreshSecret: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret-solino'),
  /** API болон web өөр домэйн дээр байвал 'none' (+ HTTPS) шаардлагатай. */
  cookieSameSite: (process.env.COOKIE_SAMESITE ?? 'lax') as 'lax' | 'strict' | 'none',
  isProd,
};
