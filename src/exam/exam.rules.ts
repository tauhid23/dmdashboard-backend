import { CourseLevel } from "../generated/prisma/enums.js";

export type ExamFieldRule = { key: string; label: string; description: string; maximumMarks: number; sectionKey: string; sortOrder: number };
export type ExamSectionRule = { key: string; label: string; maximumMarks: number; passingMarks: number };
export type ExamRule = { courseLevel: CourseLevel; fields: ExamFieldRule[]; sections: ExamSectionRule[]; enabled?: boolean; validationIssues?: string[] };

type FieldTuple = [key: string, label: string, maximumMarks: number, description: string];
const section = (key: string, label: string, maximumMarks: number, passingMarks: number) => ({ key, label, maximumMarks, passingMarks });
const fields = (sectionKey: string, start: number, values: FieldTuple[]): ExamFieldRule[] =>
  values.map(([key, label, maximumMarks, description], index) => ({ key, label, maximumMarks, description, sectionKey, sortOrder: start + index }));
const maktabSections = [section("TAJWEED_QURAN", "Tajweed & Quran", 50, 35), section("ISLAMIC_STUDIES", "Islamic Studies", 50, 35)];
const maktabStage2Sections = [section("tajweed_quran", "Tajweed & Quran", 50, 35), section("islamic_studies", "Islamic Studies", 50, 35)];
const nazirahSections = [section("NAZIRAH", "Nazirah", 60, 42), section("TAJWEED_HIFZ", "Tajweed & Hifz", 40, 28)];
const hifzSections = [section("NEW_HIFZ", "New Hifz", 60, 42), section("REVIEW_AND_TAJWEED", "Review & Tajweed", 40, 28)];

const rules: ExamRule[] = [
  { courseLevel: CourseLevel.MAKTAB_STAGE_1, sections: maktabSections, fields: [
    ...fields("TAJWEED_QURAN", 1, [["qaidaQ1","Qaida",15,"Q - 1"],["qaidaQ2","Qaida",15,"Q - 2"],["nazira","Nazira",10,"From Al-Fil to An-Nas"],["hifz","Hifz",10,"Al-Fatiha"]]),
    ...fields("ISLAMIC_STUDIES", 5, [["hadithAkhlaq","Hadith & Akhlaq",10,"5 Hadith with meaning and 1 Moral"],["duas","Duas",10,"10 Duas with meaning"],["aqidah","Aqidah",10,"Any 1 Question"],["fiqh","Fiqh",10,"Any 1 Question"],["history","History",5,"Story of Nabi Adam"],["sirah","Sirah",5,"Story of Nabi Mohammad (SAW)"]]) ] },
  { courseLevel: CourseLevel.MAKTAB_STAGE_2, sections: maktabStage2Sections, fields: [
    ...fields("tajweed_quran", 1, [["tajweed1","Tajweed",6,"Noon Sakin and Tanween"],["tajweed2","Tajweed",6,"Letter, Word & Madd Al-Aarid"],["nazira1","Nazira",12,"From An-Naba to Al-Buruj"],["nazira2","Nazira",12,"From At-Tariq to Al-Humazah"],["hifz1","Hifz",7,"From Al-Fil to Al-Kafirun"],["hifz2","Hifz",7,"From An-Nasr to An-Nas"]]),
    ...fields("islamic_studies", 7, [["hadith1","Hadith & Akhlaq",5,"10 Hadith with meaning"],["hadith2","Hadith & Akhlaq",5,"2 Morals"],["duas","Duas",10,"10 Duas with meaning"],["aqidah","Aqidah",10,"Any 2 Questions"],["fiqh","Fiqh",10,"Any 2 Questions"],["history","History",5,"Story of Nabi Nuh (AS)"],["sirah","Sirah",5,"Year of the Elephant or Story of Halimah"]]) ] },
  { courseLevel: CourseLevel.MAKTAB_STAGE_3, sections: maktabSections, fields: [
    ...fields("TAJWEED_QURAN",1,[["tajweed1","Tajweed",5,"Rules of Meem Sakin"],["tajweed2","Tajweed",5,"Madd-ul-Munfasil / Madd-Muttasil and rules of Letter"],["nazira1","Nazira",12,"1 page from Juz 26 & 27"],["nazira2","Nazira",12,"1 page from Juz 28 & 29"],["hifzNew","Hifz New",10,"Any 2 Surah from Ad-Duha to Al-Humazah"],["hifzReview","Hifz Review",6,"Any 1 Surah From Al-Fil to An-Nas"]]),
    ...fields("ISLAMIC_STUDIES",7,[["hadith","Hadith & Akhlaq",5,"10 Hadith with meaning"],["morals","Hadith & Akhlaq",5,"2 Morals"],["duas","Duas",10,"10 Duas with meaning"],["aqidah","Aqidah",10,"Any 2 Questions"],["fiqh","Fiqh",10,"Any 2 Questions"],["history","History",5,"Story of Nabi Ibrahim"],["sirah","Sirah",5,"Any 1 Question"]]) ] },
];

