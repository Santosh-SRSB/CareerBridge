import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  const webOrigins = Array.from(
    new Set(
      [
        ...(process.env.WEB_ORIGIN || 'http://localhost:3000').split(','),
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ]
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  );
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
