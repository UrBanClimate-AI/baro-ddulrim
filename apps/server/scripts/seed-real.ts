/**
 * seed-real.ts — 운영 투입용 "실사용처럼 보이는" 테스트 데이터
 *
 * 범위: 서울·경기 전역 / 업체 30곳 / 신고 80건 (최근 60일)
 * 특징: 실제 접수번호 포맷(BD-YYYYMMDD-####), 요일·시간대 가중 분포,
 *       채널 혼합(WEB·AI_CALL·KAKAO·PHONE), 배분 제안 체인(수락·거절·무응답),
 *       AI 통화 전문, 카카오 상담 대화, 오분류(관리자 수정), 동·호수 상세
 *
 * 식별 규칙: 이 스크립트가 만든 행은 id가 "sr-" 로 시작 → 재실행 시 자동 정리(멱등)
 * 옵션: --purge-demo  기존 demo-* / BD-SEED-* 데이터도 함께 삭제
 *
 * 실행:  pnpm --filter @baro-ddulrim/server exec tsx scripts/seed-real.ts [--purge-demo]
 *        (.env 의 DATABASE_URL 대상 — pnpm env:dev / env:prd 로 전환)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ActorType,
  AiProvider,
  ContractorStatus,
  IssueType,
  OfferStatus,
  PrismaClient,
  RejectReason,
  ReportChannel,
  ReportStatus,
  SenderType,
  Urgency,
  WorkStatus,
} from "../src/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL 이 필요합니다.");
  const rejectUnauthorized = process.env.PRISMA_SSL_REJECT_UNAUTHORIZED !== "false";
  const schema = new URL(connectionString).searchParams.get("schema") ?? undefined;
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString, ssl: { rejectUnauthorized } },
      schema ? { schema } : undefined,
    ),
  });
}

const prisma = createPrismaClient();
const PURGE_DEMO = process.argv.includes("--purge-demo");
const PARTNER_PASSWORD = process.env.SEED_PARTNER_PASSWORD ?? "test1234!";

// 결정적 난수 (재실행 시 같은 데이터)
let seedState = 20261012;
function rand() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const ri = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** KST 기준 일시 생성 → UTC Date */
function kst(daysAgoN: number, hour: number, minute: number) {
  const now = new Date();
  const d = new Date(now.getTime() - daysAgoN * 86400000);
  d.setUTCHours(hour - 9, minute, ri(0, 59), 0);
  return d;
}
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

// ─────────────────────────────────────────────
// 지역 풀 — 서울 14 + 경기 16 (대표 동, 근사 좌표)
// ─────────────────────────────────────────────
type Loc = {
  sido: string; sg: string; dong: string; road: string;
  lat: number; lng: number; places: string[];
};
const LOCS: Loc[] = [
  { sido: "서울", sg: "강남구", dong: "역삼동", road: "서울 강남구 테헤란로", lat: 37.5006, lng: 127.0364, places: ["역삼동 오피스 상가", "테헤란로 빌딩 지하", "역삼동 원룸"] },
  { sido: "서울", sg: "마포구", dong: "서교동", road: "서울 마포구 양화로", lat: 37.5563, lng: 126.9236, places: ["홍대입구 카페", "서교동 다세대주택", "연남동 식당"] },
  { sido: "서울", sg: "송파구", dong: "잠실동", road: "서울 송파구 올림픽로", lat: 37.5133, lng: 127.1001, places: ["잠실 아파트", "석촌호수 인근 상가", "잠실동 빌라"] },
  { sido: "서울", sg: "노원구", dong: "상계동", road: "서울 노원구 동일로", lat: 37.6604, lng: 127.0731, places: ["상계동 주공아파트", "노원역 상가", "상계동 단독주택"] },
  { sido: "서울", sg: "강서구", dong: "화곡동", road: "서울 강서구 화곡로", lat: 37.5415, lng: 126.8405, places: ["화곡동 빌라", "까치산역 인근 식당", "화곡동 다가구"] },
  { sido: "서울", sg: "영등포구", dong: "당산동", road: "서울 영등포구 당산로", lat: 37.5341, lng: 126.9025, places: ["당산동 아파트", "영등포시장 인근 상가", "당산역 오피스텔"] },
  { sido: "서울", sg: "관악구", dong: "신림동", road: "서울 관악구 신림로", lat: 37.4842, lng: 126.9297, places: ["신림동 고시원", "신림역 음식점", "신림동 원룸촌"] },
  { sido: "서울", sg: "성북구", dong: "길음동", road: "서울 성북구 길음로", lat: 37.6028, lng: 127.0252, places: ["길음뉴타운 아파트", "길음동 상가주택", "미아리 인근 식당"] },
  { sido: "서울", sg: "은평구", dong: "불광동", road: "서울 은평구 통일로", lat: 37.6104, lng: 126.9296, places: ["불광동 주택", "연신내 상가", "불광동 빌라"] },
  { sido: "서울", sg: "구로구", dong: "구로동", road: "서울 구로구 디지털로", lat: 37.4954, lng: 126.8874, places: ["구로디지털단지 건물", "구로동 아파트", "구로시장 점포"] },
  { sido: "서울", sg: "중랑구", dong: "면목동", road: "서울 중랑구 면목로", lat: 37.5884, lng: 127.0875, places: ["면목동 다세대", "사가정역 식당", "면목동 주택"] },
  { sido: "서울", sg: "도봉구", dong: "창동", road: "서울 도봉구 노해로", lat: 37.6532, lng: 127.0474, places: ["창동 아파트", "창동역 상가", "쌍문동 인근 빌라"] },
  { sido: "서울", sg: "강동구", dong: "천호동", road: "서울 강동구 천호대로", lat: 37.5384, lng: 127.1235, places: ["천호동 아파트", "천호역 먹자골목 식당", "천호동 상가"] },
  { sido: "서울", sg: "동대문구", dong: "장안동", road: "서울 동대문구 장한로", lat: 37.5712, lng: 127.0676, places: ["장안동 빌라", "장한평역 인근 정비소 건물", "장안동 주택"] },
  { sido: "경기", sg: "수원시 팔달구", dong: "인계동", road: "경기 수원시 팔달구 권광로", lat: 37.2636, lng: 127.0286, places: ["인계동 음식점", "수원시청 인근 상가", "인계동 오피스텔"] },
  { sido: "경기", sg: "성남시 분당구", dong: "정자동", road: "경기 성남시 분당구 정자일로", lat: 37.3703, lng: 127.1062, places: ["정자동 오피스텔", "정자역 카페거리 상가", "분당 아파트"] },
  { sido: "경기", sg: "고양시 일산동구", dong: "장항동", road: "경기 고양시 일산동구 중앙로", lat: 37.6584, lng: 126.7702, places: ["장항동 빌라", "라페스타 인근 식당", "일산 아파트"] },
  { sido: "경기", sg: "용인시 수지구", dong: "죽전동", road: "경기 용인시 수지구 죽전로", lat: 37.3250, lng: 127.1076, places: ["죽전동 아파트", "죽전역 상가", "죽전 카페"] },
  { sido: "경기", sg: "부천시", dong: "중동", road: "경기 부천시 길주로", lat: 37.5035, lng: 126.7660, places: ["부천 중동 아파트", "부천시청역 상가", "중동 음식점"] },
  { sido: "경기", sg: "안양시 동안구", dong: "평촌동", road: "경기 안양시 동안구 평촌대로", lat: 37.3897, lng: 126.9519, places: ["평촌 학원가 상가", "평촌동 아파트", "범계역 식당"] },
  { sido: "경기", sg: "안산시 단원구", dong: "고잔동", road: "경기 안산시 단원구 광덕대로", lat: 37.3161, lng: 126.8308, places: ["고잔동 아파트", "안산 중앙역 상가", "고잔동 빌라"] },
  { sido: "경기", sg: "화성시", dong: "병점동", road: "경기 화성시 병점중앙로", lat: 37.2070, lng: 127.0333, places: ["병점동 아파트", "병점역 상가", "병점 카페"] },
  { sido: "경기", sg: "평택시", dong: "비전동", road: "경기 평택시 평남로", lat: 36.9921, lng: 127.1129, places: ["비전동 아파트", "평택역 인근 식당", "비전동 상가주택"] },
  { sido: "경기", sg: "의정부시", dong: "호원동", road: "경기 의정부시 평화로", lat: 37.7262, lng: 127.0453, places: ["호원동 아파트", "회룡역 상가", "호원동 빌라"] },
  { sido: "경기", sg: "남양주시", dong: "다산동", road: "경기 남양주시 다산중앙로", lat: 37.6204, lng: 127.1546, places: ["다산신도시 아파트", "다산동 상가", "다산동 카페"] },
  { sido: "경기", sg: "파주시", dong: "금촌동", road: "경기 파주시 금정로", lat: 37.7601, lng: 126.7768, places: ["금촌동 주택", "금촌역 상가", "파주 빌라"] },
  { sido: "경기", sg: "김포시", dong: "장기동", road: "경기 김포시 김포한강로", lat: 37.6440, lng: 126.6700, places: ["한강신도시 아파트", "장기동 상가", "김포 카페"] },
  { sido: "경기", sg: "광명시", dong: "철산동", road: "경기 광명시 철산로", lat: 37.4760, lng: 126.8679, places: ["철산동 아파트", "철산상업지구 식당", "철산동 빌라"] },
  { sido: "경기", sg: "하남시", dong: "신장동", road: "경기 하남시 신장로", lat: 37.5392, lng: 127.2148, places: ["하남 신장동 아파트", "스타필드 인근 상가", "신장동 주택"] },
  { sido: "경기", sg: "구리시", dong: "인창동", road: "경기 구리시 경춘로", lat: 37.6033, lng: 127.1414, places: ["인창동 아파트", "구리역 상가", "인창동 빌라"] },
];

