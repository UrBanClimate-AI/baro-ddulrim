"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 신고 목록 기간 필터.
 * 클라이언트 네비게이션(router.push)을 써서 전체 리로드 없이
 * 로딩 오버레이를 거쳐 부드럽게 전환된다.
 */
export function ReportDateFilter({
  status,
  from,
  to,
  channel,
}: {
  status: string;
  from?: string;
  to?: string;
  channel?: string;
}) {
  const router = useRouter();
  const [fromValue, setFromValue] = useState(from ?? "");
  const [toValue, setToValue] = useState(to ?? "");

  function buildHref(fromDate: string, toDate: string) {
    const query = new URLSearchParams();

    if (status !== "all") {
      query.set("status", status);
    }

    if (fromDate) {
      query.set("from", fromDate);
    }

    if (toDate) {
      query.set("to", toDate);
    }

    if (channel) {
      query.set("channel", channel);
    }

    const text = query.toString();
    return text ? `/admin/reports?${text}` : "/admin/reports";
  }

  return (
    <form
      className="date-filter-bar"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(buildHref(fromValue, toValue));
      }}
    >
      <label>
        <span>시작일</span>
        <input
          onChange={(event) => setFromValue(event.target.value)}
          type="date"
          value={fromValue}
        />
      </label>
      <label>
        <span>종료일</span>
        <input
          onChange={(event) => setToValue(event.target.value)}
          type="date"
          value={toValue}
        />
      </label>
      <button className="secondary-button" type="submit">
        기간 적용
      </button>
      <button
        aria-label="기간 초기화"
        className="icon-link"
        onClick={() => {
          setFromValue("");
          setToValue("");
          router.push(buildHref("", ""));
        }}
        title="기간 초기화"
        type="button"
      >
        <RotateCcw aria-hidden="true" size={18} />
      </button>
    </form>
  );
}
