import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : [
        'http://localhost:3000',
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
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger API docs
  const config = new DocumentBuilder()
    .setTitle('Originals Lineage Platform API')
    .setDescription('主後台平台 + 始祖天堂模組 API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.BACKEND_PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}`);
  console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
