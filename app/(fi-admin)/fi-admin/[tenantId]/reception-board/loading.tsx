import { ReceptionBoardSkeleton } from "@/src/components/fi-admin/reception-board/ReceptionBoardSkeleton";

export default function ReceptionBoardLoading() {
  return (
    <div className="p-4 sm:p-6">
      <ReceptionBoardSkeleton />
    </div>
  );
}