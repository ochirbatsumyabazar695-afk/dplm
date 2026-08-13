import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { prisma } from './db.js';
import { env } from './env.js';
import { verifyAccess } from './lib/jwt.js';

let io: Server | null = null;
export function startRealtime(server: HttpServer) {
  // CORS-ыг HTTP талтай ижил байлгана — эс бол самбарын realtime холболт
  // preview домэйн дээр чимээгүй тасарна.
  io = new Server(server, { cors: { origin: env.webOrigins, credentials: true } });
  io.on('connection', (socket) => {
    socket.on('track-order', async (token: string) => {
      if (typeof token !== 'string') return;
      const order = await prisma.order.findUnique({ where: { trackToken: token }, select: { id: true } });
      if (order) socket.join(`order:${order.id}`);
    });
    socket.on('join-tenant', async (accessToken: string) => {
      try {
        const payload = verifyAccess(accessToken);
        const member = await prisma.user.findFirst({
          where: { accountId: payload.sub, isActive: true, role: { in: ['DIRECTOR', 'MANAGER', 'CASHIER', 'KITCHEN'] } },
          select: { tenantId: true },
        });
        if (member) socket.join(`tenant:${member.tenantId}`);
      } catch { /* invalid tokens never join a tenant room */ }
    });
  });
  return io;
}
export const emitOrder = (orderId: string, event: string, payload: unknown) => io?.to(`order:${orderId}`).emit(event, payload);
export const emitTenant = (tenantId: string, event: string, payload: unknown) => io?.to(`tenant:${tenantId}`).emit(event, payload);
