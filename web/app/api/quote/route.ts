import { forward } from '@/lib/proxy';
export const POST = (req: Request) => forward(req, '/checkout/quote');
