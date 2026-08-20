import type { Prisma } from "../generated/prisma/client.js";
import { CourseLevel, ExamOutcome } from "../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import type { ActorScope } from "../auth/accessScope.js";
import { assertStudentAccess, assertTeacherAccess, forbidden } from "../auth/accessScope.js";
import { COURSE_RULES } from "./exam.rules.js";
import { courseDisplay, courseLevelFromDisplay, nextCourseLevel } from "./course-progression.js";

type MarkInput = { fieldKey: string; obtainedMarks: number };
type SubmitInput = { studentId: string; examinerId?: string; teacherId?: string; courseLevel: CourseLevel; idempotencyKey: string; notes?: string | null; marks: MarkInput[]; createdById?: string };
type RuleForCalculation = {
 fields:Array<{id?:string;key:string;label:string;description:string|null;maximumMarks:number;sectionKey:string;sectionLabel?:string;sortOrder:number;required?:boolean}>;
 sections:Array<{key:string;label:string;maximumMarks:number;passingMarks:number|null;sortOrder?:number}>;
};
const httpError = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
const include = { marks: { orderBy: { sortOrder: "asc" as const } }, sections: true, student: { select: { id:true,name:true } }, examiner: { select: { id:true,name:true } } } satisfies Prisma.ExamAttemptInclude;
type AttemptWithDetails=Prisma.ExamAttemptGetPayload<{include:typeof include}>;
const withResultDetails=(attempt:AttemptWithDetails|null)=>attempt==null?null:{...attempt,resultLabel:attempt.outcome===ExamOutcome.PASSED?"Passed":"Needs Improvement",detailsComplete:attempt.marks.length>0,marks:attempt.marks.map(mark=>({...mark,sectionLabel:mark.sectionLabel??attempt.sections.find(section=>section.sectionKey===mark.sectionKey)?.sectionLabel??null}))};

const validatePayload = (raw: unknown): SubmitInput => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw httpError(400,"Request body must be an object");
  const body=raw as Record<string,unknown>;
  if ("studentName" in body || "teacherName" in body) throw httpError(400,"Names cannot be used as relational identifiers; use studentId and examinerId");
  const examinerId=body.examinerId ?? body.teacherId;
  for(const [key,value] of [["studentId",body.studentId],["examinerId",examinerId],["courseLevel",body.courseLevel],["idempotencyKey",body.idempotencyKey]] as const) if(typeof value!=="string"||!value.trim()) throw httpError(400,`${key} is required`);
  if(!Object.values(CourseLevel).includes(body.courseLevel as CourseLevel)) throw httpError(400,"Unsupported courseLevel");
  if(!Array.isArray(body.marks)) throw httpError(400,"marks must be an array");
  return {studentId:(body.studentId as string).trim(),examinerId:(examinerId as string).trim(),courseLevel:body.courseLevel as CourseLevel,idempotencyKey:(body.idempotencyKey as string).trim(),notes:body.notes==null?null:String(body.notes),marks:body.marks as MarkInput[]};
};

export const calculateExam = (input: Pick<SubmitInput,"courseLevel"|"marks">) => {
 const rule=COURSE_RULES[input.courseLevel], byKey=new Map<string,number>();
 if(rule.enabled===false) throw httpError(409,`Course level is disabled because its frontend marks conflict with official rules: ${rule.validationIssues?.join("; ")}`);
 for(const mark of input.marks){ if(!mark||typeof mark.fieldKey!=="string"||!Number.isInteger(mark.obtainedMarks)) throw httpError(422,"Each mark requires a fieldKey and whole-number obtainedMarks"); if(byKey.has(mark.fieldKey)) throw httpError(422,`Duplicate mark: ${mark.fieldKey}`); byKey.set(mark.fieldKey,mark.obtainedMarks); }
 if(byKey.size!==rule.fields.length) throw httpError(422,"All and only the configured mark fields are required");
 const marks=rule.fields.map(field=>{const obtainedMarks=byKey.get(field.key);if(obtainedMarks===undefined)throw httpError(422,`Missing mark: ${field.key}`);if(obtainedMarks<0||obtainedMarks>field.maximumMarks)throw httpError(422,`${field.key} must be between 0 and ${field.maximumMarks}`);return {...field,obtainedMarks};});
 for(const key of byKey.keys())if(!rule.fields.some(field=>field.key===key))throw httpError(422,`Unknown mark: ${key}`);
 const sections=rule.sections.map(section=>{const obtainedMarks=marks.filter(mark=>mark.sectionKey===section.key).reduce((sum,mark)=>sum+mark.obtainedMarks,0);return {...section,obtainedMarks,passed:obtainedMarks>=section.passingMarks};});
 const totalScore=sections.reduce((sum,s)=>sum+s.obtainedMarks,0),totalMaxScore=sections.reduce((sum,s)=>sum+s.maximumMarks,0);
 return {marks,sections,totalScore,totalMaxScore,percentage:Number(((totalScore*100)/totalMaxScore).toFixed(2)),outcome:sections.every(s=>s.passed)?ExamOutcome.PASSED:ExamOutcome.NEEDS_IMPROVEMENT};
};

