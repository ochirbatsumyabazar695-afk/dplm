// Бие даасан скрипт тул .env-ээ өөрөө ачаална.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient, type OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();
const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

/**
 * Рестораны монограм лого — брэнд өнгөтэй SVG.
 *
 * Гадны файл, CDN шаардахгүйгээр өгөгдлийн санд шууд хадгалагдана.
 * Вектор тул ямар ч хэмжээнд тод; эможи ашиглаагүй, Swiss editorial
 * харагдацтай нийцнэ.
 */
const logo = (initials: string, color: string) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" rx="24" fill="${color}"/>` +
    `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="34" ` +
    `font-weight="600" letter-spacing="1.5" fill="#FAF9F6">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
};

type SeedItem = {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  popular?: boolean;
  calories?: number;
  prep?: number;
  tags?: string;
  groups?: { name: string; required?: boolean; maxSelect?: number; options: [string, number][] }[];
};

type SeedTenant = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  accentColor: string;
  logoUrl: string;
  coverUrl: string;
  phone: string;
  address: string;
  deliveryFee: number;
  minOrder: number;
  etaMinutes: number;
  rating: number;
  category?: string;
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  owner: { name: string; email: string };
  categories: { name: string; items: SeedItem[] }[];
};

const tenants: SeedTenant[] = [
  {
    slug: 'latelier-paris',
    name: "L'Atelier de Paris",
    tagline: 'Haute Gastronomie Française',
    description:
      'Мишлин 3 одот тогооч нарын бэлтгэсэн Францын классик дээд зэглэлийн кулинари урлаг, трюффель ба фуа-гра зоог.',
    accentColor: '#1C1917',
    logoUrl: logo('LAP', '#1C1917'),
    coverUrl: img('photo-1414235077428-338989a2e8c0'),
    phone: '7711-9900',
    address: 'СБД, 1-р хороо, Их сургуулийн гудамж 12, Парисын Төв',
    deliveryFee: 5000,
    minOrder: 35000,
    etaMinutes: 35,
    rating: 4.95,
    category: 'French Fine Dining',
    owner: { name: 'Жан-Пьер', email: 'latelier@hool.mn' },
    categories: [
      {
        name: 'Plats Principaux (Үндсэн зоог)',
        items: [
          {
            name: 'Filet de Bœuf Rossini',
            description: 'Ангус үхрийн гол мах, Трюффель соус ба шарсан Фуа-Гра.',
            price: 125000,
            imageUrl: img('photo-1544025162-d76694265947'),
            popular: true,
            calories: 850,
            prep: 25,
            tags: 'онцгой,мишлин',
          },
          {
            name: "Canard Confit à l'Orange",
            description: 'Жүржийн сүмстэй шарсан нугасны гуяны конфи, төмсний пурэтэй.',
            price: 85000,
            imageUrl: img('photo-1514944288352-fffac99f0bdf'),
            popular: true,
            calories: 720,
            prep: 22,
            tags: 'эрэлттэй',
          },
          {
            name: 'Homard Grillé au Beurre Blanc',
            description: 'Цагаан цөцгийн сүмстэй Гриллдсэн Омар далайн хавч.',
            price: 145000,
            imageUrl: img('photo-1534422298391-e4f8c172dddb'),
            calories: 680,
            prep: 30,
            tags: 'онцгой',
          },
        ],
      },
      {
        name: 'Entrées (Эхлэх зууш)',
        items: [
          {
            name: 'Foie Gras Poêlé au Cassis',
            description: 'Хар хадны сүмстэй шарсан Фуа-Гра, бриошь талхтай.',
            price: 78000,
            imageUrl: img('photo-1546964124-0cce460f38ef'),
            popular: true,
            calories: 520,
            prep: 15,
            tags: 'эрэлттэй',
          },
          {
            name: 'Escargots de Bourgogne',
            description: 'Бургунди эмэгнэг хорхой, сармистай цөцгийтэй 6 ширхэг.',
            price: 52000,
            imageUrl: img('photo-1563245372-f21724e3856d'),
            calories: 410,
            prep: 15,
          },
          {
            name: "Soupe à l'Oignon Gratinée",
            description: 'Классик франц сонгины шөл, Грюйер хайлсан бяслагтай.',
            price: 38000,
            imageUrl: img('photo-1547592166-23ac45744acd'),
            calories: 460,
            prep: 18,
          },
        ],
      },
      {
        name: 'Vins & Desserts (Дарс ба Амттан)',
        items: [
          {
            name: 'Crème Brûlée à la Vanille',
            description: 'Мадагаскар ванильтай карамельжүүлсэн Крэм Брюле.',
            price: 28000,
            imageUrl: img('photo-1578985545062-69928b1d9587'),
            popular: true,
            calories: 380,
            prep: 8,
          },
          {
            name: 'Château Margaux Grand Cru',
            description: 'Бордо мужийн тусгай дарс 750мл.',
            price: 210000,
            imageUrl: img('photo-1510812431401-41d2bd2722f3'),
            prep: 5,
            tags: 'дарс',
          },
        ],
      },
    ],
  },
  {
    slug: 'le-marais',
    name: 'Le Marais Parisien',
    tagline: 'Authentique Bistro & Vin Classique',
    description:
      'Парис хотын түүхэн Маре дүүргийн классик бистро. Шинэхэн багет, круассан ба тусгай франц дарс.',
    accentColor: '#7F1D1D',
    logoUrl: logo('LMP', '#7F1D1D'),
    coverUrl: img('photo-1555396273-367ea4eb4db5'),
    phone: '7722-8800',
    address: 'ХУД, 15-р хороо, Зайсангийн гудамж 7',
    deliveryFee: 4000,
    minOrder: 25000,
    etaMinutes: 30,
    rating: 4.88,
    category: 'Parisian Bistro',
    owner: { name: 'Энхжаргал', email: 'lemarais@hool.mn' },
    categories: [
      {
        name: 'Bistro Classics (Бистро зоог)',
        items: [
          {
            name: 'Coq au Vin Traditionnel',
            description: 'Бургунди улаан винд тонилуулсан тахианы мах, мөөгтэй.',
            price: 62000,
            imageUrl: img('photo-1585032226651-759b368d7246'),
            popular: true,
            calories: 690,
            prep: 22,
          },
          {
            name: "Steak Frites au Beurre Maitre d'Hôtel",
            description: 'Франц цөцгийтэй Рибай Стейк ба алтан шарсан төмс.',
            price: 75000,
            imageUrl: img('photo-1558030006-450675393462'),
            popular: true,
            calories: 820,
            prep: 20,
          },
          {
            name: 'Salade Niçoise au Thon Rouge',
            description: 'Улаан туна загастай Нисуаз салат, Олив жимстэй.',
            price: 45000,
            imageUrl: img('photo-1512621776951-a57141f2eefd'),
            calories: 420,
            prep: 12,
          },
        ],
      },
      {
        name: 'Viennoiserie & Pâtisserie',
        items: [
          {
            name: "Croissant au Beurre d'Échiré",
            description: 'Эширэ цөцгийтэй франц круассан.',
            price: 14000,
            imageUrl: img('photo-1555507036-ab1f4038808a'),
            popular: true,
            calories: 310,
            prep: 5,
          },
          {
            name: 'Pain au Chocolat Classique',
            description: 'Бельги шоколадтай франц нарийн боов.',
            price: 16000,
            imageUrl: img('photo-1509440159596-0249088772ff'),
            calories: 340,
            prep: 5,
          },
          {
            name: 'Tarte Tatin aux Pommes',
            description: 'Карамельжүүлсэн алимтай Тэрт Татэн амттан.',
            price: 26000,
            imageUrl: img('photo-1568571780765-9276ac8b75a2'),
            calories: 450,
            prep: 10,
          },
        ],
      },
    ],
  },
  {
    slug: 'maison-du-fromage',
    name: 'Maison du Fromage',
    tagline: 'Fromagerie & Trufferie de Savoie',
    description:
      'Францын Альпийн нурууны тусгай бяслаг ба хар трюффель мөөгний нарийн зоог.',
    accentColor: '#92400E',
    logoUrl: logo('MDF', '#92400E'),
    coverUrl: img('photo-1513104890138-7c749659a591'),
    phone: '7733-4455',
    address: 'ЧД, 4-р хороо, Сөүлийн гудамж 8',
    deliveryFee: 4500,
    minOrder: 30000,
    etaMinutes: 30,
    rating: 4.9,
    category: 'Fromagerie Fine',
    owner: { name: 'Тэмүүжин', email: 'fromage@hool.mn' },
    categories: [
      {
        name: 'Spécialités de Fromage',
        items: [
          {
            name: 'Fondue Savoyarde au Vin Blanc',
            description: 'Цагаан винд хайллуулсан 3 бяслагтай Фондю зоог.',
            price: 88000,
            imageUrl: img('photo-1595854341625-f33ee10dbf94'),
            popular: true,
            calories: 950,
            prep: 20,
          },
          {
            name: 'Plateau de Fromages de France',
            description: 'Францын 5 төрлийн премиум бяслагны цуглуулга.',
            price: 95000,
            imageUrl: img('photo-1452195100486-9cc805987862'),
            popular: true,
            calories: 780,
            prep: 15,
          },
          {
            name: 'Risotto aux Truffes Noires',
            description: 'Хар трюффель мөөгний Франц Ризотто зоог.',
            price: 72000,
            imageUrl: img('photo-1621996346565-e3dbc646d9a9'),
            groups: [
              {
                name: 'Сүү',
                required: true,
                maxSelect: 1,
                options: [
                  ['Энгийн сүү', 0],
                  ['Овъёосны сүү', 1000],
                  ['Бадамны сүү', 1000],
                ],
              },
              {
                name: 'Нэмэлт',
                maxSelect: 2,
                options: [
                  ['Нэмэлт шот', 1500],
                  ['Ванилийн сироп', 800],
                  ['Карамель сироп', 800],
                ],
              },
            ],
          },
          {
            name: 'Латте',
            description: 'Зөөлөн, сүү давамгайлсан.',
            price: 7000,
            imageUrl: img('photo-1495474472287-4d71bcdd2085'),
            popular: true,
            calories: 190,
            prep: 5,
            tags: 'эрэлттэй',
          },
          {
            name: 'Хүйтэн шүүрэлт',
            description: '18 цаг хүйтнээр шүүсэн, гашуун амтгүй.',
            price: 8000,
            imageUrl: img('photo-1520201163981-8cc95007dd2a'),
            calories: 25,
            prep: 3,
          },
        ],
      },
      {
        name: 'Талх, амттан',
        items: [
          {
            name: 'Круассан',
            description: 'Францын цөцгийн тостой, 27 давхарга.',
            price: 5500,
            imageUrl: img('photo-1555507036-ab1f4038808a'),
            popular: true,
            calories: 340,
            prep: 3,
            tags: 'эрэлттэй,цагаан хоол',
          },
          {
            name: 'Шоколадан бялуу',
            description: 'Бельги шоколад, давсалсан карамель.',
            price: 9500,
            imageUrl: img('photo-1578985545062-69928b1d9587'),
            calories: 480,
            prep: 3,
          },
          {
            name: 'Чизкейк',
            description: 'Нью-Йорк маягийн, улаан жимсний соустай.',
            price: 10000,
            imageUrl: img('photo-1498654896293-37aacf113fd9'),
            calories: 450,
            prep: 3,
            tags: 'цагаан хоол',
          },
        ],
      },
      {
        name: 'Цай, жүүс',
        items: [
          {
            name: 'Матча латте',
            description: 'Японы церемонийн зэрэглэлийн матча.',
            price: 8500,
            imageUrl: img('photo-1544787219-7f47ccb76574'),
            calories: 160,
            prep: 5,
            tags: 'цагаан хоол',
          },
          {
            name: 'Улбар шар жүүс',
            description: 'Өглөө бүр шинээр шахсан.',
            price: 6500,
            imageUrl: img('photo-1600271886742-f049cd451bba'),
            calories: 110,
            prep: 3,
          },
        ],
      },
    ],
  },
];

const DISTRICTS = ['Сүхбаатар дүүрэг', 'Баянзүрх дүүрэг', 'Хан-Уул дүүрэг', 'Чингэлтэй дүүрэг'];
const NAMES = ['Болормаа', 'Ганбат', 'Сарантуяа', 'Мөнхбат', 'Оюунчимэг', 'Дэлгэрмаа'];
const STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'DELIVERING',
  'COMPLETED',
  'COMPLETED',
  'COMPLETED',
  'CANCELLED',
];

/**
 * Seed нь ХАМАГ өгөгдлийг устгадаг — захиалга, төлбөр, данс, ресторан бүгд.
 *
 * Deploy хийсний дараа буруу ажиллуулбал бодит хэрэглэгчийн өгөгдөл, төлсөн
 * сүбскрипшний хүсэлт хормын дотор алга болно. Тиймээс дор хаяж нэг бодит
 * ул мөр байвал зогсоно. Зориуд дарж өнгөрөх бол FORCE_SEED=1.
 */
async function assertSafeToWipe() {
  if (process.env.FORCE_SEED === '1') {
    console.warn('⚠  FORCE_SEED=1 — шалгалтыг алгасаж, бүх өгөгдлийг устгана.\n');
    return;
  }

  const [requests, orders] = await Promise.all([
    prisma.restaurantRequest.count(),
    prisma.order.count(),
  ]);

  // Seed-ийн үүсгэсэн захиалгууд байдаг тул захиалга дангаараа шинж тэмдэг
  // биш. Харин рестораны хүсэлт seed-ээс ХЭЗЭЭ Ч үүсдэггүй — байна гэвэл
  // бодит хүн гаргасан, магадгүй төлбөр төлсөн гэсэн үг.
  if (requests > 0) {
    throw new Error(
      `Энэ санд ${requests} рестораны хүсэлт байна (захиалга: ${orders}).\n` +
        'Seed бүгдийг устгах тул зогслоо. Үнэхээр цэвэрлэх бол:\n' +
        '  FORCE_SEED=1 npm run db:seed\n',
    );
  }
}

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);

  await assertSafeToWipe();

  console.log('Хуучин өгөгдлийг цэвэрлэж байна...');
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.modifierOption.deleteMany();
  await prisma.modifierGroup.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.restaurantRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();
  await prisma.tenant.deleteMany();

  // Платформын админ — рестораны хүсэлтийг хянана. Ресторанд харьяалагдахгүй.
  await prisma.account.create({
    data: {
      name: 'Платформ админ',
      email: 'admin@hool.mn',
      phone: '99000000',
      passwordHash,
      isPlatformAdmin: true,
    },
  });

  // Нэг харилцагчийн данс — бүх ресторанд гишүүнчлэлтэй болно.
  const demoCustomer = await prisma.account.create({
    data: {
      name: 'Түвшин',
      email: 'hereglegch@hool.mn',
      phone: '99112233',
      passwordHash,
    },
  });

  for (const t of tenants) {
    const tenant = await prisma.tenant.create({
      data: {
        slug: t.slug,
        name: t.name,
        tagline: t.tagline,
        description: t.description,
        accentColor: t.accentColor,
        logoUrl: t.logoUrl,
        coverUrl: t.coverUrl,
        phone: t.phone,
        address: t.address,
        deliveryFee: t.deliveryFee,
        minOrder: t.minOrder,
        etaMinutes: t.etaMinutes,
        rating: t.rating,
        category: t.category,
        deliveryEnabled: t.deliveryEnabled ?? true,
        pickupEnabled: t.pickupEnabled ?? true,
      },
    });

    // Эзний платформын данс — нэг данс, тухайн ресторан дээрх гишүүнчлэлтэй.
    const ownerAccount = await prisma.account.create({
      data: {
        name: t.owner.name,
        email: t.owner.email,
        phone: t.phone.replace('-', ''),
        passwordHash,
      },
    });

    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        accountId: ownerAccount.id,
        name: t.owner.name,
        email: t.owner.email,
        phone: t.phone.replace('-', ''),
        role: 'DIRECTOR',
      },
    });

    // Role тус бүрийн dashboard-ийг шууд турших демо ажилтнууд.
    for (const role of ['MANAGER', 'CASHIER', 'KITCHEN', 'DRIVER'] as const) {
      const email = `${role.toLowerCase()}.${t.slug}@hool.mn`;
      const account = await prisma.account.create({
        data: { name: `${t.name} ${role}`, email, phone: t.phone.replace('-', ''), passwordHash },
      });
      await prisma.user.create({
        data: {
          tenantId: tenant.id, accountId: account.id, name: account.name,
          email, phone: account.phone, role,
        },
      });
    }

    // Демо харилцагч — НЭГ данс, ресторан бүрт гишүүнчлэлтэй.
    // Ингэснээр нэг бүртгэлээр бүх ресторанд хандах загвар харагдана.
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        accountId: demoCustomer.id,
        name: demoCustomer.name,
        email: demoCustomer.email,
        phone: demoCustomer.phone,
        role: 'USER',
      },
    });

    const createdItems: { id: string; price: number; name: string; imageUrl: string | null }[] = [];

    for (const [ci, cat] of t.categories.entries()) {
      const category = await prisma.category.create({
        data: { tenantId: tenant.id, name: cat.name, sortOrder: ci },
      });

      for (const [ii, item] of cat.items.entries()) {
        const created = await prisma.menuItem.create({
          data: {
            tenantId: tenant.id,
            categoryId: category.id,
            name: item.name,
            description: item.description,
            imageUrl: item.imageUrl,
            price: item.price,
            isPopular: item.popular ?? false,
            calories: item.calories,
            prepMinutes: item.prep ?? 15,
            tags: item.tags ?? '',
            sortOrder: ii,
            modifierGroups: {
              create: (item.groups ?? []).map((g, gi) => ({
                name: g.name,
                required: g.required ?? false,
                maxSelect: g.maxSelect ?? 1,
                sortOrder: gi,
                options: {
                  create: g.options.map(([name, priceDelta], oi) => ({
                    name,
                    priceDelta,
                    sortOrder: oi,
                  })),
                },
              })),
            },
          },
        });
        createdItems.push(created);
      }
    }

    // --- Демо захиалгууд: dashboard хоосон харагдахгүйн тулд -------------------
    for (let i = 0; i < 14; i++) {
      const picks = pickSome(createdItems, 1 + Math.floor(Math.random() * 3));
      const lines = picks.map((p) => {
        const quantity = 1 + Math.floor(Math.random() * 2);
        return {
          menuItemId: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          unitPrice: p.price,
          quantity,
          options: '',
          lineTotal: p.price * quantity,
        };
      });
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      const daysAgo = Math.floor(Math.random() * 6);
      const createdAt = new Date(Date.now() - daysAgo * 864e5 - Math.random() * 36e5 * 10);

      await prisma.order.create({
        data: {
          tenantId: tenant.id,
          orderNo: 1001 + i,
          customerName: NAMES[i % NAMES.length],
          customerPhone: `99${String(100000 + i * 137).slice(0, 6)}`,
          district: DISTRICTS[i % DISTRICTS.length],
          addressLine: `${10 + i}-р байр, ${1 + (i % 9)} тоот`,
          status: i < 4 ? STATUSES[i] : STATUSES[i % STATUSES.length],
          subtotal,
          deliveryFee: t.deliveryFee,
          total: subtotal + t.deliveryFee,
          isPaid: Math.random() > 0.5,
          createdAt,
          items: { create: lines },
        },
      });
    }

    // Тоолуурыг сүүлийн демо дугаар дээр тавина — дараагийн жинхэнэ
    // захиалга 1015-аас үргэлжилнэ.
    await prisma.tenant.update({ where: { id: tenant.id }, data: { orderSeq: 1014 } });

    // --- Ширээ, ширээний захиалга ---------------------------------------------
    const tables = await Promise.all(
      [
        { number: 'Table 1', capacity: 2 },
        { number: 'Table 2', capacity: 2 },
        { number: 'Table 3', capacity: 4 },
        { number: 'Table 4', capacity: 4 },
        { number: 'Table 5', capacity: 8 },
      ].map((tbl) =>
        prisma.restaurantTable.create({ data: { ...tbl, tenantId: tenant.id } }),
      ),
    );

    const RES_STATUS = ['PENDING', 'PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED'] as const;
    for (let i = 0; i < 6; i++) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + (i % 4)); // өнөөдрөөс 3 хоногийн дотор
      await prisma.reservation.create({
        data: {
          tenantId: tenant.id,
          tableId: tables[i % tables.length].id,
          customerName: NAMES[i % NAMES.length],
          customerPhone: `99${String(200000 + i * 311).slice(0, 6)}`,
          partySize: 2 + (i % 4),
          reservedAt: day,
          reservedTime: ['12:00', '13:30', '18:00', '19:30', '20:00', '21:00'][i],
          status: RES_STATUS[i],
          note: i === 0 ? 'Цонхны дэргэд байвал сайн' : null,
        },
      });
    }

    console.log(
      `  ${t.name} — ${createdItems.length} хоол, 14 захиалга, ${tables.length} ширээ, 6 ширээ захиалга`,
    );
  }

  console.log('\nНэвтрэх мэдээлэл (нууц үг бүгд: 123456)');
  for (const t of tenants) console.log(`   ${t.name.padEnd(16)} эзэн: ${t.owner.email}`);
  console.log('   харилцагч: hereglegch@hool.mn (ресторан бүрт)');
  console.log('   платформын админ: admin@hool.mn');
  console.log('');
}

function pickSome<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
