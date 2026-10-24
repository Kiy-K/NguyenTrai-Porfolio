import { z } from 'zod';

export function isReferenceUrl(value: string): boolean {
  if (!/^https?:\/\/[^\s\\]+$/i.test(value)) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const optionalText = (max: number) => z.string().max(max, `Tối đa ${max} ký tự.`).trim()
  .optional().transform(value => value || undefined);

export const articleReferencesSchema = z.array(z.object({
  title: z.string().max(300, 'Tối đa 300 ký tự.').trim().min(1, 'Vui lòng nhập tên nguồn.'),
  url: optionalText(2048).refine(value => !value || isReferenceUrl(value), 'Dùng URL đầy đủ bắt đầu bằng http:// hoặc https://.'),
  author: optionalText(200),
  publisher: optionalText(200),
})).max(20, 'Tối đa 20 nguồn tham khảo.');