const calculateUsingRule = (rule:RuleForCalculation, marksInput:MarkInput[]) => {
 const byKey=new Map<string,number>();
 for(const mark of marksInput){if(!mark||typeof mark.fieldKey!=="string"||!Number.isInteger(mark.obtainedMarks))throw httpError(422,"Each mark requires a fieldKey and whole-number obtainedMarks");if(byKey.has(mark.fieldKey))throw httpError(422,`Duplicate mark: ${mark.fieldKey}`);byKey.set(mark.fieldKey,mark.obtainedMarks);}
 const required=rule.fields.filter(field=>field.required!==false);
 for(const field of required)if(!byKey.has(field.key))throw httpError(422,`Missing mark: ${field.key}`);
 for(const key of byKey.keys())if(!rule.fields.some(field=>field.key===key))throw httpError(422,`Unknown mark: ${key}`);
 const marks=rule.fields.filter(field=>byKey.has(field.key)).map(field=>{const obtainedMarks=byKey.get(field.key)!;if(obtainedMarks<0||obtainedMarks>field.maximumMarks)throw httpError(422,`${field.key} must be between 0 and ${field.maximumMarks}`);return {...field,obtainedMarks};});
 const sections=rule.sections.map(section=>{const obtainedMarks=marks.filter(mark=>mark.sectionKey===section.key).reduce((sum,mark)=>sum+mark.obtainedMarks,0);return {...section,obtainedMarks,passed:section.passingMarks==null?true:obtainedMarks>=section.passingMarks};});
 const totalScore=marks.reduce((sum,mark)=>sum+mark.obtainedMarks,0),totalMaxScore=marks.reduce((sum,mark)=>sum+mark.maximumMarks,0);
 return {marks,sections,totalScore,totalMaxScore,percentage:Number(((totalScore*100)/totalMaxScore).toFixed(2)),outcome:sections.every(section=>section.passed)?ExamOutcome.PASSED:ExamOutcome.NEEDS_IMPROVEMENT};
};

const response = async (examAttemptId:string, promoted:boolean, previousLevel:CourseLevel) => {
 const examAttempt=await prisma.examAttempt.findUniqueOrThrow({where:{id:examAttemptId},include});
 const student=await getStudentExamDetails(examAttempt.studentId);
 return {examAttempt:withResultDetails(examAttempt),promotion:{promoted,previousLevel,currentLevel:student.currentCourseLevel,courseCompleted:student.courseCompleted},student};
};

