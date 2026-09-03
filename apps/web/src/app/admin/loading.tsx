/** 관리자 라우트 전환 중 즉시 표시되는 로딩 화면 — 이전 화면이 멈춰 보이는 것을 막는다. */
export default function AdminLoading() {
  return (
    <div className="route-loading">
      <span aria-hidden="true" className="route-spinner" />
      불러오는 중…
    </div>
  );
}