const naz = (level: CourseLevel, nazFields: FieldTuple[], otherFields: FieldTuple[]): ExamRule => ({ courseLevel: level, sections: nazirahSections, fields: [...fields("NAZIRAH",1,nazFields),...fields("TAJWEED_HIFZ",nazFields.length+1,otherFields)] });
const fourNaz = (descriptions: string[]): FieldTuple[] => descriptions.map((d,i)=>[`nazira${i+1}`,"Nazira",15,d]);
rules.push(
  naz(CourseLevel.NAZIRAH_STAGE_1, fourNaz(["7 lines from page 1-7","7 lines from page 8-14","7 lines from page 15-21","7 lines from page 22-28"]), [["tajweed1","Tajweed",10,"Noon Sakin and Tanween"],["tajweed2","Tajweed",10,"Letter ر, word الله and Madd Al-Aarid"],["hifz1","Hifz",10,"From Al-Fil to Al-Kafirun"],["hifz2","Hifz",10,"From An-Nasr to An-Nas"]]),
  naz(CourseLevel.NAZIRAH_STAGE_2, fourNaz(["10 Lines From Juz 29","10 Lines From Juz 28","10 Lines From Juz 27","10 Lines From Juz 26"]), [["tajweed1","Tajweed",8,"Rules of Meem Sakin"],["tajweed2","Tajweed",8,"Mudd-ul-Munfasil and Muttasil Advanced Rules of Letter ر"],["hifzNew1","Hifz New",8,"Any 2 Surah From Ad-Duha to Al-Humazah"],["hifzNew2","Hifz New",8,"Any 2 Surah From Ad-Duha to Al-Humazah"],["hifzReview","Hifz Review",8,"Review Portion"]]),
  naz(CourseLevel.NAZIRAH_STAGE_3, fourNaz(["1 Page from Juz 1-2","1 Page from Juz 3-4","1 Page from Juz 5-7","1 Page from Juz 8-10"]), [["tajweed","Tajweed",10,"Quality of reading with Tajweed"],["hifzNew1","Hifz New",10,"Ayatul Kursi"],["hifzNew2","Hifz New",10,"Surah Al Mulk 1-14 Ayah"],["hifzReview","Hifz Review",10,"Any 1 Surah From Ad-Duha to An-Nas"]]),
  naz(CourseLevel.NAZIRAH_STAGE_4, fourNaz(["1 Page from Juz 11-13","1 Page from Juz 14-17","1 Page from Juz 18-21","1 Page from Juz 22-25"]), [["tajweed","Tajweed",10,"Quality of reading with Tajweed"],["hifzNew1","Hifz New",10,"Ayatul Kursi"],["hifzNew2","Hifz New",10,"Sura Al Mulk 1-30"],["hifzReview","Hifz Review",10,"Any 1 Surah From Ad-Duha to An-Nas"]])
);
const hifz = (level: CourseLevel, fresh: FieldTuple[], review: FieldTuple[], stage1=false): ExamRule => ({courseLevel:level,sections:stage1?[section("NEW_HIFZ","New Hifz",80,56),section("TAJWEED","Tajweed",20,14)]:hifzSections,fields:[...fields("NEW_HIFZ",1,fresh),...fields(stage1?"TAJWEED":"REVIEW_AND_TAJWEED",fresh.length+1,review)]});
rules.push(
 hifz(CourseLevel.HIFZ_STAGE_1,[["hifz1","Hifz",20,"Sura An-Naba to Al-Infitar"],["hifz2","Hifz",20,"Sura Al-Mutaffifin to Al-Ghashiah"],["hifz3","Hifz",20,"Sura Al-A'la to Al-Bayyinah"],["hifz4","Hifz",20,"Sura Al-A'jiljal to An-Nas"]],[["tajweed1","Tajweed",10,"Quality of reading with Tajweed"],["tajweed2","Tajweed",10,"Noon Sakin and Tanween"]],true),
 hifz(CourseLevel.HIFZ_STAGE_2,[["hifz1","Hifz",20,"8/10 lines from page 1-8"],["hifz2","Hifz",20,"8/10 lines from page 9-16"],["hifz3","Hifz",20,"8/10 lines from page 17-24"]],[["oldHifz1","Old Hifz",10,"8/10 lines from first half"],["oldHifz2","Old Hifz",10,"8/10 lines from last half"],["tajweed1","Tajweed",10,"Quality of reading with Tajweed"],["tajweed2","Tajweed",10,"Rules of Meem Sakin"]]),
 hifz(CourseLevel.HIFZ_STAGE_3,[["hifz1","Hifz Juz 28",20,"8/10 lines from page 1-7"],["hifz2","Hifz Juz 28",20,"8/10 lines from page 8-14"],["hifz3","Hifz Juz 28",20,"8/10 lines from page 15-20"]],[["oldHifz1","Juz 30 & 29 Review",10,"8/10 lines from Juz 30"],["oldHifz2","Juz 30 & 29 Review",10,"8/10 lines from Juz 29"],["tajweed1","Tajweed",10,"Quality of reading with Tajweed"],["tajweed2","Tajweed",10,"Mudd-ul-Munfasil and Muttasil, Advanced rules of Letter J"]]),
 hifz(CourseLevel.HIFZ_STAGE_4,[["hifz1","Hifz Juz 27",20,"8/10 lines from page 1-7"],["hifz2","Hifz Juz 27",20,"8/10 lines from page 8-14"],["hifz3","Hifz Juz 27",20,"8/10 lines from page 15-20"]],[["oldHifz1","Juz 28 & 30 Review",10,"8/10 lines from Juz 28"],["oldHifz2","Juz 28 & 30 Review",10,"8/10 lines from Juz 29"],["tajweed1","Tajweed",10,"Quality of reading with Tajweed"],["tajweed2","Tajweed",10,"Mudd-ul-Munfasil and Muttasil, Advanced rules of Letter J"]])
);

export const COURSE_RULES = Object.fromEntries(rules.map(rule => [rule.courseLevel, rule])) as Record<CourseLevel, ExamRule>;
export const validateExamRules = () => Object.values(COURSE_RULES).forEach(rule => {
  const keys = new Set(rule.fields.map(field => field.key));
  if (keys.size !== rule.fields.length) throw new Error(`Duplicate field in ${rule.courseLevel}`);
  rule.sections.forEach(s => { const total=rule.fields.filter(f=>f.sectionKey===s.key).reduce((sum,f)=>sum+f.maximumMarks,0); if(total!==s.maximumMarks && rule.enabled!==false) throw new Error(`${rule.courseLevel}.${s.key}: fields total ${total}, expected ${s.maximumMarks}`); });
  rule.fields.forEach(field => { if(rule.sections.filter(s=>s.key===field.sectionKey).length!==1) throw new Error(`${rule.courseLevel}.${field.key} must belong to exactly one section`); });
});
validateExamRules();
