/**
 * Legacy alias — delegates to the canonical patient images route so VIE protocol policy,
 * guided capture, and attribution run identically (no generic upload bypass).
 */
export { POST } from "../../../patients/[patientId]/images/route";