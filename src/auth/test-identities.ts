/**
 * Identidades FIXAS usadas pelos testes, além do admin do .env.
 *
 * Diferente da massa de dados comum (criada e removida a cada teste), estas são criadas
 * uma única vez e reaproveitadas para sempre: o login tem limite de 5 tentativas por minuto,
 * então cada identidade precisa de sessão em cache, e a sessão precisa de um usuário estável.
 */
export const NO_PERMISSION_IDENTITY = {
  roleName: '[QA-AUTO] Sem permissões',
  roleDescription: 'Perfil fixo dos testes automatizados, SEM nenhuma permissão. Usado para testar 403. Não remover.',
  userName: '[QA-AUTO] Usuário sem permissões',
  email: 'qa.auto.sem-permissao@example.com',
} as const;
