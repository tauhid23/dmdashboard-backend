import type { Prisma } from "../src/generated/prisma/client.js";
import { prisma } from "../src/config/prisma.js";
import { COURSE_RULES, validateExamRules, type ExamRule as RuleDefinition } from "../src/exam/exam.rules.js";
import { courseDisplay } from "../src/exam/course-progression.js";
import { hashPassword } from "../src/auth/security.js";
import { env } from "../src/config/env.js";
import { ACTIONS, RESOURCES } from "../src/auth/auth.types.js";

validateExamRules();

const permissionRows=RESOURCES.flatMap(resource=>ACTIONS.map(action=>({resource,action,code:`${resource}.${action}`,description:`Can ${action} ${resource}`})));
for(const permission of permissionRows)await prisma.permission.upsert({where:{code:permission.code},create:permission,update:{resource:permission.resource,action:permission.action,description:permission.description}});
const roles=[
  {code:"SUPER_ADMIN",name:"Super Admin",description:"Full system access"},
  {code:"ADMIN",name:"Admin",description:"Operational administrator"},
  {code:"MODERATOR",name:"Moderator",description:"Operational content manager"},
  {code:"TEACHER",name:"Teacher",description:"Teacher access"}
];
const allowed=(role:string,resource:string,action:string)=>role==="SUPER_ADMIN"||(role==="ADMIN"&&!(resource==="user-management"&&action==="delete"))||(role==="MODERATOR"&&((resource==="dashboard"||resource==="settings")&&action==="view"||["students","teachers","class-reports","exams","results"].includes(resource)&&action!=="delete"))||(role==="TEACHER"&&((resource==="dashboard"||resource==="students"||resource==="teachers"||resource==="results"||resource==="settings")&&action==="view"||resource==="class-reports"&&action!=="delete"||resource==="exams"&&(action==="view"||action==="add")));
for(const definition of roles){
  const role=await prisma.role.upsert({where:{code:definition.code},create:{...definition,isSystem:true},update:{name:definition.name,description:definition.description,isSystem:true}});
  const permissions=await prisma.permission.findMany({where:{code:{in:permissionRows.filter(p=>allowed(definition.code,p.resource,p.action)).map(p=>p.code)}}});
  await prisma.rolePermission.deleteMany({where:{roleId:role.id}});
  await prisma.rolePermission.createMany({data:permissions.map(permission=>({roleId:role.id,permissionId:permission.id}))});
}
const superRole=await prisma.role.findUniqueOrThrow({where:{code:"SUPER_ADMIN"}});
const normalizedEmail=env.SUPER_ADMIN_EMAIL.trim().toLowerCase(),normalizedUsername=env.SUPER_ADMIN_USERNAME.trim().toLowerCase();
const existingAdmin=await prisma.user.findFirst({where:{OR:[{normalizedEmail},{normalizedUsername}]}});
if(!existingAdmin)await prisma.user.create({data:{name:"Super Admin",email:env.SUPER_ADMIN_EMAIL,normalizedEmail,username:env.SUPER_ADMIN_USERNAME,normalizedUsername,passwordHash:await hashPassword(env.SUPER_ADMIN_PASSWORD),status:"ACTIVE",roleId:superRole.id}});

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