// ─────────────────────────────────────────────
// 업체 30곳
// ─────────────────────────────────────────────
const SPECIALTIES = [
  "하수관 청소", "배관 막힘 해결", "정화조 청소", "배관 누수 수리",
  "우수관 청소", "펌프 설치/수리", "빗물받이 청소", "역류 차단기 설치",
];
const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권"];
const GIVEN = ["성호", "민재", "영수", "정훈", "상철", "도현", "재영", "병관", "동욱", "현석", "태웅", "기범", "용준", "석진", "광수", "진우", "명식", "철민"];

type Co = { name: string; slug: string; locIdx: number; status: ContractorStatus };
const A = ContractorStatus.ACTIVE;
const COMPANIES: Co[] = [
  { name: "서울배관공사", slug: "seoulpipe", locIdx: 0, status: A },
  { name: "홍대하수구클리닉", slug: "hdsugu", locIdx: 1, status: A },
  { name: "송파설비마트", slug: "songpasulbi", locIdx: 2, status: A },
  { name: "노원배수센터", slug: "nowonbae", locIdx: 3, status: A },
  { name: "강서종합설비", slug: "gangseosb", locIdx: 4, status: A },
  { name: "영등포펌프테크", slug: "ydppump", locIdx: 5, status: A },
  { name: "관악하수도119", slug: "gwanak119", locIdx: 6, status: A },
  { name: "성북드레인웍스", slug: "sbdrain", locIdx: 7, status: A },
  { name: "은평배관클리닉", slug: "epclinic", locIdx: 8, status: A },
  { name: "구로설비연구소", slug: "gurolab", locIdx: 9, status: A },
  { name: "중랑워터케어", slug: "jnwater", locIdx: 10, status: A },
  { name: "도봉종합배관", slug: "dbpipe", locIdx: 11, status: A },
  { name: "강동하수구센터", slug: "gdcenter", locIdx: 12, status: A },
  { name: "동대문설비", slug: "ddmsb", locIdx: 13, status: A },
  { name: "수원배관마스터즈", slug: "suwonmaster", locIdx: 14, status: A },
  { name: "분당클린배수", slug: "bundangclean", locIdx: 15, status: A },
  { name: "일산하수구연구소", slug: "ilsanlab", locIdx: 16, status: A },
  { name: "용인수지설비", slug: "sujisb", locIdx: 17, status: A },
  { name: "부천배관공작소", slug: "bucheonpipe", locIdx: 18, status: A },
  { name: "평촌파이프라인", slug: "pcpipe", locIdx: 19, status: A },
  { name: "안산종합하수", slug: "ansansu", locIdx: 20, status: A },
  { name: "화성배수솔루션", slug: "hwaseongsol", locIdx: 21, status: A },
  { name: "평택설비하우스", slug: "ptsb", locIdx: 22, status: A },
  { name: "의정부배관테크", slug: "ujbtech", locIdx: 23, status: A },
  { name: "남양주워터라인", slug: "nyjline", locIdx: 24, status: ContractorStatus.INACTIVE },
  { name: "파주하수구촌장", slug: "pajusugu", locIdx: 25, status: A },
  { name: "김포배관이야기", slug: "gimpopipe", locIdx: 26, status: ContractorStatus.REVIEWING },
  { name: "광명설비스테이션", slug: "gmstation", locIdx: 27, status: ContractorStatus.REVIEWING },
  { name: "하남클린워터", slug: "hanamcw", locIdx: 28, status: ContractorStatus.REVIEWING },
  { name: "구리배수탐정", slug: "guribae", locIdx: 29, status: ContractorStatus.INACTIVE },
];
const EMAIL_DOMAINS = ["naver.com", "daum.net", "gmail.com", "hanmail.net"];

