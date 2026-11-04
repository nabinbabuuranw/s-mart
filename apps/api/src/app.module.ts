import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ENV, Env } from './config/env';
import { PrismaService } from './prisma/prisma.service';
import { AuditService } from './common/audit';
import { EventsService } from './common/events';
import { AllExceptionsFilter } from './common/errors';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { AccessGuard } from './auth/guards';
import { SettingsService } from './settings/settings.service';
import { PricingService } from './catalog/pricing.service';
import { CatalogController } from './catalog/catalog.controller';
import { AdminCatalogController } from './catalog/admin-catalog.controller';
import { PaymentsService } from './payments/payments.service';
import { OrdersService } from './orders/orders.service';
import { OrdersController } from './orders/orders.controller';
import { CustomerController } from './customer/customer.controller';
import { AdminController } from './admin/admin.controller';
import { AnalyticsController } from './reports/analytics.controller';
import { PlatformController } from './platform/platform.controller';

export function buildModule(env: Env) {
  @Module({
    imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: env.RATE_LIMIT_GLOBAL }])],
    controllers: [AuthController, CatalogController, AdminCatalogController, OrdersController, CustomerController, AdminController, AnalyticsController, PlatformController],
    providers: [
      { provide: ENV, useValue: env }, PrismaService, AuditService, EventsService, AuthService, SettingsService, PricingService, PaymentsService, OrdersService,
      { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: AccessGuard }, { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  })
  class AppModule {}
  return AppModule;
}