export const submitExam = async (raw:unknown, scope?: ActorScope) => {
 const input=validatePayload(raw), existing=await prisma.examAttempt.findUnique({where:{idempotencyKey:input.idempotencyKey}});
 if(scope&&!scope.isPrivileged){await assertStudentAccess(scope,input.studentId);if(input.examinerId)await assertTeacherAccess(scope,input.examinerId);}
 if(existing){if(existing.studentId!==input.studentId||existing.examinerId!==input.examinerId||existing.courseLevel!==input.courseLevel)throw httpError(409,"Idempotency key belongs to a different submission");return {statusCode:200,data:await response(existing.id,false,existing.courseLevel)};}
 try {
  const saved=await prisma.$transaction(async tx=>{
   const student=await tx.student.findUnique({where:{id:input.studentId}});if(!student)throw httpError(404,"Student not found");
   const examiner=await tx.teacher.findUnique({where:{id:input.examinerId}});if(!examiner)throw httpError(404,"Examiner not found");
   if(student.teacherId!==input.examinerId)throw httpError(403,"Examiner is not assigned to this student");
   const effectiveCourseLevel=student.currentCourseLevel??courseLevelFromDisplay(student.courseName,student.courseStage);
   if(effectiveCourseLevel!==input.courseLevel)throw httpError(409,"Submitted courseLevel does not match the student's current course level");
   if(!student.currentCourseLevel){const updated=await tx.student.updateMany({where:{id:student.id,currentCourseLevel:null},data:{currentCourseLevel:effectiveCourseLevel,courseCompleted:false,courseUpdatedAt:new Date()}});if(updated.count!==1)throw httpError(409,"Student level changed during submission");}
   const rule=await tx.examRule.findFirst({where:{courseLevel:input.courseLevel,enabled:true},orderBy:{version:"desc"},include:{sections:{orderBy:{sortOrder:"asc"}},fields:{orderBy:{sortOrder:"asc"},include:{section:true}}}});if(!rule)throw httpError(409,"No active exam rule exists for this course level");
   const result=calculateUsingRule({fields:rule.fields.map(field=>({id:field.id,key:field.key,label:field.label,description:field.description,maximumMarks:field.maximumMarks,sectionKey:field.section.key,sectionLabel:field.section.label,sortOrder:field.sortOrder,required:field.required})),sections:rule.sections.map(section=>({key:section.key,label:section.label,maximumMarks:section.maximumMarks,passingMarks:section.passingMarks,sortOrder:section.sortOrder}))},input.marks);
   const attemptNumber=await tx.examAttempt.count({where:{studentId:input.studentId,courseLevel:input.courseLevel}})+1;
   const exam=await tx.examAttempt.create({data:{studentId:input.studentId,examinerId:input.examinerId!,examRuleId:rule.id,examRuleVersion:rule.version,courseLevel:input.courseLevel,idempotencyKey:input.idempotencyKey,notes:input.notes,outcome:result.outcome,totalScore:result.totalScore,totalMaxScore:result.totalMaxScore,percentage:result.percentage,attemptNumber,createdById:input.createdById,marks:{create:result.marks.map(m=>({examRuleFieldId:m.id,fieldKey:m.key,label:m.label,description:m.description,obtainedMarks:m.obtainedMarks,maximumMarks:m.maximumMarks,sectionKey:m.sectionKey,sectionLabel:m.sectionLabel,sortOrder:m.sortOrder}))},sections:{create:result.sections.map(s=>({sectionKey:s.key,sectionLabel:s.label,obtainedMarks:s.obtainedMarks,maximumMarks:s.maximumMarks,passingMarks:s.passingMarks,passed:s.passed,sortOrder:s.sortOrder??0}))}}});
   let promoted=false;if(result.outcome===ExamOutcome.PASSED){const next=nextCourseLevel(input.courseLevel),display=next?courseDisplay(next):null,updated=await tx.student.updateMany({where:{id:student.id,currentCourseLevel:input.courseLevel,courseCompleted:false},data:{...(next?{currentCourseLevel:next,courseName:display!.courseName,courseStage:display!.courseStage}:{courseCompleted:true}),courseUpdatedAt:new Date()}});if(updated.count!==1)throw httpError(409,"Student level changed during submission");await tx.studentCourseHistory.create({data:{studentId:student.id,fromLevel:input.courseLevel,toLevel:next??input.courseLevel,examAttemptId:exam.id,reason:"EXAM_PASSED",changedById:input.createdById}});promoted=true;}return {id:exam.id,promoted};
  },{isolationLevel:"Serializable"});
  return {statusCode:201,data:await response(saved.id,saved.promoted,input.courseLevel)};
 } catch(error){const replay=await prisma.examAttempt.findUnique({where:{idempotencyKey:input.idempotencyKey}});if(replay)return {statusCode:200,data:await response(replay.id,false,replay.courseLevel)};throw error;}
};

