import Image from "next/image";

/** 테이블에 데이터가 없을 때 남는 영역을 채우는 공통 빈 상태. */
export function EmptyTableState({ message }: { message: string }) {
  return (
    <div className="empty-table-state">
      <Image
        alt=""
        aria-hidden="true"
        height={88}
        src="/character.png"
        style={{ objectFit: "contain" }}
        width={88}
      />
      <p>{message}</p>
    </div>
  );
}
