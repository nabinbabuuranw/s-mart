import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodTypeAny } from 'zod';

@Injectable()
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}
  transform(value: unknown, _m: ArgumentMetadata) {
    const r = this.schema.safeParse(value ?? {});
    if (!r.success) {
      throw new BadRequestException({ code: 'validation_error', message: 'Validation failed', details: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    }
    return r.data;
  }
}
export const z = (schema: ZodTypeAny) => new ZodPipe(schema);
