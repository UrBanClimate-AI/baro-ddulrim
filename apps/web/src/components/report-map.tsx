"use client";

import { Select } from "@/components/ui/select";

import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapProviderName, ReportMapMarker } from "@/lib/map-api";
import {
  formatDateTime,
  issueTypeLabels,
  labelOf,
  statusLabels,
  urgencyLabels,
} from "@/lib/labels";

type ReportMapProps = {
  markers: ReportMapMarker[];
  provider: MapProviderName;
  kakaoJavascriptKey?: string;
};

type KakaoLatLng = unknown;

type KakaoBounds = {
  extend: (position: KakaoLatLng) => void;
};

type KakaoMap = {
  setBounds: (bounds: KakaoBounds) => void;
  setLevel: (level: number) => void;
};

type KakaoMarker = {
  setMap: (map: KakaoMap | null) => void;
};

type KakaoInfoWindow = {
  open: (map: KakaoMap, marker: KakaoMarker) => void;
  close: () => void;
};

type KakaoMaps = {
  LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  Size: new (width: number, height: number) => unknown;
  MarkerImage: new (src: string, size: unknown) => unknown;
  Marker: new (options: {
    position: KakaoLatLng;
    title?: string;
    image?: unknown;
  }) => KakaoMarker;
  InfoWindow: new (options: {
    content: string;
    removable?: boolean;
  }) => KakaoInfoWindow;
  event: {
    addListener: (
      target: unknown,
      eventName: string,
      handler: () => void,
    ) => void;
  };
  load: (callback: () => void) => void;
};

type KakaoWindow = Window & {
  kakao?: {
    maps: KakaoMaps;
  };
};

type FallbackBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

const kakaoMapScriptId = "kakao-map-sdk";

function markerAddress(marker: ReportMapMarker) {
  return (
    marker.placeName ?? marker.roadAddressText ?? marker.addressText ?? "-"
  );
}

// 범례(긴급/급함/일반/완료)와 동일한 색의 마커 이미지
const markerToneColors: Record<string, string> = {
  emergency: "#dc2626",
  urgent: "#d97706",
  normal: "#0ea5e9",
  resolved: "#15803d",
};

function markerImageSrc(tone: string) {
  const color = markerToneColors[tone] ?? markerToneColors.normal;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${color}"/><circle cx="15" cy="14" r="6" fill="#ffffff"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function markerTone(marker: ReportMapMarker) {
  if (marker.status === "RESOLVED") {
    return "resolved";
  }

  if (marker.urgency === "EMERGENCY") {
    return "emergency";
  }

  if (marker.urgency === "URGENT") {
    return "urgent";
  }

  return "normal";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markerInfoContent(marker: ReportMapMarker) {
  const title = escapeHtml(marker.summary ?? marker.reportNo);
  const address = escapeHtml(markerAddress(marker));
  const meta = escapeHtml(
    `${labelOf(statusLabels, marker.status)} · ${labelOf(urgencyLabels, marker.urgency)}`,
  );

  return `
    <div style="min-width:190px;padding:10px 12px;font-size:13px;line-height:1.45;color:#1f2937;">
      <strong style="display:block;margin-bottom:5px;font-size:14px;">${title}</strong>
      <span style="display:block;color:#475569;">${address}</span>
      <small style="display:block;margin-top:6px;color:#64748b;">${meta}</small>
    </div>
  `;
}

function markerPosition(marker: ReportMapMarker) {
  return {
    latitude: marker.latitude as number,
    longitude: marker.longitude as number,
  };
}

function computeFallbackBounds(markers: ReportMapMarker[]) {
  if (markers.length === 0) {
    return null;
  }

  const latitudes = markers.map((marker) => marker.latitude as number);
  const longitudes = markers.map((marker) => marker.longitude as number);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    minLatitude,
    maxLatitude: maxLatitude === minLatitude ? maxLatitude + 0.01 : maxLatitude,
    minLongitude,
    maxLongitude:
      maxLongitude === minLongitude ? maxLongitude + 0.01 : maxLongitude,
  };
}

function fallbackPosition(
  marker: ReportMapMarker,
  bounds: FallbackBounds | null,
) {
  if (!bounds) {
    return {
      left: "50%",
      top: "50%",
    };
  }

  const { latitude, longitude } = markerPosition(marker);
  const x =
    ((longitude - bounds.minLongitude) /
      (bounds.maxLongitude - bounds.minLongitude)) *
      82 +
    9;
  const y =
    (1 -
      (latitude - bounds.minLatitude) /
        (bounds.maxLatitude - bounds.minLatitude)) *
      74 +
    13;

  return {
    left: `${x}%`,
    top: `${y}%`,
  };
}

const statusFilterOptions = [
  { value: "ALL", label: "전체 상태" },
  { value: "OPEN", label: "진행 중" },
  { value: "RESOLVED", label: "해결 완료" },
] as const;

