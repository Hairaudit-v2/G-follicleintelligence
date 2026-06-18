import type { ReceptionCommunicationSendResult } from "@/src/lib/receptionOs/receptionCommunicationProvider";
import type { ReceptionCommunicationDeliveryStatus } from "@/src/lib/receptionOs/receptionCommunicationDelivery.types";

export function mapSendResultToDeliveryStatus(input: {
  sendResult: ReceptionCommunicationSendResult;
  dryRun: boolean;
  blocked?: boolean;
}): ReceptionCommunicationDeliveryStatus {
  if (input.blocked) return "failed";
  if (input.dryRun) return "dry_run";
  if (input.sendResult.delivered) return "sent";
  if (input.sendResult.provider === "stub") return "dry_run";
  return "failed";
}
