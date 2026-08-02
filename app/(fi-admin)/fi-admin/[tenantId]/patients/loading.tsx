import { FiOsPageLoading } from "@/src/components/fi-os/FiOsPageLoading";

export default function PatientsListLoading() {
  return (
    <div className="p-4 sm:p-6">
      <FiOsPageLoading label="Loading patients…" />
    </div>
  );
}