// ─────────────────────────────────────────────
// 신고 내러티브 풀
// ─────────────────────────────────────────────
const DESCS: Record<IssueType, string[]> = {
  [IssueType.DRAIN]: [
    "싱크대 물이 점점 안 내려가더니 오늘은 거의 안 빠져요. 식기세척기 돌리면 물이 차올라요.",
    "욕실 바닥 배수구가 막혔는지 샤워하면 발목까지 물이 차요. 뚫어뻥으로는 안 됩니다.",
    "주방 배수가 느려서 트랩 열어봤는데 기름때가 심한 것 같아요. 전문 장비로 뚫어야 할 것 같습니다.",
    "세탁기 배수할 때마다 바닥 배수구로 물이 역류해서 올라와요. 호스 문제는 아닌 것 같아요.",
    "변기가 자주 막혀요. 일주일에 두세 번은 뚫는데 근본적으로 해결하고 싶습니다.",
    "가게 주방 트렌치가 막혀서 물이 고여 있어요. 영업 전에 처리 가능할까요?",
  ],
  [IssueType.SEWER_BACKFLOW]: [
    "1층 화장실에서 오수가 역류합니다. 냄새도 심하고 물 내리면 바닥으로 올라와요.",
    "지하 상가인데 비만 오면 하수구에서 물이 역류해요. 오늘도 바닥이 흥건합니다.",
    "건물 공용 배관 쪽 문제인지 저희 집이랑 아랫집 동시에 역류가 생겼어요.",
    "식당 바닥 배수구에서 오수가 올라와서 영업을 못 하고 있습니다. 빨리 와주실 수 있나요?",
    "원룸 화장실 배수구에서 까만 물이 올라와요. 어제부터 계속 그럽니다.",
  ],
  [IssueType.FLOOD]: [
    "지하주차장 배수구가 막혀서 물이 차오르고 있어요. 차량 침수될까 봐 급합니다.",
    "반지하 방에 물이 들어오기 시작했어요. 바깥 배수구가 역할을 못 하는 것 같아요.",
    "상가 지하 창고가 침수됐습니다. 배수 펌프가 작동을 안 하는 것 같아요.",
    "폭우 때문에 마당 배수구가 넘쳐서 현관까지 물이 들어왔어요.",
  ],
  [IssueType.ODOR]: [
    "며칠 전부터 화장실에서 하수구 냄새가 심하게 올라와요. 트랩에 물을 부어도 그대로예요.",
    "주방 싱크대 아래에서 악취가 나요. 배관 연결부가 문제인 것 같기도 하고요.",
    "원룸 전체에 하수구 냄새가 퍼져서 생활이 힘듭니다. 원인 점검 부탁드려요.",
    "가게에 손님들이 냄새난다고 해서요. 바닥 배수구 쪽인 것 같은데 봐주세요.",
  ],
  [IssueType.EMERGENCY]: [
    "식당 마감 중인데 주방 전체 배수가 갑자기 멈췄어요. 내일 오픈 전까지 꼭 해결해야 합니다.",
    "새벽인데 죄송합니다. 화장실 변기가 넘쳐서 집 안으로 물이 흐르고 있어요.",
    "건물 정화조 쪽에서 오수가 넘치고 있다고 관리인한테 연락 왔어요. 바로 가능할까요?",
  ],
  [IssueType.OTHER]: [
    "배관에서 밤마다 쿵쿵 소리가 나요. 수격 현상인지 점검받고 싶습니다.",
    "이사 전에 배관 전체 점검이랑 고압세척 견적 받고 싶어요.",
    "빗물받이에 흙이랑 낙엽이 쌓여서 청소가 필요합니다.",
    "그리스트랩 정기 청소 업체를 찾고 있어요. 월 1회 가능할까요?",
  ],
};
const PLACES_DETAIL = ["101동 1203호", "201동 302호", "지하 1층", "1층 주방", "2층 화장실", "B동 반지하", "상가 103호", "본관 지하", "3층 302호", ""];
const WORK_NOTES_ARRIVE = ["현장 도착, 내시경으로 막힌 구간 확인", "도착해서 상태 점검 중입니다", "현장 확인 — 트랩 하부 이물질 추정", "도착. 고압세척 장비 준비"];
const WORK_NOTES_DONE = [
  "스프링 관통 후 고압세척 완료. 배수 정상 확인했습니다.",
  "기름때 제거 및 관로 세척 완료. 재발 방지 안내 드렸습니다.",
  "이물질(물티슈) 제거 완료. 정상 배수 확인.",
  "배관 스케일 제거 후 내시경 재확인까지 마쳤습니다.",
  "트랩 분해 청소 및 재조립 완료. 누수 없음 확인.",
];
const REJECT_DETAILS: Record<string, string[]> = {
  TOO_FAR: ["현재 현장이 반대 방향이라 어렵습니다", "이동 1시간 이상 걸려서 불가합니다"],
  NO_TIME: ["오늘 예약 마감입니다", "진행 중인 작업이 늦어져서 어렵습니다"],
  NO_EQUIPMENT: ["고압세척차가 수리 중입니다", "해당 구경 장비가 없습니다"],
  NOT_SPECIALTY: ["정화조는 취급하지 않습니다", "건물 메인관은 저희 범위가 아닙니다"],
  OTHER: ["개인 사정으로 오늘은 어렵습니다", ""],
};
const PRICE_RANGE: Record<IssueType, [number, number]> = {
  [IssueType.DRAIN]: [6, 15],
  [IssueType.SEWER_BACKFLOW]: [8, 20],
  [IssueType.FLOOD]: [15, 35],
  [IssueType.ODOR]: [5, 12],
  [IssueType.EMERGENCY]: [12, 30],
  [IssueType.OTHER]: [5, 15],
};
const ADMIN_FIX_REASONS = ["고객 통화로 증상 재확인", "사진 확인 결과 유형 상이", "현장 설명과 설명이 달라 수정", "AI 분류 오류 수정"];

const KAKAO_THREAD = (place: string) => [
  { s: SenderType.CUSTOMER, c: "안녕하세요 하수구 막힘 문의드려요" },
  { s: SenderType.ADMIN, c: "안녕하세요, 하수구랩입니다. 어느 위치인지와 증상을 알려주시겠어요?" },
  { s: SenderType.CUSTOMER, c: `${place} 인데요, 물이 거의 안 내려가요` },
  { s: SenderType.ADMIN, c: "확인 감사합니다. 언제부터 그러셨을까요? 다른 배수구도 같이 막혔나요?" },
  { s: SenderType.CUSTOMER, c: "어제 저녁부터요. 다른 데는 괜찮아요" },
  { s: SenderType.ADMIN, c: "접수 도와드렸습니다. 담당 업체 배정되면 연락처로 안내드릴게요." },
];

