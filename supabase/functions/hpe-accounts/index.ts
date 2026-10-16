import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const site='https://forja-treino-academia.younggoby6.chatgpt.site';
const cors={'Access-Control-Allow-Origin':site,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=(s)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

Deno.serve(async req=>{
  if(req.headers.get('origin')&&req.headers.get('origin')!==site)return reply(403,{error:'Origem não permitida.'});
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply(405,{error:'Método não permitido.'});
  try{
    const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!secret)return reply(503,{error:'Servidor ainda não configurado.'});
    const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const bearer=req.headers.get('authorization')||'';
    if(!bearer.startsWith('Bearer '))return reply(401,{error:'Entre novamente.'});
    const {data:auth,error:authError}=await admin.auth.getUser(bearer.slice(7));
    if(authError||!auth.user)return reply(401,{error:'Sessão inválida. Entre novamente.'});
    const {data:caller,error:profileError}=await admin.from('hpe_profiles').select('*').eq('id',auth.user.id).single();
    if(profileError||!caller||!['adm','personal'].includes(caller.role))return reply(403,{error:'Seu perfil não permite gerenciar contas.'});
    if(Number(req.headers.get('content-length')||0)>10000)return reply(413,{error:'Dados muito grandes.'});
    const raw=await req.text();if(raw.length>10000)return reply(413,{error:'Dados muito grandes.'});
    let body;try{body=JSON.parse(raw)}catch{return reply(400,{error:'Dados inválidos.'})}
    if(body.action==='list'){
      let query=admin.from('hpe_profiles').select('*').order('created_at');
      if(caller.role==='personal')query=query.or(`id.eq.${caller.id},personal_id.eq.${caller.id}`);
      const {data:profiles,error}=await query;if(error)throw error;
      let requestsQuery=admin.from('hpe_license_requests').select('*').order('created_at');
      if(caller.role==='personal')requestsQuery=requestsQuery.eq('personal_id',caller.id);
      const {data:requests,error:requestsError}=await requestsQuery;if(requestsError)throw requestsError;
      return reply(200,{profiles,requests});
    }
    if(['lifetime','request','approve','reject'].includes(body.action)){
      if(body.action!=='request'&&!uuid(body.target))return reply(400,{error:'Identificador inválido.'});
      if(body.action==='lifetime'&&typeof body.enabled!=='boolean')return reply(400,{error:'Opção inválida.'});
      const {error}=await admin.rpc('hpe_license_action',{actor:caller.id,action:body.action,target:body.action==='request'?caller.id:body.target,enabled:body.enabled===true});
      if(error)return reply(409,{error:'Operação não permitida ou já resolvida. Atualize a lista.'});
      return reply(200,{ok:true});
    }
    if(body.action!=='create')return reply(400,{error:'Operação desconhecida.'});
    const role=caller.role==='adm'?'personal':'aluno';
    const name=typeof body.name==='string'?body.name.trim():'';
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const password=typeof body.password==='string'?body.password:'';
    if(!name||name.length>80||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>128)return reply(400,{error:'Confira nome, e-mail e senha de 8 a 128 caracteres.'});
    const days=body.days??[];
    if(!Array.isArray(days)||days.length>7||days.some((d)=>!Number.isInteger(d)||Number(d)<0||Number(d)>6))return reply(400,{error:'Dias da semana inválidos.'});
    if(role==='aluno'&&!caller.lifetime){
      const {count,error}=await admin.from('hpe_profiles').select('id',{count:'exact',head:true}).eq('role','aluno').eq('personal_id',caller.id);
      if(error)throw error;if((count||0)>=caller.license_limit)return reply(409,{error:'Limite atingido. Solicite mais 20 licenças.'});
    }
    // Criação administrativa: não altera a sessão do personal nem envia e-mail.
    const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(createError||!created.user)return reply(409,{error:'Não foi possível criar a conta. Confira se o e-mail já existe e se a senha atende às regras.'});
    const newProfile={id:created.user.id,name,email,role,personal_id:role==='aluno'?caller.id:null,license_limit:20,lifetime:false,goal:['Hipertrofia','Condicionamento','Força'].includes(body.goal)?body.goal:'Hipertrofia',level:['Iniciante','Intermediário','Avançado'].includes(body.level)?body.level:'Iniciante',training_days:[...new Set(days)]};
    const {error:insertError}=await admin.from('hpe_profiles').insert(newProfile);
    if(insertError){
      const {error:cleanupError}=await admin.auth.admin.deleteUser(created.user.id);
      if(cleanupError)return reply(500,{error:'Cadastro incompleto. O administrador deve revisar a conta em Authentication → Users antes de tentar novamente.'});
      return reply(409,{error:insertError.message.includes('LICENSE_LIMIT')?'Limite atingido. Solicite mais 20 licenças.':'O perfil não pôde ser salvo. Confira a instalação dos comandos do banco.'});
    }
    return reply(201,{profile:newProfile});
  }catch{return reply(500,{error:'Não foi possível concluir. Confira a configuração da função e do banco.'})}
});

