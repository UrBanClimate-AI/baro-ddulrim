import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 4000);
  const webOrigin = config.get<string>(
    "WEB_ORIGIN",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
  );
  // 랜딩 페이지(GitHub Pages)는 공개 게시판 API 호출을 위해 항상 허용한다.
  const landingOrigins = [
    "https://dev-hleah.github.io",
    "https://xn--2e0bm8ujoggxunsc.org",
    "https://www.xn--2e0bm8ujoggxunsc.org",
    "https://hasugulab.com",
    "https://www.hasugulab.com",
  ];
  const allowedOrigins = [
    ...new Set([
      ...webOrigin
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      ...landingOrigins,
    ]),
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("바로 뚫림 API")
    .setDescription("신고 접수, 관리자 검수, 업체 입찰 API")
    .setVersion("0.1.0")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(port);
}

void bootstrap();
