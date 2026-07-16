import type { Prisma } from "../src/generated/prisma/client.js";
import { prisma } from "../src/config/prisma.js";
import { COURSE_RULES, validateExamRules, type ExamRule as RuleDefinition } from "../src/exam/exam.rules.js";
import { courseDisplay } from "../src/exam/course-progression.js";

validateExamRules();

const matchesDefinition = (
  stored: { totalMaximumMarks:number;sections:Array<{key:string;label:string;maximumMarks:number;passingMarks:number|null;sortOrder:number}>;fields:Array<{key:string;label:string;description:string|null;maximumMarks:number;sortOrder:number;section:{key:string}}> },
  definition: RuleDefinition
) => stored.totalMaximumMarks===definition.fields.reduce((sum,field)=>sum+field.maximumMarks,0)
  && stored.sections.length===definition.sections.length
  && stored.fields.length===definition.fields.length
  && definition.sections.every((section,index)=>{const item=stored.sections.find(value=>value.key===section.key);return item?.label===section.label&&item.maximumMarks===section.maximumMarks&&item.passingMarks===section.passingMarks&&item.sortOrder===index+1;})
  && definition.fields.every(field=>{const item=stored.fields.find(value=>value.key===field.key);return item?.label===field.label&&item.description===field.description&&item.maximumMarks===field.maximumMarks&&item.sortOrder===field.sortOrder&&item.section.key===field.sectionKey;});

const writeDefinition = async (tx:Prisma.TransactionClient,definition:RuleDefinition,version:number,replaceId?:string) => {
  const totalMaximumMarks=definition.fields.reduce((sum,field)=>sum+field.maximumMarks,0);
  if(replaceId)await tx.examRuleSection.deleteMany({where:{examRuleId:replaceId}});
  const data={name:courseDisplay(definition.courseLevel).courseDisplayName,enabled:true,totalMaximumMarks,passingMarks:null,passingPercentage:null,sections:{create:definition.sections.map((section,index)=>({key:section.key,label:section.label,maximumMarks:section.maximumMarks,passingMarks:section.passingMarks,sortOrder:index+1}))}};
  const rule=replaceId
    ?await tx.examRule.update({where:{id:replaceId},data,include:{sections:true}})
    :await tx.examRule.create({data:{...data,courseLevel:definition.courseLevel,version},include:{sections:true}});
  const sectionIds=new Map(rule.sections.map(section=>[section.key,section.id]));
  await tx.examRuleField.createMany({data:definition.fields.map(field=>({examRuleId:rule.id,sectionId:sectionIds.get(field.sectionKey)!,key:field.key,label:field.label,description:field.description,maximumMarks:field.maximumMarks,minimumMarks:0,required:true,sortOrder:field.sortOrder}))});
  return rule.id;
};

for(const definition of Object.values(COURSE_RULES)){
  const fieldTotal=definition.fields.reduce((sum,field)=>sum+field.maximumMarks,0);
  const sectionTotal=definition.sections.reduce((sum,section)=>sum+section.maximumMarks,0);
  if(fieldTotal!==sectionTotal)throw new Error(`${definition.courseLevel}: fields total ${fieldTotal}, sections total ${sectionTotal}`);

  const versions=await prisma.examRule.findMany({where:{courseLevel:definition.courseLevel},orderBy:{version:"asc"},include:{sections:true,fields:{include:{section:true}},_count:{select:{attempts:true}}}});
  const matching=versions.find(version=>matchesDefinition(version,definition));
  if(matching){
    await prisma.$transaction([prisma.examRule.updateMany({where:{courseLevel:definition.courseLevel,enabled:true,id:{not:matching.id}},data:{enabled:false}}),prisma.examRule.update({where:{id:matching.id},data:{enabled:true}})]);
    continue;
  }

  const latest=versions.at(-1);
  await prisma.$transaction(async tx=>{
    await tx.examRule.updateMany({where:{courseLevel:definition.courseLevel,enabled:true},data:{enabled:false}});
    if(latest&&latest._count.attempts===0)await writeDefinition(tx,definition,latest.version,latest.id);
    else await writeDefinition(tx,definition,(latest?.version??0)+1);
  });
}

await prisma.$disconnect();