const AI_CALL_SCRIPT = (place: string, symptom: string) => [
  `상담원: 안녕하세요, 하수구랩 AI 상담입니다. 어떤 문제로 전화 주셨나요?`,
  `고객: ${place}인데요, ${symptom}`,
  `상담원: 불편하셨겠네요. 정확한 주소와 연락 가능한 번호를 말씀해 주시겠어요?`,
  `고객: 주소는 문자로 보내드릴게요. 이 번호로 연락 주세요.`,
  `상담원: 네, 접수 도와드리겠습니다. 증상이 언제부터 시작됐는지 알려주실 수 있을까요?`,
  `고객: 오늘 아침부터요. 좀 급해요.`,
  `상담원: 확인했습니다. 담당 업체가 배정되는 대로 바로 연락드리겠습니다. 접수번호는 문자로 발송됩니다.`,
].join("\n");

// ─────────────────────────────────────────────
// 유틸: 지역코드 해석
// ─────────────────────────────────────────────
async function resolveRegion(loc: Loc): Promise<{ dongCode: string | null; sgCode: string | null }> {
  const token = loc.sg.split(" ").pop()!; // "수원시 팔달구" → "팔달구"
  // 부천시·화성시처럼 "시 직할" 아래에 동이 없고 구 단위에 있는 경우가 있어
  // 후보 시군구를 전부 순회하며 동이 실제로 있는 곳을 고른다.
  const candidates = await prisma.region.findMany({
    where: { level: 2, name: { contains: token }, sido: { contains: loc.sido } },
    orderBy: { code: "asc" },
  });
  for (const sg of candidates) {
    const dong = await prisma.region.findFirst({
      where: { level: 3, code: { startsWith: sg.code.slice(0, 5) }, name: { endsWith: loc.dong } },
    });
    if (dong) return { dongCode: dong.code, sgCode: sg.code };
  }
  for (const sg of candidates) {
    const anyDong = await prisma.region.findFirst({
      where: { level: 3, code: { startsWith: sg.code.slice(0, 5) } },
    });
    if (anyDong) return { dongCode: anyDong.code, sgCode: sg.code };
  }
  return { dongCode: null, sgCode: candidates[0]?.code ?? null };
}

// ─────────────────────────────────────────────
// 정리 (sr-* 재실행 멱등 / --purge-demo 시 demo도)
// ─────────────────────────────────────────────
async function purge(prefixes: string[], label: string) {
  const reportWhere = {
    OR: [
      ...prefixes.map((p) => ({ id: { startsWith: p } })),
      ...(label === "demo" ? [{ reportNo: { startsWith: "BD-SEED-" } }] : []),
    ],
  };
  const reports = await prisma.report.findMany({ where: reportWhere, select: { id: true } });
  const ids = reports.map((r) => r.id);
  if (ids.length) {
    await prisma.messageTemplateUsage.deleteMany({ where: { reportId: { in: ids } } });
    await prisma.bid.deleteMany({ where: { reportId: { in: ids } } });
    await prisma.aiCall.deleteMany({ where: { reportId: { in: ids } } });
    await prisma.report.deleteMany({ where: { id: { in: ids } } });
  }
  // sr- AiCall(신고 미연결 통화)
  await prisma.aiCall.deleteMany({ where: { id: { startsWith: prefixes[0] } } });
  const coWhere = { id: { startsWith: `${prefixes[0]}cc-` } };
  const demoCoWhere = { id: { startsWith: "demo-cc-" } };
  const target = label === "demo" ? demoCoWhere : coWhere;
  const cos = await prisma.contractorCompany.findMany({ where: target, select: { id: true, accountId: true } });
  if (cos.length) {
    const coIds = cos.map((c) => c.id);
    await prisma.bid.deleteMany({ where: { contractorCompanyId: { in: coIds } } });
    await prisma.contractorServiceArea.deleteMany({ where: { contractorCompanyId: { in: coIds } } });
    await prisma.contractorCompany.deleteMany({ where: { id: { in: coIds } } });
    await prisma.contractorAccount.deleteMany({ where: { id: { in: cos.map((c) => c.accountId) } } });
  }
  await prisma.customer.deleteMany({
    where: { id: { startsWith: label === "demo" ? "demo-cust" : `${prefixes[0]}cust-` } },
  });
  console.log(`· ${label} 정리: 신고 ${ids.length}건, 업체 ${cos.length}곳 삭제`);
}

