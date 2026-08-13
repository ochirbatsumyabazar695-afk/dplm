# Хуучин authentication (Clerk-ээс өмнөх)

Энэ хавтас нь Clerk рүү шилжихээс өмнөх, **өөрсдөө хэрэгжүүлсэн** нэвтрэлтийн
кодын хуулбар. Ажиллах кодын хэсэг БИШ — build-д ороогүй, зөвхөн лавлагаа.

Дипломын тайланд "эхний хувилбарыг өөрөө хэрэгжүүлж, дараа нь Clerk рүү
шилжсэн" гэсэн хэсгийг бичихэд эх сурвалж болно.

## Юу байсан бэ

| Файл | Агуулга |
|---|---|
| `api/lib/jwt.ts` | Access (15 мин) / refresh (30 хоног) токен, httpOnly cookie |
| `api/routes/auth.ts` | register · login · refresh · logout · me |
| `api/middleware/auth.ts` | `requireAuth`, `optionalAuth`, `requireRole`, `requireStaff` |
| `api/env.ts` | JWT түлхүүрийн шалгалт (production дээр dev утга хориглох) |
| `api/schema.prisma` | `passwordHash`, `tokenVersion` бүхий User модель |
| `web/lib/api.ts` | Access token хадгалалт, 401 дээр автомат refresh |
| `web/store/auth.ts` | Zustand дээрх сесс, `bootstrap()` |
| `web/pages/Auth.tsx`, `DashboardLogin.tsx` | Нэвтрэх/бүртгүүлэх маягтууд |

## Гол шийдлүүд

- **Access + refresh хуваалт.** Access token богино насалж (15 мин) XSS-ийн
  цонхыг багасгана; refresh нь httpOnly cookie дотор тул JS-ээс уншигдахгүй.
- **`tokenVersion`-оор хүчингүй болгох.** JWT нь төлөвгүй тул гарах үед
  DB дэх `tokenVersion` ахиулж, хуучин бүх refresh token-ыг таслана.
- **Токенд `tenantId` суулгасан.** Ажилтны хүсэлтийн ресторан клиентээс
  ирэхгүй, токеноос уншигдана (`tenantFromAuth`) — нэг ресторан нөгөөгийнх рүү
  хандах боломжгүй.
- **bcrypt 10 rounds**, нэвтрэх оролдлогод rate limit (15 мин / 20 удаа).

## Яагаад Clerk рүү шилжсэн бэ

Тайландаа бөглөнө үү. Дурдах боломжтой цэгүүд: нууц үг сэргээх урсгал,
и-мэйл баталгаажуулалт, MFA, social login зэргийг өөрөө хэрэгжүүлэх зардал;
эдгээр нь энэ ажлын гол сэдэв (multi-tenant архитектур) биш.
