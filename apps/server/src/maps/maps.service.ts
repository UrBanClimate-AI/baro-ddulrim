import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { toIso, toNumber } from "../common/format";
import { PrismaService } from "../prisma/prisma.service";

type KakaoKeywordDocument = {
  id?: string;
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  category_name?: string;
  x?: string;
  y?: string;
};

type KakaoAddressDocument = {
  address_name?: string;
  x?: string;
  y?: string;
  address?: {
    address_name?: string;
  } | null;
  road_address?: {
    address_name?: string;
    building_name?: string;
  } | null;
};

type KakaoSearchResponse<TDocument> = {
  documents?: TDocument[];
};

export type LocationSearchCandidate = {
  id: string;
  provider: "kakao";
  providerPlaceId: string | null;
  title: string;
  addressText: string | null;
  roadAddressText: string | null;
  placeName: string | null;
  category: string | null;
  latitude: number;
  longitude: number;
};

@Injectable()
export class MapsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** 좌표 → 법정동코드(b_code). 지역 배분 매칭용. 실패 시 null. */
  async regionCodeFromCoord(
    latitude: number,
    longitude: number,
  ): Promise<string | null> {
    const apiKey = this.config.get<string>("KAKAO_REST_API_KEY")?.trim();
    if (!apiKey) return null;

    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${longitude}&y=${latitude}`,
        { headers: { Authorization: `KakaoAK ${apiKey}` } },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as {
        documents?: Array<{ region_type?: string; code?: string }>;
      };
      const docs = json.documents ?? [];
      // region_type "B" = 법정동. 카카오 좌표→행정구역 응답에서 B의 code 사용.
      const legal = docs.find((d) => d.region_type === "B") ?? docs[0];
      return legal?.code ?? null;
    } catch {
      return null;
    }
  }

  async searchLocations(query: string | undefined) {
    const cleanQuery = query?.trim();

    if (!cleanQuery) {
      throw new BadRequestException("검색어를 입력해 주세요.");
    }

    const apiKey = this.config.get<string>("KAKAO_REST_API_KEY")?.trim();

    if (!apiKey) {
      throw new BadRequestException(
        "Kakao REST API 키가 설정되어 있지 않습니다.",
      );
    }

    const limit = this.getSearchLimit();
    const [keywordCandidates, addressCandidates] = await Promise.all([
      this.searchKakaoKeyword(cleanQuery, apiKey, limit),
      this.searchKakaoAddress(cleanQuery, apiKey, limit),
    ]);

    return this.dedupeCandidates([
      ...keywordCandidates,
      ...addressCandidates,
    ]).slice(0, limit);
  }

  async findReportMarkers() {
    const reports = await this.prisma.report.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
      include: {
        assignment: {
          include: {
            contractorCompany: true,
          },
        },
        workUpdates: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            contractorCompany: true,
          },
        },
      },
    });

    return reports.map((report) => ({
      id: report.id,
      reportNo: report.reportNo,
      status: report.status,
      issueType: report.issueType,
      urgency: report.urgency,
      summary: report.summary,
      addressText: report.addressText,
      roadAddressText: report.roadAddressText,
      placeName: report.placeName,
      latitude: toNumber(report.latitude),
      longitude: toNumber(report.longitude),
      assignedCompanyName:
        report.assignment?.contractorCompany.companyName ?? null,
      latestWorkStatus: report.workUpdates[0]?.status ?? null,
      latestWorkNote: report.workUpdates[0]?.note ?? null,
      createdAt: toIso(report.createdAt),
      assignedAt: toIso(report.assignedAt),
      resolvedAt: toIso(report.resolvedAt),
    }));
  }

  private getSearchLimit() {
    const configured = Number(
      this.config.get<string>("MAP_SEARCH_MAX_RESULTS") ?? 5,
    );

    if (!Number.isFinite(configured) || configured <= 0) {
      return 5;
    }

    return Math.min(10, Math.floor(configured));
  }

  private async searchKakaoKeyword(
    query: string,
    apiKey: string,
    limit: number,
  ) {
    const response = await this.fetchKakao<
      KakaoSearchResponse<KakaoKeywordDocument>
    >("https://dapi.kakao.com/v2/local/search/keyword.json", apiKey, {
      query,
      size: String(limit),
    });

    return (response.documents ?? []).flatMap((document) => {
      const latitude = Number(document.y);
      const longitude = Number(document.x);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return [];
      }

      const title =
        document.place_name ??
        document.road_address_name ??
        document.address_name;

      if (!title) {
        return [];
      }

      return [
        {
          id: `kakao-keyword-${document.id ?? `${latitude}-${longitude}`}`,
          provider: "kakao" as const,
          providerPlaceId: document.id ?? null,
          title,
          addressText: document.address_name ?? null,
          roadAddressText: document.road_address_name ?? null,
          placeName: document.place_name ?? null,
          category: document.category_name ?? null,
          latitude,
          longitude,
        },
      ];
    });
  }

  private async searchKakaoAddress(
    query: string,
    apiKey: string,
    limit: number,
  ) {
    const response = await this.fetchKakao<
      KakaoSearchResponse<KakaoAddressDocument>
    >("https://dapi.kakao.com/v2/local/search/address.json", apiKey, {
      query,
      size: String(limit),
    });

    return (response.documents ?? []).flatMap((document) => {
      const latitude = Number(document.y);
      const longitude = Number(document.x);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return [];
      }

      const roadAddressText = document.road_address?.address_name ?? null;
      const addressText =
        document.address?.address_name ?? document.address_name ?? null;
      const title =
        document.road_address?.building_name || roadAddressText || addressText;

      if (!title) {
        return [];
      }

      return [
        {
          id: `kakao-address-${latitude}-${longitude}`,
          provider: "kakao" as const,
          providerPlaceId: null,
          title,
          addressText,
          roadAddressText,
          placeName: document.road_address?.building_name || null,
          category: "주소",
          latitude,
          longitude,
        },
      ];
    });
  }

  private async fetchKakao<T>(
    url: string,
    apiKey: string,
    params: Record<string, string>,
  ): Promise<T> {
    const requestUrl = new URL(url);

    Object.entries(params).forEach(([key, value]) => {
      requestUrl.searchParams.set(key, value);
    });

    const response = await fetch(requestUrl, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new BadRequestException(
        message || "Kakao 위치 검색에 실패했습니다.",
      );
    }

    return (await response.json()) as T;
  }

  private dedupeCandidates(candidates: LocationSearchCandidate[]) {
    const seen = new Set<string>();

    return candidates.filter((candidate) => {
      const key = [
        candidate.providerPlaceId,
        candidate.roadAddressText,
        candidate.addressText,
        candidate.latitude.toFixed(7),
        candidate.longitude.toFixed(7),
      ]
        .filter(Boolean)
        .join("|");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }
}
