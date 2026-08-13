import { env } from '../env.js';

export interface VerifySessionResponse {
  sessionId: string;
  phone: string;
  shortcode: string;
  text: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
}

export interface VerifySessionStatusResponse {
  sessionId: string;
  phone: string;
  sessionStatus: 'PENDING' | 'VERIFIED' | 'EXPIRED';
  callbackStatus?: 'PENDING' | 'SENT' | 'FAILED';
  verifiedAt?: string;
  expiresAt?: string;
}

// In-memory store for session verification status (updated by webhook or polling)
const verifiedSessions = new Set<string>();

export function markSessionVerifiedLocally(sessionId: string) {
  verifiedSessions.add(sessionId);
}

/**
 * Step 1: Create a Verify.MN Session (POST https://api.verify.mn/sessions)
 */
export async function createVerifySession(
  phone: string,
  customText?: string,
  callbackUrl?: string,
): Promise<VerifySessionResponse> {
  if (!env.verifyMnApiKey && env.isProd) {
    throw new Error('VERIFY_MN_API_KEY орчны хувьсагч дутуу байна.');
  }

  const cleanPhone = phone.trim().replace(/^\+976/, '');
  // Generate a random 6-digit numeric code per session
  const randomText = customText || Math.floor(100000 + Math.random() * 900000).toString();
  const webhookCallback = callbackUrl || `${env.publicApiUrl}/api/auth/verify-mn/callback`;

  try {
    const response = await fetch('https://api.verify.mn/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.verifyMnApiKey}`,
      },
      body: JSON.stringify({
        phone: cleanPhone,
        text: randomText,
        callback: webhookCallback,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as VerifySessionResponse;
      return data;
    } else {
      const errText = await response.text();
      console.error(`[Verify.MN] POST /sessions failed (${response.status}):`, errText);
    }
  } catch (err) {
    console.warn('[Verify.MN] Live API call warning, fallback to mock MO session:', err);
  }

  // Development Fallback MO Session
  return {
    sessionId: `vm_${cleanPhone}_${Date.now()}`,
    phone: cleanPhone,
    shortcode: '144773',
    text: randomText,
    smsUri: `sms:144773?body=${randomText}`,
    displayInstruction: `Та өөрийн ${cleanPhone} дугаараас 144773 дугаарт "${randomText}" гэж SMS илгээнэ үү`,
    expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
  };
}

/**
 * Step 2: Check Session Status (GET https://api.verify.mn/sessions/{sessionId})
 * 
 * Note: sessionStatus is "VERIFIED" when user has sent the SMS to 144773.
 */
export async function checkSessionStatus(
  sessionId: string,
  userEnteredCode?: string,
): Promise<{ verified: boolean; sessionStatus: string; phone?: string }> {
  // Локал хөгжүүлэлтэд л тест код зөвшөөрнө. Production-д бодит provider
  // баталгаажуулалтгүйгээр login/reset хийх боломж огт байх ёсгүй.
  if (!env.isProd && (userEnteredCode === '1234' || userEnteredCode === '123456')) {
    return { verified: true, sessionStatus: 'VERIFIED' };
  }

  // Check if webhook already marked it verified
  if (verifiedSessions.has(sessionId)) {
    return { verified: true, sessionStatus: 'VERIFIED' };
  }

  try {
    const response = await fetch(`https://api.verify.mn/sessions/${sessionId}`, {
      method: 'GET',
    });

    if (response.ok) {
      const data = (await response.json()) as VerifySessionStatusResponse;
      const isVerified = data.sessionStatus === 'VERIFIED';
      if (isVerified) {
        verifiedSessions.add(sessionId);
      }
      return {
        verified: isVerified,
        sessionStatus: data.sessionStatus,
        phone: data.phone,
      };
    } else {
      console.warn(`[Verify.MN] GET /sessions/${sessionId} returned ${response.status}`);
    }
  } catch (err) {
    console.warn('[Verify.MN] Status check error:', err);
  }

  return { verified: false, sessionStatus: 'UNKNOWN' };
}
