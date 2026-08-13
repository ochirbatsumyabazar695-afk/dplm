import { execSync } from 'node:child_process';

/**
 * Dev серверийн портуудыг чөлөөлнө.
 *
 * Өмнөх `npm run dev` бүрэн зогсоогүй үлдвэл шинэ ажиллуулалт
 * EADDRINUSE өгч унадаг. Энэ скрипт тэр үлдэгдлийг цэвэрлэнэ.
 */

// Vite нь 5173 эзэлэгдсэн бол 5174, 5175... руу өөрөө шилждэг тул
// тэр мөрийг ч цэвэрлэнэ — эс бөгөөс үлдэгдэл хуримтлагдсаар байдаг.
const PORTS = [4000, 5173, 5174, 5175, 5176];
const isWindows = process.platform === 'win32';

/** Тухайн портыг СОНСОЖ буй процессуудын PID. */
function listenersOf(port) {
  try {
    if (isWindows) {
      // `-p tcp` хэрэглэхгүй — тэр нь зөвхөн IPv4-ийг харуулдаг бөгөөд
      // Vite нь [::1] (IPv6) дээр сонсдог тул олдохгүй болно.
      const out = execSync(`netstat -ano | findstr LISTENING | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const pids = out
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        // Локал хаяг нь яг энэ портоор төгсөж байгаа мөрийг л авна.
        .filter((cols) => cols.length >= 5 && cols[1]?.endsWith(`:${port}`))
        .map((cols) => cols[cols.length - 1]);
      return [...new Set(pids)].filter((pid) => pid && pid !== '0');
    }

    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return [...new Set(out.split(/\s+/).filter(Boolean))];
  } catch {
    // findstr/lsof юу ч олдоггүй бол 1 буцаадаг — алдаа биш.
    return [];
  }
}

function kill(pid) {
  try {
    if (isWindows) execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
    else process.kill(Number(pid), 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

let freed = 0;
for (const port of PORTS) {
  const pids = listenersOf(port);
  if (!pids.length) {
    console.log(`  порт ${port}: чөлөөтэй`);
    continue;
  }
  for (const pid of pids) {
    const ok = kill(pid);
    console.log(`  порт ${port}: PID ${pid} ${ok ? 'зогсоолоо' : 'зогсоож чадсангүй (эрх дутуу?)'}`);
    if (ok) freed++;
  }
}

if (freed) console.log(`\n  ${freed} процесс зогслоо.\n`);
