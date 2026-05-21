import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { json, Request } from "express";

const cloneBuffer = require("clone-buffer") as (buf: Buffer) => Buffer;

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });

  app.use(
    json({
      verify: (req: RawBodyRequest, _res, buf) => {
        if (Buffer.isBuffer(buf)) {
          req.rawBody = cloneBuffer(buf);
        }
      },
    })
  );

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    })
  );

  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`Server running on port ${port}`, "MetaWrapper");
}

bootstrap();
