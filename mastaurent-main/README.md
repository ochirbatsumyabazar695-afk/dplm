# Masteurent

Хоолны хүргэлтийн multi-tenant SaaS платформ.
Ресторан бүрт өөрийн онлайн дэлгүүр, цэс, захиалгын систем өгнө —
нэг codebase, олон ресторан, тус бүр өөрийн хаяг, брэнд өнгө, өгөгдөлтэй.

**Дизайн:** Swiss editorial — цаасан суурь, зураасан бүтэц, Helvetica Neue (кирилл
үсэг Inter-ээр), эможигүй. Бүх шилжилт, илрэл Framer Motion-оор жолоодогдоно.

## Технологи

| Талбар | Технологи |
|---|---|
| Front-end | React 18 · TypeScript · Vite · Tailwind CSS v4 · Framer Motion · TanStack Query |
| Back-end | Node.js · Express · TypeScript · Prisma ORM · Zod |
| Өгөгдлийн сан | MySQL 8 |
| Нэвтрэлт | И-мэйл + нууц үг (JWT) · Clerk (нэмэлт) |
| Төлбөр | QPay (үндсэн) · Stripe Checkout (нөөц) |
| Эрхийн хяналт | Гишүүнчлэлд суурилсан RBAC — өөрийн DB дээр |

## Эхлүүлэх

