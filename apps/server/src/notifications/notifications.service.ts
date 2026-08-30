import { Injectable } from "@nestjs/common";
import { EmailProvider } from "./providers/email.provider";
import { PushProvider } from "./providers/push.provider";
import { SmsProvider } from "./providers/sms.provider";
import { TelegramProvider } from "./providers/telegram.provider";
import { RejectReason } from "../generated/prisma/client";

const REJECT_REASON_LABEL: Record<string, string> = {
  TOO_FAR: "거리가 멈",
  NO_TIME: "시간이 없음",
  NO_EQUIPMENT: "장비가 없음",
  NOT_SPECIALTY: "전문 분야가 아님",
  OTHER: "기타"
};

type ContractorContact = {
  email: string;
  phone: string;
  companyName: string;
  pushTokens?: string[];
};

type AssignmentInfo = {
  reportNo: string;
  issueSummary: string;
  estimatedPrice: string;
  availableTime: string;
};

type CustomerContact = {
  phone: string;
  pushTokens?: string[];
};

/**
 * 도메인 이벤트별 알림 오케스트레이션.
 * 각 채널(메일/문자/푸시)은 미설정 시 안전하게 건너뛴다.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly email: EmailProvider,
    private readonly sms: SmsProvider,
    private readonly push: PushProvider,
    private readonly telegram: TelegramProvider
  ) {}

  /** 배분 제안 알림 — 업체에 (메일+문자+푸시) */
  async notifyOffer(
    contractor: ContractorContact,
    info: { reportNo: string; issueSummary: string; deadline: Date }
  ): Promise<void> {
    const until = info.deadline.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit"
    });
    const text = `[바로 뚫림] '${info.issueSummary}' 신고(${info.reportNo})가 배정 제안되었습니다. ${until}까지 수락/거절해 주세요.`;
    await Promise.all([
      this.email.send({ to: contractor.email, subject: "[바로 뚫림] 새 배정 제안", text }),
      this.sms.send({ to: contractor.phone, text }),
      this.push.send({
        tokens: contractor.pushTokens ?? [],
        title: "새 배정 제안",
        body: `${info.reportNo} — ${until}까지 응답`,
        data: { reportNo: info.reportNo }
      })
    ]);
  }

  /** 관리자 텔레그램 — 신고 접수 */
  async notifyAdminNewReport(reportNo: string, summary: string | null): Promise<void> {
    await this.telegram.send(`🆕 <b>신규 신고</b>\n${reportNo}\n${summary ?? "-"}`);
  }

  /** 관리자 텔레그램 — 배정 확정 */
  async notifyAdminAssigned(reportNo: string, companyName: string): Promise<void> {
    await this.telegram.send(`✅ <b>업체 배정</b>\n${reportNo}\n${companyName}`);
  }

  /** 관리자 텔레그램 — 거절 */
  async notifyAdminRejected(reportNo: string, companyName: string, reason: RejectReason): Promise<void> {
    await this.telegram.send(`↩️ <b>제안 거절</b>\n${reportNo}\n${companyName} · ${REJECT_REASON_LABEL[reason] ?? reason}`);
  }

  /** 관리자 텔레그램 — 보류(무매칭/전원거절) */
  async notifyAdminHold(reportNo: string, summary: string | null, reason: string): Promise<void> {
    await this.telegram.send(`⏸️ <b>배분 보류</b>\n${reportNo}\n${summary ?? "-"}\n사유: ${reason}`);
  }

  /** 업체 등록 승인 알림 (메일 + 문자) */
  async notifyContractorApproved(contractor: ContractorContact): Promise<void> {
    const text = `[바로 뚫림] ${contractor.companyName} 업체 등록이 승인되었습니다. 지금부터 입찰에 참여하실 수 있습니다.`;

    await Promise.all([
      this.email.send({
        to: contractor.email,
        subject: "[바로 뚫림] 업체 등록이 승인되었습니다",
        text
      }),
      this.sms.send({ to: contractor.phone, text })
    ]);
  }

  /** 낙찰(업체 배정) 알림 — 업체에게 (메일 + 문자 + 푸시) */
  async notifyContractorAssigned(
    contractor: ContractorContact,
    info: AssignmentInfo
  ): Promise<void> {
    const text = `[바로 뚫림] '${info.issueSummary}' 신고(${info.reportNo})에 ${contractor.companyName} 업체가 배정되었습니다. 예상 금액 ${info.estimatedPrice}, 방문 ${info.availableTime}.`;

    await Promise.all([
      this.email.send({
        to: contractor.email,
        subject: "[바로 뚫림] 작업이 배정되었습니다",
        text
      }),
      this.sms.send({ to: contractor.phone, text }),
      this.push.send({
        tokens: contractor.pushTokens ?? [],
        title: "작업 배정",
        body: `${info.reportNo} 작업이 배정되었습니다.`,
        data: { reportNo: info.reportNo }
      })
    ]);
  }

  /** 낙찰(업체 배정) 알림 — 고객에게 (문자 + 푸시, 고객은 이메일 없음) */
  async notifyCustomerAssigned(
    customer: CustomerContact,
    info: AssignmentInfo & { companyName: string }
  ): Promise<void> {
    const text = `[바로 뚫림] 신고(${info.reportNo})에 ${info.companyName} 업체가 배정되었습니다. 방문 예정 ${info.availableTime}.`;

    await Promise.all([
      this.sms.send({ to: customer.phone, text }),
      this.push.send({
        tokens: customer.pushTokens ?? [],
        title: "업체 배정 완료",
        body: `${info.companyName} 업체가 배정되었습니다.`,
        data: { reportNo: info.reportNo }
      })
    ]);
  }
}
