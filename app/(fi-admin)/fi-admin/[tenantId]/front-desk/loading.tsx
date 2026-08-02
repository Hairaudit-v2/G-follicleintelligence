import { FiOsPageLoading } from "@/src/components/fi-os/FiOsPageLoading";

export default function FrontDeskLoading() {
  return (
    <div className="p-4 sm:p-6">
      <FiOsPageLoading label="Loading front desk…" />
    </div>
  );
}
