import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ENV, Env } from '../config/env';

/**
 * Provider interface. Only Cash on Delivery is live. The others are documented adapters that
 * report isConfigured() === false until the merchant supplies keys (see docs/PAYMENTS.md).
 * An order becomes "paid" only through server-side verification (COD: delivery recorded by staff;
 * gateways: provider verify call), never because the browser says so.
 */
export interface PaymentProvider {
  readonly id: 'cod' | 'esewa' | 'khalti' | 'stripe';
  readonly label: string;
  isConfigured(): boolean;
}

@Injectable()
export class PaymentsService {
  private readonly providers: PaymentProvider[];
  constructor(@Inject(ENV) env: Env) {
    this.providers = [
      { id: 'cod', label: 'Cash on delivery', isConfigured: () => true },
      { id: 'esewa', label: 'eSewa', isConfigured: () => !!env.ESEWA_SECRET_KEY },
      { id: 'khalti', label: 'Khalti', isConfigured: () => !!env.KHALTI_SECRET_KEY },
      { id: 'stripe', label: 'Card (Stripe)', isConfigured: () => !!env.STRIPE_SECRET_KEY },
    ];
  }
  provider(id: string): PaymentProvider {
    const p = this.providers.find((x) => x.id === id);
    if (!p) throw new BadRequestException({ code: 'unknown_payment_method', message: 'Unknown payment method' });
    return p;
  }
  list() { return this.providers.map((p) => ({ id: p.id, label: p.label, enabled: p.isConfigured() })); }
}
