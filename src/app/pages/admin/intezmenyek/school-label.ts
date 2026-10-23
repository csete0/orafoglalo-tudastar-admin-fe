import { SchoolAdminDto } from '../../../models/teacher-moderation.model';

// UI-TT-195: az egyesítő eszköz fő célközönsége pontosan az AZONOS NEVŰ, véletlenül duplikáltan létrejött
// intézmény-párok - önmagában a név emiatt nem elég a legördülőben/jóváhagyó dialógusban a két fizikai intézmény
// megkülönböztetéséhez. A várost és az id-t is feltüntetjük.
export function schoolLabel(school: SchoolAdminDto): string {
  const city = school.city ? `, ${school.city}` : '';
  return `${school.name}${city} (#${school.id})`;
}