export const listExams = async (query:Record<string,unknown>,scope?:ActorScope) => {const page=Math.max(1,Number(query.page)||1),limit=Math.min(100,Math.max(1,Number(query.limit)||20));const where:Prisma.ExamAttemptWhereInput={};for(const key of ["studentId","examinerId","courseLevel","outcome"] as const)if(typeof query[key]==="string")Object.assign(where,{[key]:query[key]});if(scope&&!scope.isPrivileged){if(scope.studentId)where.studentId=scope.studentId;else if(scope.teacherId)where.examinerId=scope.teacherId;else where.id="__no_access__";}const [items,total]=await prisma.$transaction([prisma.examAttempt.findMany({where,include,orderBy:{submittedAt:"desc"},skip:(page-1)*limit,take:limit}),prisma.examAttempt.count({where})]);return {items,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}};};
const ruleInclude={sections:{orderBy:{sortOrder:"asc" as const}},fields:{orderBy:{sortOrder:"asc" as const},include:{section:true}}} satisfies Prisma.ExamRuleInclude;
type RuleWithDetails=Prisma.ExamRuleGetPayload<{include:typeof ruleInclude}>;
const publicRule = (rule:RuleWithDetails) => ({...rule,fields:rule.fields.map(field=>({id:field.id,key:field.key,label:field.label,description:field.description,maximumMarks:field.maximumMarks,minimumMarks:field.minimumMarks,sectionKey:field.section.key,required:field.required,sortOrder:field.sortOrder})),sections:rule.sections.map(section=>({id:section.id,key:section.key,label:section.label,maximumMarks:section.maximumMarks,passingMarks:section.passingMarks,sortOrder:section.sortOrder}))});
export const listActiveExamRules=async()=>{const rules=await prisma.examRule.findMany({where:{enabled:true},orderBy:{courseLevel:"asc"},include:ruleInclude});return rules.map(publicRule);};
export const getActiveExamRule=async(courseLevel:CourseLevel)=>{const rule=await prisma.examRule.findFirst({where:{courseLevel,enabled:true},orderBy:{version:"desc"},include:ruleInclude});if(!rule)throw httpError(404,"Active exam rule not found");return publicRule(rule);};
export const getExam = async (id:string,scope?:ActorScope) => {const item=await prisma.examAttempt.findUnique({where:{id},include});if(!item)throw httpError(404,"Exam attempt not found");if(scope&&!scope.isPrivileged&&item.studentId!==scope.studentId&&item.examinerId!==scope.teacherId)throw forbidden("You can only access exam records assigned to your account");return withResultDetails(item);};
export const getStudentExamHistory=async(studentId:string,query:Record<string,unknown>)=>{
 const exists=await prisma.student.count({where:{id:studentId}});if(!exists)throw httpError(404,"Student not found");
 const page=Math.max(1,Number(query.page)||1),limit=Math.min(100,Math.max(1,Number(query.limit)||20));
 const where:Prisma.ExamAttemptWhereInput={studentId,status:"SUBMITTED"};
 for(const key of ["courseLevel","outcome","examinerId"] as const)if(typeof query[key]==="string")Object.assign(where,{[key]:query[key]});
 const submittedAt:Prisma.DateTimeFilter={};if(typeof query.submittedFrom==="string")submittedAt.gte=new Date(query.submittedFrom);if(typeof query.submittedTo==="string")submittedAt.lte=new Date(query.submittedTo);if(submittedAt.gte||submittedAt.lte)where.submittedAt=submittedAt;
 const [items,total,counts]=await prisma.$transaction([prisma.examAttempt.findMany({where,include,orderBy:{submittedAt:"desc"},skip:(page-1)*limit,take:limit}),prisma.examAttempt.count({where}),prisma.examAttempt.groupBy({by:["outcome"],where,_count:true})]);
 const passedAttempts=counts.find(item=>item.outcome===ExamOutcome.PASSED)?._count??0;
 return {items:items.map(withResultDetails),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)},summary:{totalAttempts:total,passedAttempts,needsImprovementAttempts:total-passedAttempts}};
};
export const getLatestStudentExam=async(studentId:string)=>{const exists=await prisma.student.count({where:{id:studentId}});if(!exists)throw httpError(404,"Student not found");return withResultDetails(await prisma.examAttempt.findFirst({where:{studentId,status:"SUBMITTED"},include,orderBy:{submittedAt:"desc"}}));};

