/** 파트너 라우트 전환 중 즉시 표시되는 로딩 화면. */
export default function PartnerLoading() {
  return (
    <div className="route-loading">
      <span aria-hidden="true" className="route-spinner" />
      불러오는 중…
    </div>
  );
}
