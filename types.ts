
export type PrayerType = 'REPRESENTATIVE' | 'FUNERAL';

export interface PrayerAttachment {
  data: string;
  mimeType: string;
  fileName?: string;
}

export interface RepresentativeSettings {
  churchName: string;
  pastorName: string;
  pastorTitle: string;
  serviceType: string;
  otherServiceType: string;
  churchSeason: string;
  otherChurchSeason: string;
  prayerTone: '전통적' | '현대적';
  prayerDuration: string;
  graceAndSalvation: string;
  confessionAndForgiveness: string;
  nationWellbeing: string;
  churchNeeds: string;
  specialGraceAndHealing: string;
  preacherFilling: string;
  additionalRequests: string;
  attachments?: PrayerAttachment[];
}

export interface FuneralSettings {
  deceasedName: string;
  deceasedTitle: string;
  funeralType: '발인' | '입관' | '하관' | '추모';
  familyComfort: string;
  hopeOfResurrection: string;
  additionalRequests: string;
  attachments?: PrayerAttachment[];
}

export type AppView = 'REP_SETTINGS' | 'FUN_SETTINGS' | 'REP_RESULT' | 'FUN_RESULT';

export interface GroundingSource {
  title?: string;
  uri?: string;
}
