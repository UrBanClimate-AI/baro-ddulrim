import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const fallbackDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/baro_ddulrim";

function createPrismaAdapter() {
  const connectionString = process.env.DATABASE_URL ?? fallbackDatabaseUrl;
  const rejectUnauthorized = process.env.PRISMA_SSL_REJECT_UNAUTHORIZED !== "false";
  // pg 드라이버는 URL의 ?schema= 파라미터를 무시하므로,
  // 어댑터 옵션으로 넘겨야 dev/public 스키마 분리가 런타임에도 적용된다.
  const schema = new URL(connectionString).searchParams.get("schema") ?? undefined;

  return new PrismaPg(
    {
      connectionString,
      ssl: {
        rejectUnauthorized
      }
    },
    schema ? { schema } : undefined
  );
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: createPrismaAdapter()
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
