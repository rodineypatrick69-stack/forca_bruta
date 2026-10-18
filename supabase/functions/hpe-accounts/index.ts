import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const site='https://forja-treino-academia.younggoby6.chatgpt.site';
const allowedOrigins=new Set([site,'https://forcabruta.vercel.app']);
const cors=req=>({'Access-Control-Allow-Origin':req.headers.get('origin')||site,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'});
const reply=(req,status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json','Cache-Control':'no-store'}});
const randomAccessCode=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
const temporaryPassword=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';const bytes=crypto.getRandomValues(new Uint8Array(18));return Array.from(bytes,b=>chars[b%chars.length]).join('')+'!';};
const uuid=(s)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

Deno.serve(async req=>{
  const origin=req.headers.get('origin');
  if(origin&&!allowedOrigins.has(origin))return reply(req,403,{error:'Origem não permitida.'});
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return reply(req,405,{error:'Método não permitido.'});
  try{
    const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!secret)return reply(req,503,{error:'Servidor ainda não configurado.'});
    const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    if(Number(req.headers.get('content-length')||0)>10000)return reply(req,413,{error:'Dados muito grandes.'});
    const raw=await req.text();if(raw.length>10000)return reply(req,413,{error:'Dados muito grandes.'});
    let body;try{body=JSON.parse(raw)}catch{return reply(req,400,{error:'Dados inválidos.'})}
    if(body.action==='student_login'){
      const code=typeof body.access_code==='string'?body.access_code.trim().toUpperCase():'';
      const password=typeof body.password==='string'?body.password:'';
      if(!/^(?:[0-9]{6}|[A-F0-9]{16})$/.test(code)||password.length<1||password.length>128)return reply(req,401,{error:'Código ou senha inválidos.'});
      const {data:student,error:lookupError}=await admin.from('hpe_profiles').select('id,email,password_setup_required').eq('access_code',code).eq('role','aluno').maybeSingle();
      if(lookupError)return reply(req,503,{error:'Login temporariamente indisponível.'});
      if(!student?.email)return reply(req,401,{error:'Código ou senha inválidos.'});
      const anonKey=Deno.env.get('SUPABASE_ANON_KEY');
      if(!anonKey)return reply(req,503,{error:'Login temporariamente indisponível.'});
      const publicAuth=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data:login,error:loginError}=await publicAuth.auth.signInWithPassword({email:student.email,password});
      if(loginError||!login.session)return reply(req,401,{error:'Código ou senha inválidos.'});
      return reply(req,200,{session:login.session,must_set_password:student.password_setup_required===true});
    }
    const bearer=req.headers.get('authorization')||'';
    if(!bearer.startsWith('Bearer '))return reply(req,401,{error:'Entre novamente.'});
    const {data:auth,error:authError}=await admin.auth.getUser(bearer.slice(7));
    if(authError||!auth.user)return reply(req,401,{error:'Sessão inválida. Entre novamente.'});
    const {data:caller,error:profileError}=await admin.from('hpe_profiles').select('*').eq('id',auth.user.id).single();
    if(profileError||!caller)return reply(req,401,{error:'Sessão inválida. Entre novamente.'});
    if(body.action==='complete_student_password_setup'){
      if(caller.role!=='aluno')return reply(req,403,{error:'Apenas alunos podem concluir a configuração da senha.'});
      if(!caller.password_setup_required)return reply(req,200,{ok:true});
      const {error}=await admin.from('hpe_profiles').update({password_setup_required:false}).eq('id',caller.id).eq('role','aluno');
      if(error)return reply(req,409,{error:'A senha foi alterada, mas não conseguimos concluir a configuração. Tente novamente.'});
      return reply(req,200,{ok:true});
    }
    if(!['adm','personal'].includes(caller.role))return reply(req,403,{error:'Seu perfil não permite gerenciar contas.'});
    if(body.action==='list'){
      let query=admin.from('hpe_profiles').select('*').order('created_at');
      if(caller.role==='personal')query=query.or(`id.eq.${caller.id},personal_id.eq.${caller.id}`);
      const {data:profiles,error}=await query;if(error)throw error;
      let requestsQuery=admin.from('hpe_license_requests').select('*').order('created_at');
      if(caller.role==='personal')requestsQuery=requestsQuery.eq('personal_id',caller.id);
      const {data:requests,error:requestsError}=await requestsQuery;if(requestsError)throw requestsError;
      return reply(req,200,{profiles:profiles.map(p=>p.role==='aluno'?{...p,email:null}:p),requests});
    }
    if(['lifetime','request','approve','reject'].includes(body.action)){
      if(body.action!=='request'&&!uuid(body.target))return reply(req,400,{error:'Identificador inválido.'});
      if(body.action==='lifetime'&&typeof body.enabled!=='boolean')return reply(req,400,{error:'Opção inválida.'});
      const {error}=await admin.rpc('hpe_license_action',{actor:caller.id,action:body.action,target:body.action==='request'?caller.id:body.target,enabled:body.enabled===true});
      if(error)return reply(req,409,{error:'Operação não permitida ou já resolvida. Atualize a lista.'});
      return reply(req,200,{ok:true});
    }
    if(body.action==='reset_student_password'){
      if(!uuid(body.target))return reply(req,400,{error:'Identificador inválido.'});
      let studentQuery=admin.from('hpe_profiles').select('id,personal_id,access_code,role').eq('id',body.target).eq('role','aluno');
      if(caller.role==='personal')studentQuery=studentQuery.eq('personal_id',caller.id);
      const {data:student,error:studentError}=await studentQuery.maybeSingle();
      if(studentError||!student)return reply(req,404,{error:'Aluno não encontrado na sua lista.'});
      const password=temporaryPassword();
      const {error:flagError}=await admin.from('hpe_profiles').update({password_setup_required:true}).eq('id',student.id).eq('role','aluno');
      if(flagError)return reply(req,409,{error:'Não foi possível preparar a redefinição. Tente novamente.'});
      const {error}=await admin.auth.admin.updateUserById(student.id,{password});
      if(error){await admin.from('hpe_profiles').update({password_setup_required:false}).eq('id',student.id).eq('role','aluno');return reply(req,409,{error:'Não foi possível redefinir a senha. Tente novamente.'});}
      return reply(req,200,{access_code:student.access_code,temporary_password:password});
    }
    if(body.action==='update_student'||body.action==='delete_student'){
      if(!uuid(body.target))return reply(req,400,{error:'Identificador inválido.'});
      let studentQuery=admin.from('hpe_profiles').select('id').eq('id',body.target).eq('role','aluno');
      if(caller.role==='personal')studentQuery=studentQuery.eq('personal_id',caller.id);
      const {data:student,error:studentError}=await studentQuery.maybeSingle();
      if(studentError||!student)return reply(req,404,{error:'Aluno não encontrado na sua lista.'});
      if(body.action==='delete_student'){
        const {error}=await admin.auth.admin.deleteUser(student.id,false);
        if(error)return reply(req,409,{error:'Não foi possível excluir a conta do aluno. Tente novamente.'});
        return reply(req,200,{ok:true});
      }
      const name=typeof body.name==='string'?body.name.trim():'';
      const goal=body.goal,level=body.level,days=body.days;
      const whatsapp=typeof body.whatsapp==='string'?body.whatsapp.trim():'';
      if(!name||name.length>80||!['Hipertrofia','Condicionamento','Força'].includes(goal)||!['Iniciante','Intermediário','Avançado'].includes(level)||!Array.isArray(days)||days.length>7||days.some(d=>!Number.isInteger(d)||d<0||d>6)||whatsapp.length>24||whatsapp&&!/^\+?[0-9\s().-]{8,24}$/.test(whatsapp))return reply(req,400,{error:'Confira nome, WhatsApp, objetivo, nível e dias de treino.'});
      let update=admin.from('hpe_profiles').update({name,whatsapp,goal,level,training_days:[...new Set(days)]}).eq('id',student.id).eq('role','aluno');
      if(caller.role==='personal')update=update.eq('personal_id',caller.id);
      const {data:changed,error}=await update.select('id').maybeSingle();
      if(error||!changed)return reply(req,409,{error:'Não foi possível salvar o perfil. Atualize a lista e tente novamente.'});
      return reply(req,200,{ok:true});
    }
    if(body.action!=='create')return reply(req,400,{error:'Operação desconhecida.'});
    const role=caller.role==='adm'?'personal':'aluno';
    const name=typeof body.name==='string'?body.name.trim():'';
    const studentAccount=role==='aluno';
    const email=studentAccount?'':typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const password=typeof body.password==='string'?body.password:'';
    if(!name||name.length>80||(!studentAccount&&(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>128)))return reply(req,400,{error:studentAccount?'Confira o nome do aluno.':'Confira nome, e-mail e senha de 8 a 128 caracteres.'});
    const days=body.days??[];
    if(!Array.isArray(days)||days.length>7||days.some((d)=>!Number.isInteger(d)||Number(d)<0||Number(d)>6))return reply(req,400,{error:'Dias da semana inválidos.'});
    if(studentAccount&&!caller.lifetime){
      const {count,error}=await admin.from('hpe_profiles').select('id',{count:'exact',head:true}).eq('role','aluno').eq('personal_id',caller.id);
      if(error)throw error;if((count||0)>=caller.license_limit)return reply(req,409,{error:'Limite atingido. Solicite mais 20 licenças.'});
    }
    let accessCode=null;
    if(studentAccount){
      for(let attempt=0;attempt<20;attempt++){
        const candidate=randomAccessCode();
        const {data:existing,error:codeError}=await admin.from('hpe_profiles').select('id').eq('access_code',candidate).maybeSingle();
        if(codeError)return reply(req,503,{error:'Não foi possível gerar um código de acesso. Tente novamente.'});
        if(!existing){accessCode=candidate;break;}
      }
      if(!accessCode)return reply(req,503,{error:'Não foi possível gerar um código único. Tente novamente.'});
    }
    const authEmail=studentAccount?'aluno.'+crypto.randomUUID()+'@hpe.invalid':email;
    const initialPassword=studentAccount?temporaryPassword():password;
    const {data:created,error:createError}=await admin.auth.admin.createUser({email:authEmail,password:initialPassword,email_confirm:true});
    if(createError||!created.user)return reply(req,409,{error:studentAccount?'Não foi possível criar a conta do aluno. Tente novamente.':'Não foi possível criar a conta. Confira se o e-mail já existe e se a senha atende às regras.'});
    const newProfile={id:created.user.id,name,email:authEmail,access_code:accessCode,password_setup_required:studentAccount,role,personal_id:studentAccount?caller.id:null,license_limit:20,lifetime:false,goal:['Hipertrofia','Condicionamento','Força'].includes(body.goal)?body.goal:'Hipertrofia',level:['Iniciante','Intermediário','Avançado'].includes(body.level)?body.level:'Iniciante',whatsapp:studentAccount&&typeof body.whatsapp==='string'?body.whatsapp.slice(0,24):'',training_days:[...new Set(days)]};
    const {error:insertError}=await admin.from('hpe_profiles').insert(newProfile);
    if(insertError){
      const {error:cleanupError}=await admin.auth.admin.deleteUser(created.user.id);
      if(cleanupError)return reply(req,500,{error:'Cadastro incompleto. O administrador deve revisar a conta em Authentication → Users antes de tentar novamente.'});
      return reply(req,409,{error:insertError.message.includes('LICENSE_LIMIT')?'Limite atingido. Solicite mais 20 licenças.':'O perfil não pôde ser salvo. Aplique student-access.sql no SQL Editor do Supabase.'});
    }
    return reply(req,201,studentAccount?{profile:{id:newProfile.id,name,role,personal_id:newProfile.personal_id,access_code:accessCode,goal:newProfile.goal,level:newProfile.level,training_days:newProfile.training_days},access_code:accessCode,temporary_password:initialPassword}:{profile:newProfile});
  }catch{return reply(req,500,{error:'Não foi possível concluir. Confira a configuração da função e do banco.'})}
});

