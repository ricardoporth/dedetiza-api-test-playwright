import type { ApiResponse } from '@api/api-response';

interface CleanupTask {
  description: string;
  run: () => Promise<ApiResponse>;
}

/**
 * Lista de "desfazer" de um teste: tudo que o teste criou é registrado aqui
 * e removido ao final, mesmo que o teste falhe. A remoção é feita na ordem inversa
 * da criação (o endereço sai antes do cliente, por exemplo).
 */
export class Cleanup {
  private tasks: CleanupTask[] = [];

  add(description: string, run: () => Promise<ApiResponse>) {
    this.tasks.push({ description, run });
  }

  /** Executa tudo e devolve as falhas (não lança erro: limpeza não deve derrubar um teste que passou). */
  async runAll(): Promise<string[]> {
    const failures: string[] = [];
    for (const task of this.tasks.reverse()) {
      try {
        const response = await task.run();
        // 404 = o próprio teste já removeu; não é falha
        if (!response.ok && response.status !== 404) {
          failures.push(`${task.description}: HTTP ${response.status}`);
        }
      } catch (error) {
        failures.push(`${task.description}: ${error}`);
      }
    }
    this.tasks = [];
    return failures;
  }
}
