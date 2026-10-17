# Escolha de personal no cadastro do aluno

A tela de login oferece **Criar conta de aluno** acima dos campos de acesso. O formulário consulta a função `hpe_public_personals`, que retorna somente ID, nome e disponibilidade dos personais. E-mails e contatos não são expostos. O cadastro não usa link nem código de convite.

## Ativação no Supabase

No projeto `jzvzlcdaywqjhserndyf`, execute `student-personal-selection.sql` pelo SQL Editor ou aplique-o como migração. Ele depende de `accounts.sql` e `student-signup.sql`, e aborta se os gatilhos obrigatórios estiverem ausentes. Não substitua políticas RLS por leitura pública de `hpe_profiles`.

Depois execute `check-personal-selection.sql`. O teste reverte suas alterações e não envia e-mails. Verifique a consulta anônima à função e faça um cadastro real somente com os dados do próprio titular.

O gatilho cria o perfil como aluno e valida o personal no servidor. O controle existente de vagas permanece obrigatório. O personal pode salvar um pré-cadastro somente com o nome; ele fica privado, ocupa uma licença e é associado ao cadastro do aluno quando ele usa o mesmo nome e escolhe aquele personal. Para associação automática mais segura, informe o e-mail também no pré-cadastro. Configure as URLs dos domínios do aplicativo em Authentication → URL Configuration para os links de confirmação de e-mail.

Status desta entrega: código preparado; migração ainda não aplicada ao banco. A consulta verificada em 16/10/2026 retornou PGRST202 (função ausente). O pré-cadastro depende da função hpe-accounts atualizada e da tabela privada hpe_student_drafts criadas por esta migração.