export const getStudentCourseExamResults = async (studentId:string) => {
 const student=await prisma.student.findUnique({
  where:{id:studentId},
  select:{
   id:true,
   name:true,
   image:true,
   courseName:true,
   courseStage:true,
   currentCourseLevel:true,
   courseCompleted:true,
   examAttempts:{
    where:{status:"SUBMITTED"},
    orderBy:[{courseLevel:"asc"},{attemptNumber:"asc"}],
    select:{
     id:true,
     courseLevel:true,
     attemptNumber:true,
     outcome:true,
     totalScore:true,
     totalMaxScore:true,
     percentage:true,
     notes:true,
     submittedAt:true,
     examiner:{select:{id:true,name:true,imageUrl:true}},
     createdBy:{select:{id:true,name:true,email:true}},
     marks:{orderBy:{sortOrder:"asc"}},
     sections:{orderBy:{sectionKey:"asc"}}
    }
   }
 }
 });
 if(!student)throw httpError(404,"Student not found");
 const currentCourseLevel=student.currentCourseLevel??courseLevelFromDisplay(student.courseName,student.courseStage);

 const courseResults=new Map<CourseLevel,Array<(typeof student.examAttempts)[number]>>();
 for(const attempt of student.examAttempts){
  const attempts=courseResults.get(attempt.courseLevel)??[];
  attempts.push(attempt);
  courseResults.set(attempt.courseLevel,attempts);
 }

 const courseLevels=Array.from(courseResults.entries()).map(([courseLevel,attempts])=>({
  courseLevel,
  ...courseDisplay(courseLevel),
  attempts:attempts.map(attempt=>({
   examAttemptId:attempt.id,
   attemptNumber:attempt.attemptNumber,
   outcome:attempt.outcome,
   resultLabel:attempt.outcome===ExamOutcome.PASSED?"Passed":"Needs Improvement",
   detailsComplete:attempt.marks.length>0,
   notes:attempt.notes,
   submittedAt:attempt.submittedAt,
   examiner:{id:attempt.examiner.id,name:attempt.examiner.name,image:attempt.examiner.imageUrl},
   createdBy:attempt.createdBy,
   subjects:attempt.marks.map(mark=>({
    fieldKey:mark.fieldKey,
    label:mark.label,
    description:mark.description,
    sectionKey:mark.sectionKey,
    sectionLabel:mark.sectionLabel??attempt.sections.find(section=>section.sectionKey===mark.sectionKey)?.sectionLabel??null,
    obtainedMarks:mark.obtainedMarks,
    maximumMarks:mark.maximumMarks,
    sortOrder:mark.sortOrder
   })),
   sections:attempt.sections.map(section=>({
    sectionKey:section.sectionKey,
    sectionLabel:section.sectionLabel,
    obtainedMarks:section.obtainedMarks,
    maximumMarks:section.maximumMarks,
    passingMarks:section.passingMarks,
    passed:section.passed
   })),
   total:{
    obtainedMarks:attempt.totalScore,
    maximumMarks:attempt.totalMaxScore,
    percentage:attempt.percentage
   }
  }))
 }));

 return {
  student:{
   id:student.id,
   name:student.name,
   image:student.image,
   currentCourseLevel,
   courseCompleted:student.courseCompleted
  },
  summary:{
   totalCourseLevels:courseLevels.length,
   totalExamAttempts:student.examAttempts.length
  },
  courseLevels
 };
};

export const getStudentExamDetails = async (id:string) => {
 const student=await prisma.student.findUnique({
  where:{id},
  include:{
   courses:true,
   teacherChanges:{orderBy:{changedAt:"desc"}},
   examAttempts:{
    where:{status:"SUBMITTED"},
    orderBy:{submittedAt:"desc"},
    include:{
     marks:{orderBy:{sortOrder:"asc"}},
     sections:true,
     examiner:{select:{id:true,name:true}}
    }
   },
   courseHistory:{orderBy:{createdAt:"desc"}}
  }
 });
 if(!student)throw httpError(404,"Student not found");
 const currentCourseLevel=student.currentCourseLevel??courseLevelFromDisplay(student.courseName,student.courseStage);

 const examAttempts=student.examAttempts.map(attempt=>({
  ...attempt,
  resultLabel:attempt.outcome===ExamOutcome.PASSED?"Passed":"Needs Improvement",
  detailsComplete:attempt.marks.length>0,
  marks:attempt.marks.map(mark=>({...mark,sectionLabel:mark.sectionLabel??attempt.sections.find(section=>section.sectionKey===mark.sectionKey)?.sectionLabel??null}))
 }));
 const passedAttempts=examAttempts.filter(examAttempt=>examAttempt.outcome===ExamOutcome.PASSED).length;

 return {
  ...student,
  currentCourseLevel,
  ...(currentCourseLevel?courseDisplay(currentCourseLevel):{courseDisplayName:null}),
  examAttempts,
  latestExamAttempt:examAttempts[0]??null,
  examSummary:{
   totalAttempts:examAttempts.length,
   passedAttempts,
   needsImprovementAttempts:examAttempts.length-passedAttempts
  }
 };
};
