import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 시도 목록 */
  async findSido() {
    const rows = await this.prisma.region.findMany({
      where: { level: 1, isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, sido: true }
    });
    return rows.map((r) => ({ code: r.code, name: r.sido }));
  }

  /** 특정 시도의 시군구 목록 (sidoCode = 시도 법정동코드) */
  async findSigungu(sidoCode: string) {
    const prefix = sidoCode.slice(0, 2);
    const rows = await this.prisma.region.findMany({
      where: {
        level: 2,
        isActive: true,
        code: { startsWith: prefix }
      },
      orderBy: { code: "asc" },
      select: { code: true, sigungu: true, sido: true }
    });
    return rows.map((r) => ({
      code: r.code,
      name: r.sigungu ?? r.sido,
      sido: r.sido
    }));
  }

  /** 시군구 코드 목록으로 지역명 조회 (표시용) */
  async findByCodes(codes: string[]) {
    if (codes.length === 0) return [];
    const rows = await this.prisma.region.findMany({
      where: { code: { in: codes } },
      select: { code: true, name: true, sido: true, sigungu: true }
    });
    return rows;
  }
}
