import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const site='https://forja-treino-academia.rodineypatrick69.chatgpt.site';
const allowedOrigins=new Set([site,'https://forcabruta.vercel.app']);
const allowedPreviewOrigin=origin=>/^https:\/\/forcabruta-[a-z0-9-]+-rodineypatrick69-9071\.vercel\.app$/.test(origin||'');
const cors=req=>({'Access-Control-Allow-Origin':req.headers.get('origin')||site,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'});
const reply=(req,status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json','Cache-Control':'no-store'}});
const randomAccessCode=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
const temporaryPassword=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';const bytes=crypto.getRandomValues(new Uint8Array(18));return Array.from(bytes,b=>chars[b%chars.length]).join('')+'!';};
const uuid=(s)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function allowIndependentSignup(req,admin,secret){
  const forwarded=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim();
  const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||forwarded||'unknown').trim().slice(0,128);
  const encoder=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,encoder.encode(ip));
  const ipHash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  const {data,error}=await admin.rpc('hpe_allow_independent_signup',{signup_ip_hash:ipHash});
  if(error)throw error;
  return data===true;
}


Deno.serve(async req=>{
  const origin=req.headers.get('origin');
  if(origin&&!allowedOrigins.has(origin)&&!allowedPreviewOrigin(origin))return reply(req,403,{error:'Origem não permitida.'});
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

    if(body.action==='create_independent_student'){
      const name=typeof body.name==='string'?body.name.trim():'';
      const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
      const password=typeof body.password==='string'?body.password:'';
      const whatsapp=typeof body.whatsapp==='string'?body.whatsapp.trim():'';
      const goal=body.goal,level=body.level;
      const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254;
      const validName=name.length>=2&&name.length<=80&&!/[\u0000-\u001f\u007f]/.test(name);
      const validPassword=password.length>=8&&password.length<=128;
      const validWhatsApp=whatsapp.length<=24&&(!whatsapp||/^\+?[0-9\s().-]{8,24}$/.test(whatsapp));
      if(!validName||!validEmail||!validPassword||!validWhatsApp||
         !['Hipertrofia','Condicionamento','Força'].includes(goal)||
         !['Iniciante','Intermediário','Avançado'].includes(level)){
        return reply(req,400,{error:'Confira o nome, o e-mail, a senha e as opções do perfil.'});
      }
      let allowed;
      try{allowed=await allowIndependentSignup(req,admin,secret)}catch{return reply(req,503,{error:'Cadastro temporariamente indisponível. Tente novamente.'})}
      if(!allowed)return reply(req,429,{error:'Limite de tentativas atingido. Tente novamente em 15 minutos.'});
      let accessCode=null;
      for(let attempt=0;attempt<20;attempt++){
        const candidate=randomAccessCode();
        const {data:existing,error:codeError}=await admin.from('hpe_profiles').select('id').eq('access_code',candidate).maybeSingle();
        if(codeError)return reply(req,503,{error:'Cadastro temporariamente indisponível. Tente novamente.'});
        if(!existing){accessCode=candidate;break}
      }
      if(!accessCode)return reply(req,503,{error:'Não foi possível gerar o acesso agora. Tente novamente.'});
      const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true});
      if(createError||!created.user)return reply(req,409,{error:'Não foi possível criar a conta. Se você já tem cadastro, entre com seu e-mail.'});
      const profile={id:created.user.id,name,email,access_code:accessCode,password_setup_required:false,role:'aluno',personal_id:null,consultation_only:false,license_limit:0,lifetime:false,goal,level,whatsapp,training_days:[]};
      const {error:profileError}=await admin.from('hpe_profiles').insert(profile);
      if(profileError){
        const {error:cleanupError}=await admin.auth.admin.deleteUser(created.user.id);
        if(cleanupError)return reply(req,500,{error:'Não foi possível concluir o cadastro. Entre em contato com o suporte.'});
        return reply(req,409,{error:'Não foi possível concluir o cadastro. Confira os dados e tente novamente.'});
      }
      return reply(req,201,{profile:{id:profile.id,name,role:'aluno',personal_id:null,consultation_only:false,goal,level}});
    }

    const bearer=req.headers.get('authorization')||'';
    if(!bearer.startsWith('Bearer '))return reply(req,401,{error:'Entre novamente.'});
    const {data:auth,error:authError}=await admin.auth.getUser(bearer.slice(7));
    if(authError||!auth.user)return reply(req,401,{error:'Sessão inválida. Entre novamente.'});
    const {data:caller,error:profileError}=await admin.from('hpe_profiles').select('*').eq('id',auth.user.id).single();
    if(profileError||!caller)return reply(req,401,{error:'Sessão inválida. Entre novamente.'});

    if(body.action==='discovery_visibility'){
      if(!['aluno','personal'].includes(caller.role))return reply(req,403,{error:'Este perfil não pode aparecer na busca.'});
      if(body.enabled===false){
        const {error}=await admin.from('hpe_discovery').delete().eq('profile_id',caller.id);
        if(error)return reply(req,503,{error:'A busca ainda precisa ser configurada pelo administrador.'});
        return reply(req,200,{ok:true,visible:false});
      }
      const latitude=body.latitude,longitude=body.longitude;
      if(body.enabled!==true||typeof latitude!=='number'||!Number.isFinite(latitude)||latitude < -90||latitude > 90||typeof longitude!=='number'||!Number.isFinite(longitude)||longitude < -180||longitude > 180)return reply(req,400,{error:'Não foi possível validar a localização.'});
      const {error}=await admin.from('hpe_discovery').upsert({profile_id:caller.id,role:caller.role,latitude,longitude,updated_at:new Date().toISOString()},{onConflict:'profile_id'});
      if(error)return reply(req,503,{error:'A busca ainda precisa ser configurada pelo administrador.'});
      return reply(req,200,{ok:true,visible:true,expires_in_hours:24});
    }
    if(body.action==='discovery_status'){
      if(!['aluno','personal'].includes(caller.role))return reply(req,403,{error:'Este perfil não pode usar a busca.'});
      const {data,error}=await admin.from('hpe_discovery').select('updated_at').eq('profile_id',caller.id).maybeSingle();
      if(error)return reply(req,503,{error:'A busca ainda precisa ser configurada pelo administrador.'});
      const fresh=data&&Date.now()-new Date(data.updated_at).getTime()<24*60*60*1000;
      if(data&&!fresh)await admin.from('hpe_discovery').delete().eq('profile_id',caller.id);
      return reply(req,200,{visible:!!fresh,updated_at:fresh?data.updated_at:null});
    }
    if(body.action==='discovery_nearby'){
      if(!['aluno','personal'].includes(caller.role))return reply(req,403,{error:'Este perfil não pode usar a busca.'});
      const latitude=body.latitude,longitude=body.longitude;
      if(typeof latitude!=='number'||!Number.isFinite(latitude)||latitude < -90||latitude > 90||typeof longitude!=='number'||!Number.isFinite(longitude)||longitude < -180||longitude > 180)return reply(req,400,{error:'Não foi possível validar a localização.'});
      const radiusKm=Number.isFinite(body.radius_km)?Math.min(20,Math.max(1,body.radius_km)):10;
      const targetRole=caller.role==='aluno'?'personal':'aluno';
      let directoryQuery=admin.from('hpe_profiles').select('id,name,role,personal_id,whatsapp,consultation_only').eq('role',targetRole).eq('consultation_only',false).limit(500);
      if(caller.role==='personal')directoryQuery=directoryQuery.is('personal_id',null);
      const {data:directory,error:directoryError}=await directoryQuery;
      if(directoryError)return reply(req,503,{error:'Não foi possível carregar a lista de perfis.'});
      if(!directory?.length)return reply(req,200,{results:[],radius_km:radiusKm,expires_in_hours:24});
      const ids=directory.map(profile=>profile.id);
      const recent=new Date(Date.now()-24*60*60*1000).toISOString();
      await admin.from('hpe_discovery').delete().lt('updated_at',recent);
      const {data:locations,error:locationsError}=await admin.from('hpe_discovery').select('profile_id,latitude,longitude,updated_at').eq('role',targetRole).in('profile_id',ids).gte('updated_at',recent).limit(500);
      if(locationsError)return reply(req,503,{error:'Não foi possível carregar as localizações compartilhadas.'});
      const profiles=new Map(directory.map(profile=>[profile.id,profile]));
      const toRad=degrees=>degrees*Math.PI/180;
      const found=[];
      for(const location of locations||[]){
        const profile=profiles.get(location.profile_id);if(!profile)continue;
        const dLat=toRad(location.latitude-latitude),dLon=toRad(location.longitude-longitude),lat1=toRad(latitude),lat2=toRad(location.latitude);
        const a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
        const distance=12742000*Math.asin(Math.sqrt(Math.min(1,a)));
        if(distance>radiusKm*1000)continue;
        const y=Math.sin(dLon)*Math.cos(lat2),x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
        const bearing=(Math.atan2(y,x)*180/Math.PI+360)%360;
        found.push({name:profile.name,role:profile.role,whatsapp:profile.whatsapp||'',distance_km:Math.round(distance/100)/10,bearing_deg:Math.round(bearing/5)*5%360,updated_at:location.updated_at});
      }
      found.sort((a,b)=>a.distance_km-b.distance_km);
      return reply(req,200,{results:found.slice(0,100),radius_km:radiusKm,expires_in_hours:24});
    }
    if(body.action==='complete_student_password_setup'){
      if(caller.role!=='aluno')return reply(req,403,{error:'Apenas alunos podem concluir a configuração da senha.'});
      if(!caller.password_setup_required)return reply(req,200,{ok:true});
      const {error}=await admin.from('hpe_profiles').update({password_setup_required:false}).eq('id',caller.id).eq('role','aluno');
      if(error)return reply(req,409,{error:'A senha foi alterada, mas não conseguimos concluir a configuração. Tente novamente.'});
      return reply(req,200,{ok:true});
    }
    if(!['adm','personal'].includes(caller.role))return reply(req,403,{error:'Seu perfil não permite gerenciar contas.'});
    if(body.action==='create_consultation_student'){
      if(caller.role!=='personal')return reply(req,403,{error:'Somente o personal pode cadastrar alunos da consultoria.'});
      const name=typeof body.name==='string'?body.name.trim():'';
      const whatsapp=typeof body.whatsapp==='string'?body.whatsapp.trim():'';
      const goal=['Hipertrofia','Condicionamento','Força'].includes(body.goal)?body.goal:'Hipertrofia';
      const level=['Iniciante','Intermediário','Avançado'].includes(body.level)?body.level:'Iniciante';
      if(name.length<2||name.length>80||whatsapp.length>24||(whatsapp&&!/^\+?[0-9\s().-]{8,24}$/.test(whatsapp)))return reply(req,400,{error:'Confira o nome e o WhatsApp do aluno.'});
      let accessCode=null;
      for(let attempt=0;attempt<20;attempt++){
        const candidate=randomAccessCode();
        const {data:existing,error:codeError}=await admin.from('hpe_profiles').select('id').eq('access_code',candidate).maybeSingle();
        if(codeError)return reply(req,503,{error:'Não foi possível gerar um código de acesso. Tente novamente.'});
        if(!existing){accessCode=candidate;break}
      }
      if(!accessCode)return reply(req,503,{error:'Não foi possível gerar um código único. Tente novamente.'});
      const email='aluno.'+crypto.randomUUID()+'@hpe.invalid',password=temporaryPassword();
      const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true});
      if(createError||!created.user)return reply(req,409,{error:'Não foi possível criar a conta do aluno. Tente novamente.'});
      const profile={id:created.user.id,name,email,access_code:accessCode,password_setup_required:true,role:'aluno',personal_id:null,consultation_only:true,license_limit:20,lifetime:false,goal,level,whatsapp,training_days:[]};
      const {error:profileError}=await admin.from('hpe_profiles').insert(profile);
      if(profileError){const {error:cleanupError}=await admin.auth.admin.deleteUser(created.user.id);if(cleanupError)return reply(req,500,{error:'Cadastro incompleto. O administrador deve revisar a conta em Authentication → Users.'});return reply(req,409,{error:'O perfil do aluno não pôde ser salvo. Atualize o banco do HPE e tente novamente.'})}
      const {data:consultation,error:consultationError}=await admin.from('hpe_consultation_students').insert({personal_id:caller.id,student_id:created.user.id,name,personal_name:caller.name||'Personal',whatsapp,goal,level}).select('*').single();
      if(consultationError){const {error:cleanupError}=await admin.auth.admin.deleteUser(created.user.id);if(cleanupError)return reply(req,500,{error:'Cadastro incompleto. O administrador deve revisar a conta em Authentication → Users.'});return reply(req,409,{error:'Não foi possível criar o acompanhamento da consultoria.'})}
      return reply(req,201,{profile:{id:profile.id,name,role:profile.role,personal_id:null,consultation_only:true,access_code:accessCode},consultation,access_code:accessCode,temporary_password:password});
    }
    if(body.action==='remove_consultation_student'){
      if(caller.role!=='personal'||!uuid(body.target))return reply(req,403,{error:'Ação não permitida.'});
      const {data:consultation,error:consultationError}=await admin.from('hpe_consultation_students').select('id,student_id').eq('id',body.target).eq('personal_id',caller.id).maybeSingle();
      if(consultationError||!consultation)return reply(req,404,{error:'Aluno não encontrado na sua carteira.'});
      const folder=caller.id+'/'+consultation.id;
      for(;;){
        const {data:objects,error:listError}=await admin.storage.from('hpe-consultation-media').list(folder,{limit:1000,offset:0,sortBy:{column:'name',order:'asc'}});
        if(listError)return reply(req,503,{error:'Não foi possível remover as fotos privadas. Tente novamente.'});
        const paths=(objects||[]).filter(object=>object.name&&object.id).map(object=>folder+'/'+object.name);
        if(!paths.length)break;
        for(let i=0;i<paths.length;i+=100){const {error:removeError}=await admin.storage.from('hpe-consultation-media').remove(paths.slice(i,i+100));if(removeError)return reply(req,503,{error:'Não foi possível remover as fotos privadas. Tente novamente.'})}
        if((objects||[]).length<1000)break;
      }
      const {error:deleteError}=await admin.auth.admin.deleteUser(consultation.student_id,false);
      if(deleteError)return reply(req,409,{error:'As fotos foram removidas, mas não foi possível encerrar a conta. Tente novamente.'});
      return reply(req,200,{ok:true});
    }
    if(body.action==='reset_consultation_student_password'){
      if(caller.role!=='personal'||!uuid(body.target))return reply(req,403,{error:'Ação não permitida.'});
      const {data:consultation,error:consultationError}=await admin.from('hpe_consultation_students').select('student_id').eq('id',body.target).eq('personal_id',caller.id).maybeSingle();
      if(consultationError||!consultation)return reply(req,404,{error:'Aluno não encontrado na sua carteira.'});
      const {data:student,error:studentError}=await admin.from('hpe_profiles').select('id,access_code').eq('id',consultation.student_id).eq('role','aluno').eq('consultation_only',true).maybeSingle();
      if(studentError||!student)return reply(req,404,{error:'Conta da consultoria não encontrada.'});
      const password=temporaryPassword();
      const {error:flagError}=await admin.from('hpe_profiles').update({password_setup_required:true}).eq('id',student.id);
      if(flagError)return reply(req,409,{error:'Não foi possível preparar a redefinição. Tente novamente.'});
      const {error}=await admin.auth.admin.updateUserById(student.id,{password});
      if(error){await admin.from('hpe_profiles').update({password_setup_required:false}).eq('id',student.id);return reply(req,409,{error:'Não foi possível redefinir a senha. Tente novamente.'})}
      return reply(req,200,{access_code:student.access_code,temporary_password:password});
    }
    if(body.action==='list'){
      let query=admin.from('hpe_profiles').select('*').eq('consultation_only',false).order('created_at');
      if(caller.role==='personal')query=query.or(`id.eq.${caller.id},personal_id.eq.${caller.id}`);
      const {data:profiles,error}=await query;if(error)throw error;
      let requestsQuery=admin.from('hpe_license_requests').select('*').order('created_at');
      if(caller.role==='personal')requestsQuery=requestsQuery.eq('personal_id',caller.id);
      const {data:requests,error:requestsError}=await requestsQuery;if(requestsError)throw requestsError;
      return reply(req,200,{profiles:profiles.map(p=>p.role==='aluno'?{...p,email:null}:p),requests});
    }
    if(body.action==='set_license_limit'){
      if(caller.role!=='adm')return reply(req,403,{error:'Apenas o administrador pode alterar limites de licença.'});
      if(!uuid(body.target))return reply(req,400,{error:'Personal inválido.'});
      if(!Number.isSafeInteger(body.limit)||body.limit<0||body.limit>100000)return reply(req,400,{error:'Informe um limite inteiro entre 0 e 100.000.'});
      const {data:personal,error}=await admin.from('hpe_profiles').update({license_limit:body.limit}).eq('id',body.target).eq('role','personal').select('id,license_limit').maybeSingle();
      if(error)return reply(req,409,{error:'Não foi possível salvar o limite de licenças. Tente novamente.'});
      if(!personal)return reply(req,404,{error:'Personal não encontrado. Atualize a lista.'});
      return reply(req,200,{ok:true,personal});
    }
    if(['lifetime','request','approve','reject'].includes(body.action)){
      if(body.action!=='request'&&!uuid(body.target))return reply(req,400,{error:'Identificador inválido.'});
      if(body.action==='lifetime'&&typeof body.enabled!=='boolean')return reply(req,400,{error:'Opção inválida.'});
      const {error}=await admin.rpc('hpe_license_action',{actor:caller.id,action:body.action,target:body.action==='request'?caller.id:body.target,enabled:body.enabled===true});
      if(error)return reply(req,409,{error:'Operação não permitida ou já resolvida. Atualize a lista.'});
      return reply(req,200,{ok:true});
    }
    if(body.action==='update_personal'||body.action==='reset_personal_password'){
      if(caller.role!=='adm')return reply(req,403,{error:'Apenas o administrador pode gerenciar personais.'});
      if(!uuid(body.target))return reply(req,400,{error:'Identificador inválido.'});
      const {data:personal,error:personalError}=await admin.from('hpe_profiles').select('id,name,email,role').eq('id',body.target).eq('role','personal').maybeSingle();
      if(personalError||!personal)return reply(req,404,{error:'Personal não encontrado. Atualize a lista.'});
      if(body.action==='reset_personal_password'){
        const password=temporaryPassword();
        const {error}=await admin.auth.admin.updateUserById(personal.id,{password});
        if(error)return reply(req,409,{error:'Não foi possível gerar a nova senha. Tente novamente.'});
        return reply(req,200,{email:personal.email,new_password:password});
      }
      const name=typeof body.name==='string'?body.name.trim():'';
      const whatsapp=typeof body.whatsapp==='string'?body.whatsapp.trim():'';
      if(name.length<2||name.length>80||whatsapp.length>24||(whatsapp&&!/^\+?[0-9\s().-]{8,24}$/.test(whatsapp)))return reply(req,400,{error:'Confira o nome e o WhatsApp do personal.'});
      const {data:changed,error}=await admin.from('hpe_profiles').update({name,whatsapp}).eq('id',personal.id).eq('role','personal').select('id').maybeSingle();
      if(error||!changed)return reply(req,409,{error:'Não foi possível salvar o perfil. Atualize a lista e tente novamente.'});
      return reply(req,200,{ok:true});
    }
    if(body.action==='reset_student_password'){
      if(!uuid(body.target))return reply(req,400,{error:'Identificador inválido.'});
      let studentQuery=admin.from('hpe_profiles').select('id,personal_id,access_code,role').eq('id',body.target).eq('role','aluno').eq('consultation_only',false);
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
      let studentQuery=admin.from('hpe_profiles').select('id').eq('id',body.target).eq('role','aluno').eq('consultation_only',false);
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
    const newProfile={id:created.user.id,name,email:authEmail,access_code:accessCode,password_setup_required:studentAccount,role,personal_id:studentAccount?caller.id:null,consultation_only:false,license_limit:20,lifetime:false,goal:['Hipertrofia','Condicionamento','Força'].includes(body.goal)?body.goal:'Hipertrofia',level:['Iniciante','Intermediário','Avançado'].includes(body.level)?body.level:'Iniciante',whatsapp:studentAccount&&typeof body.whatsapp==='string'?body.whatsapp.slice(0,24):'',training_days:[...new Set(days)]};
    const {error:insertError}=await admin.from('hpe_profiles').insert(newProfile);
    if(insertError){
      const {error:cleanupError}=await admin.auth.admin.deleteUser(created.user.id);
      if(cleanupError)return reply(req,500,{error:'Cadastro incompleto. O administrador deve revisar a conta em Authentication → Users antes de tentar novamente.'});
      return reply(req,409,{error:insertError.message.includes('LICENSE_LIMIT')?'Limite atingido. Solicite mais 20 licenças.':'O perfil não pôde ser salvo. Aplique student-access.sql no SQL Editor do Supabase.'});
    }
    return reply(req,201,studentAccount?{profile:{id:newProfile.id,name,role,personal_id:newProfile.personal_id,access_code:accessCode,goal:newProfile.goal,level:newProfile.level,training_days:newProfile.training_days},access_code:accessCode,temporary_password:initialPassword}:{profile:newProfile});
  }catch{return reply(req,500,{error:'Não foi possível concluir. Confira a configuração da função e do banco.'})}
});

