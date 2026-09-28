export type UserEntry = {
  userId: string;
  userName: string;
};

type UserListCardProps = {
  title: string;
  users: UserEntry[];
  // ビンゴ一覧はアバターを金色にして、リーチ一覧と見分けやすくする
  avatarVariant?: "default" | "gold";
};

// 管理者画面のリーチ／ビンゴ参加者一覧カード。人数バッジと名前チップを並べる
export default function UserListCard({
  title,
  users,
  avatarVariant = "default",
}: UserListCardProps) {
  const avatarClassName =
    avatarVariant === "gold" ? "admin-avatar admin-avatar-gold" : "admin-avatar";

  return (
    <div className="rounded-2xl border-[1.5px] border-matsuri-border-calm bg-white px-5 py-4.5">
      <div className="flex items-center justify-between">
        <p className="font-heading text-2xl font-bold">{title}</p>
        <span className="rounded-full border-[1.5px] border-matsuri-border-gold bg-matsuri-cream-soft px-2.5 py-0.5 font-heading text-[11px] font-bold text-matsuri-label">
          {users.length}人
        </span>
      </div>
      {users.length === 0 ? (
        <p className="mt-2 text-sm font-bold text-matsuri-placeholder">
          まだいません
        </p>
      ) : (
        <div className="mt-2 flex max-h-23 flex-wrap content-start gap-1.5 overflow-y-auto pr-0.5">
          {users.map((user) => (
            <div
              key={user.userId}
              className="flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-matsuri-border-gold bg-matsuri-cream-soft py-0.5 pr-2.5 pl-0.5"
            >
              <span className={avatarClassName}>{user.userName.charAt(0)}</span>
              <span className="text-xs font-bold">{user.userName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