const dateFilterOptions = [
  { value: "ALL", label: "전체 기간" },
  { value: "7", label: "최근 7일" },
  { value: "30", label: "최근 30일" },
] as const;

const issueFilterOptions = [
  "FLOOD",
  "DRAIN",
  "SEWER_BACKFLOW",
  "ODOR",
  "EMERGENCY",
  "OTHER",
] as const;

export function ReportMap({
  markers,
  provider,
  kakaoJavascriptKey,
}: ReportMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isKakaoLoading, setIsKakaoLoading] = useState(false);
  const [kakaoLoadError, setKakaoLoadError] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const validMarkers = useMemo(() => {
    const dateLimit =
      dateFilter === "ALL"
        ? null
        : Date.now() - Number(dateFilter) * 24 * 60 * 60 * 1000;

    return markers.filter((marker) => {
      if (
        typeof marker.latitude !== "number" ||
        typeof marker.longitude !== "number"
      ) {
        return false;
      }

      if (issueFilter !== "ALL" && marker.issueType !== issueFilter) {
        return false;
      }

      if (statusFilter === "RESOLVED" && marker.status !== "RESOLVED") {
        return false;
      }

      if (statusFilter === "OPEN" && marker.status === "RESOLVED") {
        return false;
      }

      if (dateLimit !== null) {
        const createdAt = marker.createdAt ? Date.parse(marker.createdAt) : NaN;

        if (Number.isNaN(createdAt) || createdAt < dateLimit) {
          return false;
        }
      }

      return true;
    });
  }, [dateFilter, issueFilter, markers, statusFilter]);
  const fallbackBounds = useMemo(
    () => computeFallbackBounds(validMarkers),
    [validMarkers],
  );
  const selectedMarker =
    validMarkers.find((marker) => marker.id === selectedId) ??
    validMarkers[0] ??
    null;
  const shouldUseKakao = provider === "kakao" && Boolean(kakaoJavascriptKey);
  const shouldShowFallback = !shouldUseKakao || Boolean(kakaoLoadError);

  useEffect(() => {
    if (validMarkers.length === 0) {
      if (selectedId) {
        setSelectedId(null);
      }
      return;
    }

    if (
      !selectedId ||
      !validMarkers.some((marker) => marker.id === selectedId)
    ) {
      setSelectedId(validMarkers[0].id);
    }
  }, [selectedId, validMarkers]);

  useEffect(() => {
    if (!shouldUseKakao || !mapRef.current) {
      setIsKakaoLoading(false);
      return;
    }

    if (validMarkers.length === 0) {
      setKakaoLoadError(null);
      setIsKakaoLoading(false);
      return;
    }

    let cancelled = false;
    let renderedMarkers: KakaoMarker[] = [];
    let renderedInfoWindows: KakaoInfoWindow[] = [];
    let activeInfoWindow: KakaoInfoWindow | null = null;
    const kakaoWindow = window as KakaoWindow;

    const initializeMap = () => {
      if (cancelled || !mapRef.current || !kakaoWindow.kakao?.maps) {
        return;
      }

      kakaoWindow.kakao.maps.load(() => {
        if (cancelled || !mapRef.current || !kakaoWindow.kakao?.maps) {
          return;
        }

        const kakaoMaps = kakaoWindow.kakao.maps;
        const firstMarker = validMarkers[0];
        const firstPosition = markerPosition(firstMarker);
        const map = new kakaoMaps.Map(mapRef.current, {
          center: new kakaoMaps.LatLng(
            firstPosition.latitude,
            firstPosition.longitude,
          ),
          level: 7,
        });
        const bounds = new kakaoMaps.LatLngBounds();

        renderedMarkers = validMarkers.map((marker) => {
          const { latitude, longitude } = markerPosition(marker);
          const position = new kakaoMaps.LatLng(latitude, longitude);
          const kakaoMarker = new kakaoMaps.Marker({
            position,
            title: marker.summary ?? marker.reportNo,
            image: new kakaoMaps.MarkerImage(
              markerImageSrc(markerTone(marker)),
              new kakaoMaps.Size(30, 40),
            ),
          });
          const infoWindow = new kakaoMaps.InfoWindow({
            content: markerInfoContent(marker),
            removable: true,
          });

          bounds.extend(position);
          kakaoMarker.setMap(map);
          renderedInfoWindows.push(infoWindow);
          kakaoMaps.event.addListener(kakaoMarker, "click", () => {
            activeInfoWindow?.close();
            activeInfoWindow = infoWindow;
            setSelectedId(marker.id);
            infoWindow.open(map, kakaoMarker);
          });

          return kakaoMarker;
        });

        if (validMarkers.length > 1) {
          map.setBounds(bounds);
        } else {
          map.setLevel(4);
        }

        setKakaoLoadError(null);
        setIsKakaoLoading(false);
      });
    };

    const handleScriptError = () => {
      if (cancelled) {
        return;
      }

      setKakaoLoadError("Kakao 지도를 불러오지 못했습니다.");
      setIsKakaoLoading(false);
    };

    setIsKakaoLoading(true);
    setKakaoLoadError(null);

    if (kakaoWindow.kakao?.maps) {
      initializeMap();
      return () => {
        cancelled = true;
        renderedMarkers.forEach((marker) => marker.setMap(null));
        renderedInfoWindows.forEach((infoWindow) => infoWindow.close());
      };
    }

    let script = document.getElementById(
      kakaoMapScriptId,
    ) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = kakaoMapScriptId;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJavascriptKey}&autoload=false`;
      script.async = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", initializeMap);
    script.addEventListener("error", handleScriptError);

    return () => {
      cancelled = true;
      script?.removeEventListener("load", initializeMap);
      script?.removeEventListener("error", handleScriptError);
      renderedMarkers.forEach((marker) => marker.setMap(null));
      renderedInfoWindows.forEach((infoWindow) => infoWindow.close());
    };
  }, [kakaoJavascriptKey, shouldUseKakao, validMarkers]);

  return (
    <div className="report-map-layout">
      <div className="map-filter-bar" role="group" aria-label="지도 필터">
        <Select
          onChange={setIssueFilter}
          options={[
            { value: "ALL", label: "전체 유형" },
            ...issueFilterOptions.map((issueType) => ({
              value: issueType,
              label: labelOf(issueTypeLabels, issueType),
            })),
          ]}
          value={issueFilter}
        />
        <Select
          onChange={setStatusFilter}
          options={statusFilterOptions.map((o) => ({ value: o.value, label: o.label }))}
          value={statusFilter}
        />
        <Select
          onChange={setDateFilter}
          options={dateFilterOptions.map((o) => ({ value: o.value, label: o.label }))}
          value={dateFilter}
        />
        <span className="map-filter-count">{validMarkers.length}건 표시</span>
        <div className="map-legend" aria-label="마커 범례">
          <span className="map-legend-item emergency">긴급</span>
          <span className="map-legend-item urgent">급함</span>
          <span className="map-legend-item normal">일반</span>
          <span className="map-legend-item resolved">완료</span>
        </div>
      </div>
      <div className="report-map-canvas" aria-label="신고 위치 마커">
        {shouldUseKakao && !kakaoLoadError ? (
          <div className="kakao-map-container" ref={mapRef} />
        ) : null}

        {shouldShowFallback ? (
          <div className="fallback-map-grid">
            {validMarkers.map((marker) => (
              <button
                aria-label={`${marker.reportNo} ${marker.summary ?? ""}`}
                className={`map-marker-dot ${markerTone(marker)}${
                  selectedMarker?.id === marker.id ? " active" : ""
                }`}
                key={marker.id}
                onClick={() => setSelectedId(marker.id)}
                style={fallbackPosition(marker, fallbackBounds)}
                type="button"
              >
                <MapPin aria-hidden="true" size={18} />
              </button>
            ))}
          </div>
        ) : null}

        {isKakaoLoading ? (
          <div className="map-loading-state">
            실제 지도를 불러오는 중입니다.
          </div>
        ) : null}

        {kakaoLoadError ? (
          <div className="map-provider-note">{kakaoLoadError}</div>
        ) : null}

        {validMarkers.length === 0 ? (
          <div className="map-empty-state">
            <MapPin aria-hidden="true" size={28} />
            <p>확정 좌표가 있는 신고가 없습니다.</p>
          </div>
        ) : null}
      </div>

      <aside className="report-map-panel" aria-label="선택된 신고">
        {selectedMarker ? (
          <>
            <span
              className={`urgency-badge ${selectedMarker.urgency.toLowerCase()}`}
            >
              {labelOf(urgencyLabels, selectedMarker.urgency)}
            </span>
            <h2>{selectedMarker.summary ?? selectedMarker.reportNo}</h2>
            <dl className="info-list compact-list">
              <div>
                <dt>상태</dt>
                <dd>{labelOf(statusLabels, selectedMarker.status)}</dd>
              </div>
              <div>
                <dt>유형</dt>
                <dd>{labelOf(issueTypeLabels, selectedMarker.issueType)}</dd>
              </div>
              <div>
                <dt>위치</dt>
                <dd>{markerAddress(selectedMarker)}</dd>
              </div>
              <div>
                <dt>업체</dt>
                <dd>{selectedMarker.assignedCompanyName ?? "-"}</dd>
              </div>
              <div>
                <dt>접수</dt>
                <dd>{formatDateTime(selectedMarker.createdAt)}</dd>
              </div>
              <div>
                <dt>해결</dt>
                <dd>{formatDateTime(selectedMarker.resolvedAt)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="empty-text">
            마커를 선택하면 신고와 처리 상태를 볼 수 있습니다.
          </p>
        )}
      </aside>
    </div>
  );
}
