import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { SlowRequestInterceptor } from './common/interceptors/slow-request.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security headers（HSTS / X-Content-Type-Options / Referrer-Policy 等）
  // 後端只回 JSON，CSP 由前端 next.config 設定
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://admin.localhost:3000',
        'http://originals-admin.localhost:3000',
        'http://originals.localhost:3000',
      ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Global pipes, interceptors, filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // SlowRequest 放最外層才能量到完整 handler 時間（含 Transform 包裝）
  app.useGlobalInterceptors(
    new SlowRequestInterceptor(),
    new TransformInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger API docs：production 預設關閉，避免端點清單外洩
  // 若需要在 production 開啟（例如臨時除錯），設 ENABLE_SWAGGER=true
  const enableSwagger =
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Originals Lineage Platform API')
      .setDescription('主後台平台 + 始祖天堂模組 API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || process.env.BACKEND_PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}`);
  if (enableSwagger) {
    console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
