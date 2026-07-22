"use client";

import { MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type LocationCandidate = {
  id: string;
  title: string;
  addressText: string | null;
  roadAddressText: string | null;
  placeName: string | null;
  category: string | null;
  latitude: number;
  longitude: number;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function displayAddress(candidate: LocationCandidate) {
  return candidate.roadAddressText ?? candidate.addressText ?? candidate.title;
}

export function LocationSearchInput() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [autoSearch, setAutoSearch] = useState(false);
  const [candidates, setCandidates] = useState<LocationCandidate[]>([]);
  const [selected, setSelected] = useState<LocationCandidate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 선택된 주소가 있으면 그 값을, 없으면 직접 입력 중인 텍스트를 보여준다.
  const addressValue = selected ? displayAddress(selected) : draft;
  const selectedSummary = useMemo(() => {
    if (!selected) {
      return null;
    }

    return [selected.placeName, selected.roadAddressText, selected.addressText]
      .filter(Boolean)
      .join(" · ");
  }, [selected]);

  async function searchLocations() {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      setError("검색어를 입력해 주세요.");
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/maps/search?query=${encodeURIComponent(cleanQuery)}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "주소를 검색하지 못했습니다.");
      }

      setCandidates((await response.json()) as LocationCandidate[]);
    } catch (searchError) {
      setCandidates([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "주소를 검색하지 못했습니다.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  function selectCandidate(candidate: LocationCandidate) {
    setSelected(candidate);
    setQuery(candidate.title);
    setIsOpen(false);
  }

  // 주소칸에 입력한 검색어를 들고 모달을 열면 바로 검색한다.
  function openSearch() {
    const carried = draft.trim();

    if (!selected && carried) {
      setQuery(carried);
      setAutoSearch(true);
    }

    setIsOpen(true);
  }

  useEffect(() => {
    if (isOpen && autoSearch) {
      setAutoSearch(false);
      void searchLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearch, isOpen]);

  return (
    <div className="location-search-field">
      <label htmlFor="address">주소</label>
      <div
        className={`input-row location-search-trigger ${selected ? "selected" : ""}`}
      >
        <MapPin aria-hidden="true" size={18} />
        <input
          id="address"
          name="address"
          onChange={(event) => {
            setDraft(event.target.value);

            if (selected) {
              setSelected(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              openSearch();
            }
          }}
          placeholder="주소, 동 이름, 상호명 입력 후 검색"
          value={addressValue}
        />
        <button className="secondary-button" onClick={openSearch} type="button">
          검색
        </button>
      </div>

      <input
        name="latitude"
        type="hidden"
        value={selected?.latitude?.toString() ?? ""}
      />
      <input
        name="longitude"
        type="hidden"
        value={selected?.longitude?.toString() ?? ""}
      />

      {selectedSummary ? <p className="field-note">{selectedSummary}</p> : null}

      {selected || draft.trim() ? (
        <div className="input-row address-detail-row">
          <input
            aria-label="상세 주소"
            name="addressDetail"
            placeholder="상세 주소 (동/호수, 층 등)"
          />
        </div>
      ) : null}

      {isOpen ? (
        <div className="modal-backdrop">
          <section
            className="location-modal"
            aria-labelledby="location-search-title"
            role="dialog"
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">주소 검색</p>
                <h2 id="location-search-title">업체 주소 선택</h2>
              </div>
              <button
                aria-label="닫기"
                className="icon-button"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>

            <div className="modal-search-row">
              <div className="input-row">
                <Search aria-hidden="true" size={18} />
                <input
                  autoFocus
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void searchLocations();
                    }
                  }}
                  placeholder="주소, 동 이름, 상호명"
                  value={query}
                />
              </div>
              <button
                className="primary-button"
                disabled={isSearching}
                onClick={searchLocations}
                type="button"
              >
                검색
              </button>
            </div>

            {error ? <p className="empty-text">{error}</p> : null}

            <div className="location-result-list">
              {candidates.map((candidate) => (
                <button
                  className="location-result"
                  key={candidate.id}
                  onClick={() => selectCandidate(candidate)}
                  type="button"
                >
                  <strong>{candidate.title}</strong>
                  <span>{displayAddress(candidate)}</span>
                  {candidate.addressText &&
                  candidate.addressText !== displayAddress(candidate) ? (
                    <small>{candidate.addressText}</small>
                  ) : null}
                </button>
              ))}
              {!isSearching && !hasSearched && candidates.length === 0 && !error ? (
                <p className="empty-text">
                  찾는 곳의 주소나 건물 이름을 입력하고 검색을 눌러 주세요.
                </p>
              ) : null}
              {!isSearching && hasSearched && candidates.length === 0 && !error ? (
                <p className="empty-text">
                  검색 결과가 없습니다. 다른 검색어로 다시 시도해 보세요.
                </p>
              ) : null}
              {isSearching ? (
                <p className="empty-text">검색 중입니다.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
