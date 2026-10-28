# Edição e nova senha do personal

Versão 51. Publique `functions/hpe-accounts/index.ts` como a função `hpe-accounts` no projeto Supabase `jzvzlcdaywqjhserndyf`. Preserve a configuração de verificação JWT da função existente, pois ela também atende ao login público por código do aluno e valida os tokens internamente para operações administrativas.

As ações `update_personal` e `reset_personal_password` exigem perfil `adm` validado no banco. A primeira altera apenas nome e WhatsApp; a segunda gera uma senha e a retorna uma única vez, sem armazená-la no perfil ou em logs. Nenhuma mudança de tabela é necessária.

Validação local: `node check-accounts.cjs`. A ativação no Supabase não foi realizada: as conexões disponíveis em 28/10/2026 não têm acesso ao projeto do HPE. Não foram redefinidas senhas de contas reais.
