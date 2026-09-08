import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CloudJsonLogger } from './common/logger/cloud-json-logger';

process.on('uncaughtException', (err) => {
  console.error('uncaughtException (API kept running):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection (API kept running):', reason);
});

async function bootstrap() {
  const isCloudOrProd = process.env.NODE_ENV === 'production' || Boolean(process.env.GCP_PROJECT_ID);
  const app = await NestFactory.create(AppModule, {
    logger: isCloudOrProd ? new CloudJsonLogger() : ['log', 'error', 'warn', 'debug', 'verbose'],
    rawBody: true,
  });

  app.setGlobalPrefix('api/v1');
  const webOrigins = (process.env.WEB_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: webOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('CareerBridge API')
    .setDescription('Youth Employability & Talent Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
}

bootstrap();
