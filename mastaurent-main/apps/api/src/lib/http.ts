import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/** Хүлээгдэж буй алдаа — клиент рүү шууд мессежээр буцна. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new HttpError(400, m);
export const unauthorized = (m = 'Нэвтрэх шаардлагатай') => new HttpError(401, m);
export const forbidden = (m = 'Хандах эрхгүй') => new HttpError(403, m);
export const notFound = (m = 'Олдсонгүй') => new HttpError(404, m);

/** async route handler-ийн алдааг express рүү дамжуулна. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req as T, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.errors[0];
    return res.status(400).json({ message: first?.message ?? 'Буруу өгөгдөл', issues: err.errors });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error('[api] Гэнэтийн алдаа:', err);
  return res.status(500).json({ message: 'Дотоод серверийн алдаа' });
}
