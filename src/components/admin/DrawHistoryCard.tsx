export type DrawEntry = {
  number: number;
  drawOrder: number;
};

type DrawHistoryCardProps = {
  draws: DrawEntry[];
};

// 管理者画面の抽選履歴カード。抽選順に番号チップを折り返して並べ、最新の番号を強調する
export default function DrawHistoryCard({ draws }: DrawHistoryCardProps) {
  return (
    <div className="rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white px-5 py-4.5">
      <p className="font-heading text-2xl font-bold">抽選履歴</p>
      {draws.length === 0 ? (
        <p className="mt-2 text-sm font-bold text-matsuri-placeholder">
          まだありません
        </p>
      ) : (
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          {draws.map((draw, index) => {
            const isLatest = index === draws.length - 1;
            return (
              <div
                key={draw.number}
                className={
                  isLatest ? "admin-chip admin-chip-latest" : "admin-chip"
                }
              >
                {draw.number}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