// ─────────────────────────────────────────────
// Supabase 로그인 (앞 3개 업체만)
// ─────────────────────────────────────────────
async function ensureAuthUser(supabase: SupabaseClient, email: string, name: string, phone: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: PARTNER_PASSWORD, email_confirm: true,
    user_metadata: { name, phone, role: "contractor" },
  });
  if (!error) return data.user?.id ?? null;
  if (error.message.toLowerCase().includes("already")) {
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const u = list?.users.find((x) => x.email === email);
    if (u) {
      await supabase.auth.admin.updateUserById(u.id, { password: PARTNER_PASSWORD });
      return u.id;
    }
  }
  console.log(`  ⚠️ auth 실패(${email}): ${error.message}`);
  return null;
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
async function main() {
  const dbHost = new URL(process.env.DATABASE_URL!).hostname;
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "(기본)";
  console.log(`대상 DB: ${dbHost} / schema=${schema}\n`);

  await purge(["sr-"], "sr(이전 실행분)");
  if (PURGE_DEMO) await purge(["demo-"], "demo");

  // 지역코드 해석
  console.log("· 지역코드 해석…");
  const regions = await Promise.all(LOCS.map(resolveRegion));
  const okRegions = regions.filter((r) => r.dongCode).length;
  console.log(`  법정동 매칭 ${okRegions}/${LOCS.length}`);

  // ── 업체 30곳 ──
  console.log("· 업체 30곳 생성…");
  const usedBiz = new Set<string>();
  const bizNo = () => {
    let v = "";
    do { v = `${ri(100, 899)}-${pad(ri(10, 99))}-${ri(10000, 99999)}`; } while (usedBiz.has(v));
    usedBiz.add(v); return v;
  };
  for (let i = 0; i < COMPANIES.length; i++) {
    const c = COMPANIES[i];
    const loc = LOCS[c.locIdx];
    const rep = pick(SURNAMES) + pick(GIVEN);
    const email = `${c.slug}${ri(1, 99)}@${pick(EMAIL_DOMAINS)}`;
    const phone = `010-${ri(2000, 9899)}-${ri(1000, 9999)}`;
    const createdDays = ri(20, 75);
    const specCount = ri(2, 4);
    const spec = [...SPECIALTIES].sort(() => rand() - 0.5).slice(0, specCount);
    // 담당 지역: 본거지 + 인접(풀 내 이웃 인덱스) 0~2곳
    const areaIdx = new Set<number>([c.locIdx]);
    const extra = ri(0, 2);
    for (let k = 0; k < extra; k++) areaIdx.add((c.locIdx + k + 1) % LOCS.length);
    const approved = c.status === ContractorStatus.ACTIVE || c.status === ContractorStatus.INACTIVE;

    await prisma.contractorAccount.create({
      data: {
        id: `sr-ca-${pad(i + 1, 2)}`,
        email, name: rep, phone,
        createdAt: kst(createdDays, ri(9, 18), ri(0, 59)),
        company: {
          create: {
            id: `sr-cc-${pad(i + 1, 2)}`,
            companyName: c.name,
            representativeName: rep,
            businessNumber: bizNo(),
            address: `${loc.road} ${ri(10, 300)}`,
            latitude: loc.lat + (rand() - 0.5) * 0.01,
            longitude: loc.lng + (rand() - 0.5) * 0.01,
            serviceRegions: [loc.sido === "서울" ? "서울" : "경기"],
            yearsOfExperience: ri(2, 27),
            specialties: spec,
            description: `${loc.sg} 일대에서 ${ri(2, 27)}년째 배관·하수 작업을 하고 있습니다. ${spec[0]} 전문입니다.`,
            status: c.status,
            statusReason: c.status === ContractorStatus.INACTIVE ? "장기 미응답" : null,
            approvedAt: approved ? kst(createdDays - ri(1, 5), ri(10, 17), ri(0, 59)) : null,
            createdAt: kst(createdDays, ri(9, 18), ri(0, 59)),
            serviceAreas: {
              create: [...areaIdx]
                .filter((idx) => regions[idx].sgCode)
                .map((idx) => ({
                  regionCode: regions[idx].sgCode!,
                  regionName: `${LOCS[idx].sido} ${LOCS[idx].sg}`,
                })),
            },
          },
        },
      },
    });
  }

  // Supabase 로그인 (앞 3곳)
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const loginEmails: string[] = [];
  if (supabaseUrl && serviceKey) {
    console.log("· 파트너 로그인 3개 생성…");
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    for (let i = 0; i < 3; i++) {
      const acc = await prisma.contractorAccount.findUnique({ where: { id: `sr-ca-${pad(i + 1, 2)}` } });
      if (!acc) continue;
      const uid = await ensureAuthUser(supabase, acc.email, acc.name, acc.phone);
      if (uid) {
        await prisma.contractorAccount.update({ where: { id: acc.id }, data: { authUserId: uid } });
        loginEmails.push(acc.email);
      }
    }
  } else {
    console.log("· ⚠️ SUPABASE_URL/SERVICE_ROLE_KEY 없음 → 파트너 로그인 생성 생략");
  }

  // ── 고객 50명 ──
  console.log("· 고객 50명 생성…");
  for (let i = 0; i < 50; i++) {
    await prisma.customer.create({
      data: {
        id: `sr-cust-${pad(i + 1, 2)}`,
        phone: `010-99${pad(ri(0, 99))}-${pad(1000 + i * 73 + ri(0, 50), 4)}`,
        createdAt: kst(ri(5, 60), ri(8, 22), ri(0, 59)),
      },
    });
  }

  // ── 신고 80건 ──
  console.log("· 신고 80건 생성…");
  // 라이프사이클 배열 (순서 섞음)
  type Stage = "resolved" | "inprogress" | "dispatched" | "scheduled" | "assigned" | "offering" | "awaiting" | "review" | "analyzed" | "collecting" | "hold" | "canceled" | "rejected";
  const stages: Stage[] = [
    ...Array(38).fill("resolved"),
    ...Array(6).fill("inprogress"), ...Array(3).fill("dispatched"), ...Array(3).fill("scheduled"), ...Array(4).fill("assigned"),
    ...Array(5).fill("offering"), ...Array(3).fill("awaiting"),
    ...Array(6).fill("review"), ...Array(2).fill("analyzed"), ...Array(1).fill("collecting"),
    ...Array(4).fill("hold"), ...Array(3).fill("canceled"), ...Array(2).fill("rejected"),
  ];
  stages.sort(() => rand() - 0.5);

  const channels: ReportChannel[] = [
    ...Array(48).fill(ReportChannel.WEB),
    ...Array(12).fill(ReportChannel.AI_CALL),
    ...Array(12).fill(ReportChannel.KAKAO),
    ...Array(8).fill(ReportChannel.PHONE),
  ];
  channels.sort(() => rand() - 0.5);

  const ISSUES = [IssueType.DRAIN, IssueType.DRAIN, IssueType.DRAIN, IssueType.SEWER_BACKFLOW, IssueType.SEWER_BACKFLOW, IssueType.ODOR, IssueType.FLOOD, IssueType.EMERGENCY, IssueType.OTHER];
  const HOURS_NORMAL = [9, 9, 10, 10, 11, 11, 13, 13, 14, 14, 15, 16, 17, 8, 12, 18, 19, 20];
  const HOURS_EMERG = [22, 23, 0, 1, 2, 5, 6, 7, 21];
  const usedReportNo = new Set<string>();
  const activeCompanyIdx = COMPANIES.map((c, i) => ({ c, i })).filter((x) => x.c.status === ContractorStatus.ACTIVE).map((x) => x.i);

  let misIssue = 0, misUrg = 0, aiCallCount = 0, offerCount = 0;

  for (let n = 0; n < 80; n++) {
    const stage = stages[n];
    const channel = channels[n];
    const locIdx = ri(0, LOCS.length - 1);
    const loc = LOCS[locIdx];
    const issue = pick(ISSUES);
    const urgency = issue === IssueType.EMERGENCY ? Urgency.EMERGENCY
      : issue === IssueType.FLOOD ? (rand() < 0.6 ? Urgency.EMERGENCY : Urgency.URGENT)
      : issue === IssueType.SEWER_BACKFLOW ? (rand() < 0.5 ? Urgency.URGENT : Urgency.NORMAL)
      : rand() < 0.12 ? Urgency.URGENT : Urgency.NORMAL;

    // 생성 시각: 해결류는 과거, 진행류는 최근
    const dRange: [number, number] =
      stage === "resolved" ? [4, 58]
      : stage === "hold" || stage === "canceled" || stage === "rejected" ? [3, 40]
      : stage === "inprogress" || stage === "dispatched" || stage === "scheduled" || stage === "assigned" ? [0, 6]
      : stage === "offering" ? [0, 1]
      : [0, 3];
    let day = ri(dRange[0], dRange[1]);
    // 주말 절반 감소
    const tmp = new Date(Date.now() - day * 86400000);
    if ((tmp.getDay() === 0 || tmp.getDay() === 6) && rand() < 0.5) day = Math.max(dRange[0], day - 2);
    const hour = urgency === Urgency.EMERGENCY && rand() < 0.5 ? pick(HOURS_EMERG) : pick(HOURS_NORMAL);
    const createdAt = kst(day, hour, ri(0, 59));

    // reportNo: BD-YYYYMMDD-####
    const k = new Date(createdAt.getTime() + 9 * 3600000);
    const dateStr = `${k.getUTCFullYear()}${pad(k.getUTCMonth() + 1)}${pad(k.getUTCDate())}`;
    let reportNo = "";
    do { reportNo = `BD-${dateStr}-${pad(ri(1000, 9999), 4)}`; } while (usedReportNo.has(reportNo));
    usedReportNo.add(reportNo);

    const custId = `sr-cust-${pad(ri(1, 50), 2)}`;
    const cust = await prisma.customer.findUnique({ where: { id: custId } });
    const desc = pick(DESCS[issue]);
    const place = pick(loc.places);
    const detail = pick(PLACES_DETAIL);
    const summary = `${place.replace(/ /g, " ")} ${
      issue === IssueType.DRAIN ? "배수구 막힘" : issue === IssueType.SEWER_BACKFLOW ? "하수 역류"
      : issue === IssueType.FLOOD ? "침수" : issue === IssueType.ODOR ? "하수구 악취"
      : issue === IssueType.EMERGENCY ? "긴급 배수 문제" : "배관 점검"}`;

    // 상태 매핑
    const statusMap: Record<Stage, ReportStatus> = {
      resolved: ReportStatus.RESOLVED, inprogress: ReportStatus.IN_PROGRESS, dispatched: ReportStatus.DISPATCHED,
      scheduled: ReportStatus.DISPATCH_SCHEDULED, assigned: ReportStatus.ASSIGNED, offering: ReportStatus.BIDDING,
      awaiting: ReportStatus.AWAITING_ASSIGNMENT, review: ReportStatus.ADMIN_REVIEW, analyzed: ReportStatus.AI_ANALYZED,
      collecting: ReportStatus.COLLECTING_INFO, hold: ReportStatus.ON_HOLD, canceled: ReportStatus.CANCELED, rejected: ReportStatus.REJECTED,
    };
    const status = statusMap[stage];
    const approvedOffset = ri(25, 110); // 접수→승인 분
    const adminApprovedAt = ["resolved", "inprogress", "dispatched", "scheduled", "assigned", "offering", "awaiting", "hold"].includes(stage)
      ? addMin(createdAt, approvedOffset) : null;

    const report = await prisma.report.create({
      data: {
        id: `sr-rp-${pad(n + 1, 2)}`,
        reportNo,
        verificationCode: String(ri(100000, 999999)),
        customerId: custId,
        channel, status, issueType: issue, urgency, summary,
        description: desc,
        customerPhone: cust!.phone,
        addressText: `${loc.sido === "서울" ? "서울특별시" : "경기도"} ${loc.sg} ${loc.dong}`,
        addressDetail: detail || null,
        roadAddressText: `${loc.road} ${ri(5, 280)}`,
        placeName: place,
        latitude: loc.lat + (rand() - 0.5) * 0.012,
        longitude: loc.lng + (rand() - 0.5) * 0.012,
        regionCode: regions[locIdx].dongCode,
        locationConfirmedAt: createdAt,
        adminApprovedAt,
        createdAt,
      },
    });

    // AI 분석 (전 건)
    const conf = 0.62 + rand() * 0.35;
    const wrongIssue = rand() < 0.14;
    const wrongUrg = !wrongIssue && rand() < 0.08;
    const aiIssue = wrongIssue ? pick(ISSUES.filter((t) => t !== issue)) : issue;
    const aiUrg = wrongUrg ? pick([Urgency.NORMAL, Urgency.URGENT, Urgency.EMERGENCY].filter((u) => u !== urgency)) : urgency;
    await prisma.aiAnalysis.create({
      data: {
        reportId: report.id,
        provider: rand() < 0.5 ? AiProvider.OPENAI : AiProvider.GEMINI,
        model: rand() < 0.5 ? "gpt-4o-mini" : "gemini-2.0-flash",
        summary,
        issueType: aiIssue,
        urgency: aiUrg,
        missingFields: rand() < 0.2 ? ["상세 주소"] : [],
        vendorDescription: `${loc.sg} ${place}. ${desc.slice(0, 40)}… 현장 확인 후 ${issue === IssueType.FLOOD ? "배수 및 원인 제거" : "관통/세척"} 필요.`,
        confidence: Math.round(conf * 1000) / 1000,
        needsReview: false,
        createdAt: addMin(createdAt, 1),
      },
    });

    // 오분류 → 관리자 수정 이력 (검수 지난 건만)
    if (adminApprovedAt && (wrongIssue || wrongUrg)) {
      await prisma.reportRevision.create({
        data: {
          reportId: report.id,
          editorType: ActorType.ADMIN,
          fieldName: wrongIssue ? "issueType" : "urgency",
          oldValue: wrongIssue ? aiIssue : aiUrg,
          newValue: wrongIssue ? issue : urgency,
          reason: pick(ADMIN_FIX_REASONS),
          createdAt: addMin(createdAt, approvedOffset - ri(2, 10)),
        },
      });
      wrongIssue ? misIssue++ : misUrg++;
    }

    // 상태 이력
    const hist: { to: ReportStatus; at: Date; actor: ActorType; reason?: string }[] = [
      { to: ReportStatus.COLLECTING_INFO, at: createdAt, actor: ActorType.CUSTOMER },
      { to: ReportStatus.AI_ANALYZED, at: addMin(createdAt, 1), actor: ActorType.AI },
    ];
    if (!["collecting"].includes(stage)) hist.push({ to: ReportStatus.ADMIN_REVIEW, at: addMin(createdAt, 2), actor: ActorType.AI });
    if (adminApprovedAt) hist.push({ to: ReportStatus.AWAITING_ASSIGNMENT, at: adminApprovedAt, actor: ActorType.ADMIN, reason: "관리자 배분 승인" });

    // ── 배분/배정/작업 ──
    const needAssign = ["resolved", "inprogress", "dispatched", "scheduled", "assigned"].includes(stage);
    if (needAssign || stage === "offering" || stage === "hold") {
      // 담당 업체: 같은 시군구 담당 우선, 없으면 활성 아무 곳
      const sgCode = regions[locIdx].sgCode;
      const coveringIdx = activeCompanyIdx.filter((ci) => {
        const base = COMPANIES[ci].locIdx;
        return base === locIdx || regions[base]?.sgCode === sgCode;
      });
      const pool = coveringIdx.length ? coveringIdx : activeCompanyIdx;
      const firstIdx = pick(pool);
      const secondIdx = pick(activeCompanyIdx.filter((x) => x !== firstIdx));
      const offerBase = adminApprovedAt ?? addMin(createdAt, approvedOffset);

      if (stage === "offering") {
        await prisma.assignmentOffer.create({
          data: {
            reportId: report.id, contractorCompanyId: `sr-cc-${pad(firstIdx + 1, 2)}`,
            sequence: 1, distanceKm: Math.round((0.8 + rand() * 9) * 100) / 100,
            status: OfferStatus.OFFERED,
            offeredAt: offerBase, deadline: addMin(offerBase, 30), createdAt: offerBase,
          },
        });
        hist.push({ to: ReportStatus.BIDDING, at: offerBase, actor: ActorType.SYSTEM, reason: "거리순 1순위 제안" });
        offerCount++;
      } else if (stage === "hold") {
        // 1~2곳 거절/무응답 후 보류
        const rejCount = ri(1, 2);
        for (let s = 0; s < rejCount; s++) {
          const coIdx = s === 0 ? firstIdx : secondIdx;
          const isTimeout = rand() < 0.35;
          const reason = isTimeout ? null : pick([RejectReason.TOO_FAR, RejectReason.NO_TIME, RejectReason.NO_EQUIPMENT, RejectReason.NOT_SPECIALTY, RejectReason.OTHER]);
          const oAt = addMin(offerBase, s * 32);
          await prisma.assignmentOffer.create({
            data: {
              reportId: report.id, contractorCompanyId: `sr-cc-${pad(coIdx + 1, 2)}`,
              sequence: s + 1, distanceKm: Math.round((1 + rand() * 12) * 100) / 100,
              status: isTimeout ? OfferStatus.TIMEOUT : OfferStatus.REJECTED,
              rejectReason: reason,
              rejectReasonDetail: reason ? pick(REJECT_DETAILS[reason]) || null : null,
              offeredAt: oAt, deadline: addMin(oAt, 30),
              respondedAt: isTimeout ? addMin(oAt, 30) : addMin(oAt, ri(4, 25)),
              createdAt: oAt,
            },
          });
          offerCount++;
        }
        hist.push({ to: ReportStatus.ON_HOLD, at: addMin(offerBase, rejCount * 32 + 2), actor: ActorType.SYSTEM, reason: "담당 지역 업체가 모두 응답하지 않음" });
      } else if (needAssign) {
        // 70% 1순위 수락 / 30% 1순위 거절·무응답 → 2순위 수락
        const firstRejected = rand() < 0.3;
        let acceptedOfferId = "";
        let acceptedCoIdx = firstIdx;
        let acceptAt = addMin(offerBase, ri(4, 38));
        if (firstRejected) {
          const isTimeout = rand() < 0.4;
          const reason = isTimeout ? null : pick([RejectReason.TOO_FAR, RejectReason.NO_TIME, RejectReason.NO_EQUIPMENT, RejectReason.OTHER]);
          await prisma.assignmentOffer.create({
            data: {
              reportId: report.id, contractorCompanyId: `sr-cc-${pad(firstIdx + 1, 2)}`,
              sequence: 1, distanceKm: Math.round((1 + rand() * 8) * 100) / 100,
              status: isTimeout ? OfferStatus.TIMEOUT : OfferStatus.REJECTED,
              rejectReason: reason,
              rejectReasonDetail: reason ? pick(REJECT_DETAILS[reason]) || null : null,
              offeredAt: offerBase, deadline: addMin(offerBase, 30),
              respondedAt: isTimeout ? addMin(offerBase, 30) : addMin(offerBase, ri(5, 22)),
              createdAt: offerBase,
            },
          });
          offerCount++;
          acceptedCoIdx = secondIdx;
          const o2At = addMin(offerBase, 32);
          acceptAt = addMin(o2At, ri(4, 30));
          const o2 = await prisma.assignmentOffer.create({
            data: {
              reportId: report.id, contractorCompanyId: `sr-cc-${pad(secondIdx + 1, 2)}`,
              sequence: 2, distanceKm: Math.round((2 + rand() * 11) * 100) / 100,
              status: OfferStatus.ACCEPTED,
              offeredAt: o2At, deadline: addMin(o2At, 30), respondedAt: acceptAt, createdAt: o2At,
            },
          });
          acceptedOfferId = o2.id;
        } else {
          const o1 = await prisma.assignmentOffer.create({
            data: {
              reportId: report.id, contractorCompanyId: `sr-cc-${pad(firstIdx + 1, 2)}`,
              sequence: 1, distanceKm: Math.round((0.8 + rand() * 7) * 100) / 100,
              status: OfferStatus.ACCEPTED,
              offeredAt: offerBase, deadline: addMin(offerBase, 30), respondedAt: acceptAt, createdAt: offerBase,
            },
          });
          acceptedOfferId = o1.id;
        }
        offerCount++;

        const coId = `sr-cc-${pad(acceptedCoIdx + 1, 2)}`;
        const assignment = await prisma.assignment.create({
          data: {
            reportId: report.id, offerId: acceptedOfferId, contractorCompanyId: coId,
            selectionReason: firstRejected ? "거리순 2순위 수락" : "거리순 1순위 수락",
            customerMessageRendered: `${COMPANIES[acceptedCoIdx].name}이(가) 배정되었습니다. 곧 연락드립니다.`,
            assignedAt: acceptAt, createdAt: acceptAt,
          },
        });
        await prisma.report.update({ where: { id: report.id }, data: { assignedAt: acceptAt } });
        hist.push({ to: ReportStatus.ASSIGNED, at: acceptAt, actor: ActorType.CONTRACTOR, reason: "업체 수락" });

        // 작업 타임라인
        const steps: { st: WorkStatus; at: Date; note?: string; price?: number }[] = [];
        const schedAt = addMin(acceptAt, ri(10, 60));
        steps.push({ st: WorkStatus.DISPATCH_SCHEDULED, at: schedAt, note: `방문 일정 확정 (${pick(["오늘", "내일"])} ${ri(9, 18)}시경)` });
        if (["resolved", "inprogress", "dispatched"].includes(stage)) {
          steps.push({ st: WorkStatus.DISPATCHED, at: addMin(schedAt, ri(30, 240)), note: pick(WORK_NOTES_ARRIVE) });
        }
        if (["resolved", "inprogress"].includes(stage)) {
          steps.push({ st: WorkStatus.IN_PROGRESS, at: addMin(schedAt, ri(60, 300)), note: "작업 진행 중" });
        }
        if (stage === "resolved") {
          const [lo, hi] = PRICE_RANGE[issue];
          const price = ri(lo, hi) * 10000 + (rand() < 0.3 ? 5000 : 0);
          const doneAt = addMin(schedAt, ri(120, 420));
          steps.push({ st: WorkStatus.RESOLVED, at: doneAt, note: pick(WORK_NOTES_DONE), price });
          await prisma.report.update({ where: { id: report.id }, data: { resolvedAt: doneAt } });
          hist.push({ to: ReportStatus.RESOLVED, at: doneAt, actor: ActorType.CONTRACTOR });
        }
        for (const s of steps) {
          await prisma.workUpdate.create({
            data: {
              reportId: report.id, assignmentId: assignment.id, contractorCompanyId: coId,
              status: s.st, note: s.note ?? null, finalPrice: s.price ?? null, createdAt: s.at,
            },
          });
        }
      }
    }

    if (stage === "canceled") hist.push({ to: ReportStatus.CANCELED, at: addMin(createdAt, ri(40, 600)), actor: ActorType.CUSTOMER, reason: "고객 취소 요청" });
    if (stage === "rejected") hist.push({ to: ReportStatus.REJECTED, at: addMin(createdAt, ri(30, 180)), actor: ActorType.ADMIN, reason: pick(["중복 접수", "서비스 범위 외 요청"]) });

    for (const h of hist) {
      await prisma.reportStatusHistory.create({
        data: { reportId: report.id, toStatus: h.to, actorType: h.actor, reason: h.reason ?? null, createdAt: h.at },
      });
    }

    // ── 채널별 부가 데이터 ──
    if (channel === ReportChannel.KAKAO) {
      let t = addMin(createdAt, -ri(5, 20));
      for (const m of KAKAO_THREAD(place)) {
        t = addMin(t, ri(1, 4));
        await prisma.reportMessage.create({
          data: { reportId: report.id, senderType: m.s, content: m.c, createdAt: t },
        });
      }
    } else if (channel === ReportChannel.AI_CALL) {
      aiCallCount++;
      const dur = ri(80, 260);
      const callStart = addMin(createdAt, -Math.ceil(dur / 60) - 1);
      await prisma.aiCall.create({
        data: {
          id: `sr-call-${pad(aiCallCount, 2)}`,
          externalCallId: `sr-ext-${Date.now()}-${n}`,
          fromNumber: cust!.phone, toNumber: "02-6083-0020",
          status: "ENDED", startedAt: callStart, endedAt: addMin(callStart, Math.ceil(dur / 60)),
          durationSec: dur,
          transcriptText: AI_CALL_SCRIPT(place, desc.split(".")[0]),
          summary: `${loc.sg} ${place} — ${summary}`,
          reportId: report.id,
          createdAt: callStart,
          events: {
            create: [
              { type: "call_start", payload: { from: cust!.phone }, createdAt: callStart },
              { type: "call_end", payload: { durationSec: dur }, createdAt: addMin(callStart, Math.ceil(dur / 60)) },
            ],
          },
        },
      });
    } else if (rand() < 0.3) {
      // 웹 접수 일부: AI 안내 + 고객 답변
      await prisma.reportMessage.create({
        data: { reportId: report.id, senderType: SenderType.AI, content: "접수가 완료되었습니다. 추가로 현장 사진을 보내주시면 배정이 빨라집니다.", createdAt: addMin(createdAt, 2) },
      });
      if (rand() < 0.5) {
        await prisma.reportMessage.create({
          data: { reportId: report.id, senderType: SenderType.CUSTOMER, content: pick(["사진은 현장에서 보여드릴게요", "연락 기다리겠습니다", "가능하면 오늘 중으로 부탁드려요"]), createdAt: addMin(createdAt, ri(5, 30)) },
        });
      }
    }
  }

  // 신고 미연결 AI 통화 4건 (문의만 하고 끊은 콜)
  console.log("· 미연결 AI 통화 4건…");
  for (let i = 0; i < 4; i++) {
    const loc = pick(LOCS);
    const failed = i === 3;
    const dur = failed ? ri(5, 20) : ri(35, 120);
    const start = kst(ri(0, 20), pick([10, 11, 14, 16, 19, 21]), ri(0, 59));
    await prisma.aiCall.create({
      data: {
        id: `sr-call-x${i + 1}`,
        externalCallId: `sr-ext-x-${Date.now()}-${i}`,
        fromNumber: `010-${ri(2000, 9899)}-${ri(1000, 9999)}`, toNumber: "02-6083-0020",
        status: failed ? "FAILED" : "ENDED",
        startedAt: start, endedAt: addMin(start, Math.ceil(dur / 60)), durationSec: dur,
        transcriptText: failed ? null : `상담원: 안녕하세요, 하수구랩입니다.\n고객: ${loc.sg} 쪽인데 출장비가 얼마나 하나요?\n상담원: 현장 확인 후 작업 범위에 따라 안내드리고 있습니다. 접수 도와드릴까요?\n고객: 아니요, 일단 알아보고 다시 전화할게요.`,
        summary: failed ? "통화 연결 실패" : `${loc.sg} 비용 문의 후 종료 (접수 미진행)`,
        createdAt: start,
      },
    });
  }

  // ── 요약 출력 ──
  const [rc, cc2, oc, ac, wc, mc, aic] = await Promise.all([
    prisma.report.count({ where: { id: { startsWith: "sr-" } } }),
    prisma.contractorCompany.count({ where: { id: { startsWith: "sr-" } } }),
    prisma.assignmentOffer.count({ where: { report: { id: { startsWith: "sr-" } } } }),
    prisma.assignment.count({ where: { report: { id: { startsWith: "sr-" } } } }),
    prisma.workUpdate.count({ where: { report: { id: { startsWith: "sr-" } } } }),
    prisma.reportMessage.count({ where: { report: { id: { startsWith: "sr-" } } } }),
    prisma.aiCall.count({ where: { id: { startsWith: "sr-" } } }),
  ]);
  console.log("\n✅ 완료");
  console.log(`   업체 ${cc2} / 신고 ${rc} / 제안 ${oc}(${offerCount}) / 배정 ${ac} / 작업로그 ${wc} / 메시지 ${mc} / AI통화 ${aic}`);
  console.log(`   오분류: 유형 ${misIssue} + 긴급도 ${misUrg}`);
  if (loginEmails.length) {
    console.log(`   파트너 로그인 (비번 ${PARTNER_PASSWORD}):`);
    loginEmails.forEach((e) => console.log(`     - ${e}`));
  }
}

main()
  .catch((e) => { console.error("실패:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