### 1. Шаардлага
- Node.js 20+
- MySQL 8 ажиллаж байх (порт 3306)
- Clerk-ийн үнэгүй данс — [dashboard.clerk.com](https://dashboard.clerk.com)

### 2. Тохиргоо

**MySQL.** `apps/api/.env` файлын `DATABASE_URL`-д өөрийн нууц үгээ тавина:

```
DATABASE_URL="mysql://root:ТАНЫ_НУУЦ_ҮГ@localhost:3306/hool_saas"
```

> `hool_saas` санг гараар үүсгэх шаардлагагүй — Prisma автоматаар үүсгэнэ.

**Clerk.** Dashboard → *API Keys* хэсгээс хоёр түлхүүрийг хуулж:

`apps/api/.env`
```
CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

`apps/web/.env`
```
VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
```

`pk_...` нь **хоёуланд ижил**, `sk_...` нь **зөвхөн api**-д. Тавьсны дараа
шалгана:

```bash
npm run clerk:check
```

Энэ нь түлхүүрийн хэлбэр, хоёр талын таарц, горим (test/live) болон нууц
түлхүүр Clerk дээр ажиллаж байгаа эсэхийг **бодитоор** шалгаж хэлнэ.

> Түлхүүр дутуу бол апп ажилласаар — зөвхөн нэвтрэлтийн хэсэг тохиргооны
> заавар үзүүлнэ. Бэлэн мөнгөний захиалга, цэс, сагс бүгд хэвийн.

### 3. Суулгах, өгөгдөл дүүргэх, ажиллуулах

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

- Вэб → http://localhost:5173
- API → http://localhost:4000/api

## Демо бүртгэлүүд

Нууц үг бүгд: `123456`

| Үүрэг | И-мэйл | Хаана |
|---|---|---|
| Хүслэн Бууз — монгол хоол | `huslen@hool.mn` | `/dashboard/login` |
| Sakura Sushi — суши | `sakura@hool.mn` | `/dashboard/login` |
| Modun Burger — бургер | `modun@hool.mn` | `/dashboard/login` |
| Napoli Pizza — итали | `napoli@hool.mn` | `/dashboard/login` |
| Seoul Kitchen — солонгос | `seoul@hool.mn` | `/dashboard/login` |
| Green Bean — кофе, амттан | `greenbean@hool.mn` | `/dashboard/login` |
| Харилцагч | `hereglegch@hool.mn` | `/login` |
| Платформын админ | `admin@hool.mn` | `/admin/requests` |

Clerk тохируулсан бол дээрх **ижил и-мэйлээр** Clerk-д бүртгүүлэхэд тэр
мөрөнд холбогдож, эрх нь хэвээр хадгалагдана.

## Хуудсууд

**Нийтийн**
- `/` — платформын нүүр. Ресторануудын жагсаалт нь ЗӨВХӨН нэвтэрсэн
  хэрэглэгчид харагдана
- `/register` · `/login` — платформын бүртгэл (ресторанаас хамааралгүй)

**Storefront** (`/t/:slug`)
- `/` нүүр · `/menu` цэс · `/item/:id` хоолны дэлгэрэнгүй
- `/checkout` захиалга · `/pay/:paymentId` төлбөр · `/order/:token` захиалга хянах
- `/orders` миний захиалга · `/profile`

**Удирдлагын самбар** (`/dashboard`) — RESTAURANT_ADMIN
- `/orders` захиалгын самбар + статистик
- `/menu` цэс удирдах (ангилал, хоол нэмэх/засах/устгах)
- `/tables` ширээ бүртгэх, багтаамж, төлөв
- `/reservations` ширээ захиалга хянах, зөвшөөрөх, ширээ хуваарилах
- `/settings` рестораны тохиргоо, брэнд өнгө

**Storefront-д нэмэлт**
- `/t/:slug/reserve` — харилцагч ширээ захиална

**Платформын админ**
- `/restaurant-request` — хэрэглэгч хүсэлт илгээж, төлөвөө хянана
- `/admin/requests` — хүсэлт зөвшөөрөх/татгалзах
- `/admin/tenants` — бүх ресторан, идэвхжүүлэх/идэвхгүй болгох
- `/admin/accounts` — бүх хэрэглэгч, аль ресторанд ямар эрхтэй

## Эрхийн систем

Гурван түвшин. Платформын эрх нь рестораны эрхээс **тусдаа**.

| Түвшин | Хаана хадгалагдана | Юу хийнэ |
|---|---|---|
| `USER` | `Account` (гишүүнчлэлгүй) | Ресторан үзэх, захиалах, ширээ захиалах, ресторан нээх хүсэлт илгээх |
| `USER` | `User.role = USER` | Захиалга, ширээ захиалга, профайл, ресторан нээх хүсэлт |
| `DRIVER` | `User.role = DRIVER` | Зөвхөн өөрт оноогдсон хүргэлт, хүргэлтийн төлөв |
| `KITCHEN` | `User.role = KITCHEN` | Зөвхөн хоол бэлтгэх захиалга, CONFIRMED/PREPARING/READY төлөв |
| `CASHIER` | `User.role = CASHIER` | Захиалга хүлээн авах, төлөв болон төлбөр хянах |
| `MANAGER` | `User.role = MANAGER` | Өдөр тутмын order, reservation, table, menu, driver assignment |
| `DIRECTOR` | `User.role = DIRECTOR` | Рестораны бүх тохиргоо, staff болон статистик |
| `ADMIN` | `Account.isPlatformAdmin` | Хүсэлт хянах, бүх ресторан/хэрэглэгч, ресторан идэвхгүй болгох |

**Хамгаалалт нь frontend дээр товч нуух биш, backend дээр байна.** Ажилтны
хүсэлт бүрд `requireStaff` нь `tenantId`-г DB дэх гишүүнчлэлээс тогтоож,
дараагийн бүх query `where: { tenantId }`-тэй явна. Тиймээс User A нь
Restaurant B-ийн цэс, ширээ, захиалга, статистикт хандах боломжгүй —
оролдвол 404/403 буцна.

## Хүргэлт ба өөрөө авах

Ресторан бүр хүргэлт хийх албагүй. Тохиргоонд **Хүргэлттэй / Өөрөө авах**
хоёрыг тус тусад нь асаах, унтраах боломжтой.

```
deliveryEnabled = false
      ↓
storefront:  «Энэ ресторан хүргэлтийн үйлчилгээ үзүүлдэггүй»
checkout:    хаягийн талбар, хүргэлтийн төлбөр харагдахгүй
API:         type=DELIVERY захиалга 400 буцаана
```

**Backend дээр ч шалгана.** Хүргэлтгүй ресторанд API-аар шууд
`type: "DELIVERY"` илгээвэл 400 «Энэ ресторан хүргэлтийн үйлчилгээ
үзүүлдэггүй» гэж буцна — frontend товч нуухаас хамаарахгүй.

Захиалгын төлвийн урсгал ч хэлбэрээсээ хамаарна:

| Хэлбэр | Урсгал |
|---|---|
| DELIVERY | PENDING → CONFIRMED → PREPARING → **DELIVERING** → COMPLETED |
| PICKUP | PENDING → CONFIRMED → PREPARING → **READY** → COMPLETED |

Очиж авах захиалгад хүргэлтийн төлбөр 0, хаяг хадгалагдахгүй.

## Ширээ ба ширээ захиалга

```
харилцагч /t/:slug/reserve дээр захиална   → PENDING
      ↓
ресторан /dashboard/reservations дээр хянана
      ↓                    ↓
  Зөвшөөрөх            Татгалзах
  (ширээ хуваарилна)       ↓
      ↓                 REJECTED
  CONFIRMED → SEATED → COMPLETED
```

Сервер шалгадаг зүйлс: өнгөрсөн өдөр рүү захиалахгүй; сонгосон ширээ **энэ
рестораных** мөн эсэх; ширээний багтаамж хүний тоонд хүрэх эсэх; төлвийн
шилжилт зөвшөөрөгдсөн дараалалтай эсэх.

## Ресторан нээх урсгал

Хэрэглэгч платформд бүртгүүлсний дараа өөрийн ресторан нээх хүсэлт
илгээж болно. Платформын админ хянаж зөвшөөрснөөр ресторан үүсч,
хүсэлт гаргагч нь тухайн рестораны эзэн болно.

```
хэрэглэгч бүртгүүлнэ
      ↓
POST /api/restaurant-requests   { name, slug, ... }   → PENDING
      ↓
платформын админ /admin/requests дээр хянана
      ↓                              ↓
   зөвшөөрөх                      татгалзах
      ↓                              ↓
Tenant үүснэ                   REJECTED + шалтгаан
User(role=DIRECTOR) үүснэ
      ↓
хүсэлт гаргагч /dashboard руу бүрэн эрхтэй орно
```

**Платформын админ нь рестораны эрхээс тусдаа** — `Account.isPlatformAdmin`.
Рестораны эзэн байх нь платформын админ болгодоггүй, эсрэгээрээ ч мөн адил.

Хамгаалалт: нэг дансанд нэг хүлээгдэж буй хүсэлт; хаяг (slug) нь одоо байгаа
ресторан болон хүлээгдэж буй хүсэлтүүдээс давхардахгүй; зөвшөөрөх үед хаягийг
**дахин шалгана** (хүсэлт илгээснээс хойш эзэлэгдсэн байж болно); ресторан
үүсгэх, эзэн томилох, хүсэлтийг хаах гурвуулаа нэг transaction дотор.

## Multi-tenancy хэрхэн ажилладаг вэ

- Бүх хүснэгтэд `tenant_id` талбар байна (shared database, shared schema).
- Storefront-ийн хүсэлт бүр `X-Tenant: <slug>` толгойгоор ирнэ →
  `resolveTenant` middleware `tenantId`-г тогтооно.
- Ажилтны хүсэлтийн ресторан нь **DB дэх гишүүнчлэлээс** тодорхойлогдоно
  (`requireStaff`) — клиентээс ирсэн slug/header-т хэзээ ч итгэхгүй.
- Бүх query/update `where: { tenantId }`-тэй — нэг ресторан нөгөөгийнхөө
  өгөгдөлд хандах боломжгүй.

### Данс ба гишүүнчлэл

Нэвтрэлт нь **платформын хэмжээнд** — `accounts` хүснэгтэд нэг хүн = нэг мөр.
Ресторан бүр дэх профайл, эрх нь `users` хүснэгтэд тусдаа мөр буюу
"гишүүнчлэл" (`@@unique([tenantId, accountId])`).

```
accounts (нэг удаа бүртгүүлнэ)
   └── users (ресторан бүрт нэг мөр: эрх, профайл, захиалгын түүх)
```

Нэг хүн Хүслэн Бууз дээр харилцагч, Sakura дээр менежер байж чадна.
Ресторанд анх хандахад гишүүнчлэл нь автоматаар үүснэ; харилцагчийн
мэдээлэл, түүх нь тухайн ресторандаа үлдэнэ.

Токенд зөвхөн `accountId` байна — эрх, ресторан нь хүсэлт бүрд DB-ээс
уншигдана. Ингэснээр claim хоцрогдож буруу ресторанд хандах эрсдэлгүй.

## Role тус бүрийн самбар

- `/user/*`-ийн хэрэглэгчийн ажиллагаа storefront-ийн `/t/:slug/*` дотор байна.
- USER нь Profile хэсгээс `/restaurant-request` руу орж ресторан шууд үүсгэнэ.
  Үүсгэсэн USER тухайн рестораны DIRECTOR болно; ADMIN approve шаардахгүй.
- `/driver/*` — өөрт оноогдсон болон авах боломжтой хүргэлт.
- `/kitchen/*` — хоолны жагсаалт, бэлтгэлийн төлөв; үнэ, орлого, хаяг харахгүй.
- `/cashier/*` — захиалга хүлээн авах, төлөв болон төлбөр хянах.
- `/manager/*` — өдөр тутмын захиалга, цэс, ширээ, reservation, driver assignment.
- `/director/*` — manager-ийн боломжууд дээр staff болон restaurant settings нэмэгдэнэ.
- `/admin/*` — системийн хүсэлт, restaurant, account, statistics.

Frontend route guard-аас гадна API бүр `requireAccount`, `requireStaff`,
`requireRole` болон DB-ээс тогтоосон `tenantId`-аар хамгаалагдана. DIRECTOR нь
бүртгэлтэй хэрэглэгчийг MANAGER/KITCHEN/DRIVER болгон нэмэх, role солих,
идэвхгүй болгох боломжтой. ADMIN нь хэрэглэгч block хийх боломжтой.

Хүргэлтийн төлөв:

```
READY_FOR_DELIVERY → PICKED_UP → ON_THE_WAY → DELIVERED
```

Хүргэлтгүй ресторан DRIVER queue үүсгэхгүй. PICKUP захиалга driver API-д
хэзээ ч орохгүй.

**Ресторануудын жагсаалт нэвтрэлт шаарддаг** (`GET /api/tenants`).
Нүүр хуудсанд бүртгүүлэх/нэвтрэхээс өмнө ресторан харагдахгүй.

## Онлайн төлбөр

Үндсэн хэрэгсэл нь **QPay** — Монгол хэрэглэгч банкны аппаараа QR уншуулж
төлнө. **Stripe Checkout** нь нөөц сонголт.

```
Хэрэглэгч захиалга үүсгэнэ
      ↓
POST /api/payments/create  { orderId, provider }
      ↓
QPay: нэхэмжлэх + QR        Stripe: Checkout session
      ↓                            ↓
/t/:slug/pay/:id дээр QR    Stripe-ийн хуудас руу шилжинэ
      ↓                            ↓
банкны аппаар төлнө          картаар төлнө
      ↓                            ↓
QPay payment/check API      Stripe webhook (гарын үсэг шалгана)
      ↓                            ↓
        payment.status = PAID → order.isPaid = true
```

**Дүнг клиентээс хэзээ ч авахгүй** — `createPayment` захиалгын `total`-ыг
DB-ээс уншина. Биед `amount` явуулсан ч үл тоомсорлоно.

**"Төлсөн" гэдэгт зөвхөн provider-ийн үгээр итгэнэ.** QPay-гийн callback нь
зөвхөн "шалгаарай" гэсэн дохио — сервер нь `payment/check` API-аар дахин
баталгаажуулна. Stripe webhook нь гарын үсгээр шалгагдана; гарын үсэггүй
эсвэл буруу бол 400.

**Идемпотент.** `markPaid` нь давхар дуудагдсан ч захиалгыг нэг л удаа
төлөгдсөн болгож, анхны гүйлгээний дугаарыг хадгална.

Тохиргоо дутуу бол нэвтрэлттэй адил — апп ажилласаар, зөвхөн онлайн
төлбөрийн зам 503 буцаана. Бэлэн мөнгөний захиалга үргэлж ажиллана.

> **Production-д анхаарах:** Stripe-ийн merchant данс Монголд албан ёсоор
> дэмжигдээгүй тул энэ нь демо/test mode-д зориулагдсан.

### QPay callback-ийг локал дээр авах — Cloudflare Tunnel

QPay-гийн сервер `localhost` руу хандаж чадахгүй тул callback авахад
нийтэд нээлттэй хаяг хэрэгтэй. Cloudflare Tunnel үүнийг үнэгүй, данс
шаардалгүй шийднэ.

```bash
npm run tunnel
```

Гарч ирэх `https://<санамсаргүй>.trycloudflare.com` хаягийг
`apps/api/.env` доторх `PUBLIC_API_URL`-д тавиад **API-гаа дахин асаана**
(`.env` нь халуун ачаалагддаггүй).

```
QPay сервер  →  trycloudflare.com  →  таны localhost:4000
                                        /api/payments/qpay/callback
```

Анхаарах хоёр зүйл:

- **Хаяг ажиллуулах бүрд өөрчлөгдөнө.** Tunnel-ээ дахин асаавал
  `PUBLIC_API_URL`-ээ шинэчилж, API-гаа дахин асаах хэрэгтэй.
- **Tunnel ажиллаж байх зуур API тань интернэтэд нээлттэй.** Хамгаалагдсан
  зам бүр нэвтрэлт шаардсан хэвээр ч, ажил дуусмагц tunnel-ээ хаа.

Callback байхгүй ч төлбөр илэрнэ — төлбөрийн хуудас 4 секунд тутам
`GET /api/payments/:id` дуудаж, сервер нь QPay-гийн `payment/check`-ээр
шалгадаг. Tunnel нь баталгаажуулалтыг шуурхай болгодог сайжруулалт.

Суулгах (нэг удаа):

```bash
winget install --id Cloudflare.cloudflared -e
```

## Аюулгүй байдлын зарчим

- Захиалгын үнийг **зөвхөн сервер** тооцоолно; клиентээс ирсэн дүнд итгэхгүй.
  Сонголт бүр ЯГ тухайн хоолны бүлэгт харьяалагдах ёстой, `required` ба
  `maxSelect` дүрмийг сервер шалгана.
- Захиалга хянах холбоос нь **таамаглах боломжгүй `trackToken`**-оор ажиллана.
  Дараалсан `orderNo`-оор хандах боломжгүй — эс бөгөөс бүх харилцагчийн
  нэр, утас, хаягийг дарааллаар нь уншиж болно.
- Захиалгын дугаарыг tenant тус бүрийн атом тоолуураар өгнө — зэрэг ирсэн
  захиалгууд ижил дугаар авахгүй.
- **Нэвтрэлтийн хоёр зам зэрэг ажиллана.** И-мэйл + нууц үг (өөрийн JWT) нь
  үргэлж боломжтой; Clerk нь түлхүүр тохируулагдсан үед нэмэлт сонголт болно.
  Backend хоёуланг нь хүлээж авдаг — эхлээд өөрийн токеныг уншиж үзээд,
  таарахгүй бол Clerk-ийн сессийг шалгана.
- **Нууц үг bcrypt (10 rounds).** Access token 15 мин, refresh token
  httpOnly cookie дотор 30 хоног. Гарах үед `tokenVersion` ахиж, хуучин бүх
  токен тэр даруй хүчингүй болно.
- **Эрх, tenant-ыг токены claim-ээс уншихгүй.** Токен зөвхөн "хэн бэ"
  гэдгийг хэлнэ; "аль рестораны хэн бэ" гэдгийг хүсэлт бүрд DB-ээс уншина.
  Claim хоцрогдож буруу ресторанд хандах эрсдэлийг ингэж хаасан.
- Нэвтрэх (15 мин / 20 удаа), захиалга (1 мин / 10) болон бүх API (1 мин / 300)
  дээр rate limit. Helmet-ээр аюулгүйн толгойнууд.
- Production дээр JWT түлхүүр дутуу эсвэл dev утгатай ижил бол **сервер
  асахаас татгалзана**. Clerk-ийн түлхүүр дутуу бол зөвхөн Clerk-ийн зам
  идэвхгүй болно — нууц үгээр нэвтрэх хэвээр ажиллана.
- Захиалгын төлөв зөвхөн зөвшөөрөгдсөн дарааллаар шилжинэ
  (цуцлагдсан захиалгыг буцаах боломжгүй).
- Мөнгийг `INT` (төгрөг)-өөр хадгална — float дугуйруулалтын алдаагүй.

## Скриптүүд

```bash
npm run dev        # API + Web зэрэг
npm run dev:clean  # портуудыг чөлөөлөөд дараа нь dev (EADDRINUSE гарвал)
npm run ports:free # зөвхөн үлдэгдэл процессуудыг зогсоох
npm run dev:api    # зөвхөн API
npm run dev:web    # зөвхөн Web
npm test           # үнэ тооцоолол, төлвийн шилжилтийн тест
npm run clerk:check # Clerk-ийн түлхүүр зөв эсэхийг шалгах
npm run tunnel     # QPay callback-д зориулсан нийтийн HTTPS хаяг
npm run db:push    # schema -> MySQL
npm run db:seed    # демо өгөгдөл
npm run db:studio  # Prisma Studio
npm run build      # production build
```

## `_legacy-auth/`

Clerk-ээс өмнөх, өөрсдөө хэрэгжүүлсэн нэвтрэлтийн код (JWT access/refresh,
`tokenVersion`-оор хүчингүй болгох, bcrypt). Build-д ороогүй — тайланд
"эхний хувилбар" гэж дурдахад зориулсан лавлагаа.

## Дараагийн үе шат

## ZoogNet MVP realtime нэмэлт

- Driver online/offline privacy toggle; offline үед координат хадгалахгүй.
- Идэвхтэй хүргэлтийн GPS ping Socket.io `order:<id>` room-оор хэрэглэгчид шууд хүрнэ.
- Tracking дэлгэц realtime status/location, OpenStreetMap холбоос болон 5 секундийн polling fallback-тай.
- Жолоочийн байршлын түүх 7 хоногийн retention-тэй.
- Restaurant latitude/longitude, delivery radius болон "түр хаах" тохиргоог backend шалгана.
- Checkout browser geolocation-оор хүргэх цэг авна; радиусаас гадуур бол order үүсэхгүй.
- Хадгалсан хаяг болон нэг completed order-д нэг review хийх API нэмэгдсэн.
- USER зөвхөн PENDING захиалгаа цуцална; ресторан reason-тэй REJECTED болгоно.
- Order status timestamps, driver pickup/delivered timestamps хадгалагдана.
- Sold-out шалгалт Serializable transaction дотор давтагдаж concurrency race-ээс хамгаална.
- QPay/Stripe paid transition conditional update ашиглаж webhook/poll давхцахад идемпотент.

Гаднын үйлчилгээний credential/infrastructure шаарддаг тул FCM push, SMS OTP,
RabbitMQ retry queue, Cloudflare R2 signed upload нь adapter-ийн дараагийн deployment
ажил хэвээр. Одоогийн email/password + Clerk, URL зураг, Socket.io single-node
горим локал MVP-д ажиллана; олон instance deployment дээр Redis adapter нэмнэ.

- [x] QPay нэхэмжлэх + QR, Stripe Checkout + webhook
- [x] Socket.io realtime driver location + privacy toggle
- [x] Delivery radius, map coordinate, saved-address API
- [x] Review API, cancellation/rejection, order timestamps
- [ ] QPay и-баримт (ebarimt_v3)
- [ ] Төлбөр буцаах (refund) урсгал
- [ ] Socket.io real-time захиалга
- [ ] Жолоочийн интерфэйс
- [ ] Platform admin самбар
- [ ] Зураг upload (одоо URL-аар)
