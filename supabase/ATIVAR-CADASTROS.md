# Ativar cadastro pelo aplicativo

Projeto: jzvzlcdaywqjhserndyf. A conta CEO já deve existir em hpe_profiles.

1. No Supabase, SQL Editor → New query. Cole todo o conteúdo de accounts.sql e clique Run. É uma extensão da configuração já instalada; não substitua pelo arquivo antigo.
2. Edge Functions → Deploy a new function → Via Editor. Use exatamente o nome hpe-accounts.
3. No arquivo index.ts do editor, substitua o exemplo pelo conteúdo completo de functions/hpe-accounts/index.ts deste diretório.
4. Clique Deploy function. Mantenha Verify JWT ativado. A função também valida o token e o perfil no banco.
5. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são variáveis padrão do ambiente de Edge Functions. Não copie chaves secretas para o app nem para conversas. Se a função disser “Servidor ainda não configurado”, confira essas variáveis no painel de secrets do Supabase.
6. Atualize o app, entre como Administrador e clique Atualizar contas. Use Cadastrar personal para criar uma conta real com senha inicial.
7. Saia e entre como o personal criado. Use Meus alunos → Adicionar aluno. O servidor aplica o limite de 20 ou o uso vitalício.
8. Entre como o aluno para confirmar o acesso. O cadastro não envia e-mail: entregue o acesso diretamente ao titular.

Os testes locais verificam tokens ausentes, bloqueio do aluno, papel forjado, limite, criação de professor e limpeza após falha. A execução SQL e a criação real ainda precisam ser verificadas após a publicação no Supabase. Não foram criadas contas de teste no projeto.

Contas, vínculos e licenças ficam no Supabase após ativação. Treinos, agenda, finanças e mensagens permanecem locais; ainda não há sincronização desses registros. Cadastros locais antigos não são migrados automaticamente. Recuperação por e-mail depende de SMTP.
