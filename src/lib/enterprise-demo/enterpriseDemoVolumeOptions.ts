/** Scales synthetic demo data volume (patients, surgeries) per clinic. */
export type EnterpriseDemoVolumeOptions = {
  patientsPerClinic: number;
  surgeriesPerClinic: number;
};

export const ENTERPRISE_DEMO_DEFAULT_VOLUME: EnterpriseDemoVolumeOptions = {
  patientsPerClinic: 30,
  surgeriesPerClinic: 12,
};

export function resolveEnterpriseDemoVolume(
  volume?: Partial<EnterpriseDemoVolumeOptions>
): EnterpriseDemoVolumeOptions {
  return {
    patientsPerClinic: volume?.patientsPerClinic ?? ENTERPRISE_DEMO_DEFAULT_VOLUME.patientsPerClinic,
    surgeriesPerClinic: volume?.surgeriesPerClinic ?? ENTERPRISE_DEMO_DEFAULT_VOLUME.surgeriesPerClinic,
  };
}
