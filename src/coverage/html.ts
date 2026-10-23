import type { CoverageModel, ModuleCoverage, ModuleState, OperationCoverage } from './coverage-model';

const STATE_LABEL: Record<ModuleState, string> = {
  'nao-iniciado': 'Não iniciado',
  'em-andamento': 'Em andamento',
  completo: 'Completo',
};

/** Gera a página de cobertura: um único arquivo HTML, sem dependências externas. */
export function renderHtml(model: CoverageModel): string {
  const { totals } = model;
  const modules = [...model.modules].sort(
    (a, b) => Number(a.state === 'nao-iniciado') - Number(b.state === 'nao-iniciado'),
  );
  const generatedAt = model.generatedAt.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  });

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cobertura · Dedetiza API</title>
<style>${STYLES}</style>
</head>
<body>
<div class="page">
  <header class="top">
    <div>
      <h1>Dedetiza API</h1>
      <p class="sub">Cobertura das rotas do Swagger pelos testes automatizados</p>
    </div>
    <p class="meta">
      Gerado em ${escape(generatedAt)}<br>
      ${model.specFromCache
        ? '<span class="warn-text">Swagger: cópia local (não foi possível baixar o atual)</span>'
        : 'Swagger: versão atual'}
    </p>
  </header>

  <section class="cards">
    ${card('Rotas cobertas', `${totals.coveredOperations}<small> / ${totals.operations}</small>`, percent(totals.coveredOperations, totals.operations), true)}
    ${card('Respostas documentadas testadas', `${totals.coveredStatuses}<small> / ${totals.documentedStatuses}</small>`, percent(totals.coveredStatuses, totals.documentedStatuses), true)}
    ${card('Módulos iniciados', `${totals.startedModules}<small> / ${totals.modules}</small>`, percent(totals.startedModules, totals.modules), true)}
    ${card('Regras de negócio mapeadas', String(totals.rules))}
    ${card('Bugs conhecidos', String(totals.bugs), undefined, false, totals.bugs > 0 ? 'warn' : '')}
    ${card('Testes', String(totals.tests), totals.failingTests > 0 ? `${totals.failingTests} falhando` : 'todos passando', false, totals.failingTests > 0 ? 'bad' : '')}
  </section>

  <section class="toolbar">
    <input id="search" type="search" placeholder="Buscar rota, módulo ou descrição…" aria-label="Buscar">
    <div class="seg" role="group" aria-label="Filtrar rotas">
      <button type="button" data-filter="all" class="active">Todas</button>
      <button type="button" data-filter="covered">Cobertas</button>
      <button type="button" data-filter="uncovered">Não cobertas</button>
    </div>
    <button type="button" id="toggle-all" class="ghost">Expandir tudo</button>
  </section>

  <main id="modules">
    ${modules.map(renderModule).join('\n')}
    <p id="empty" class="empty" hidden>Nenhuma rota encontrada para esse filtro.</p>
  </main>

  ${renderUnknownCalls(model)}

  <footer class="legend">
    <span><span class="chip ok">201 ✓</span> status documentado e testado</span>
    <span><span class="chip todo">409</span> status documentado, ainda sem teste</span>
    <span><span class="chip undoc">404 !</span> recebido nos testes, mas não documentado no Swagger</span>
  </footer>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
}

function card(label: string, value: string, detail?: string, bar = false, tone = '') {
  const pct = bar && detail ? detail : '';
  return `<div class="card ${tone}">
    <span class="card-label">${escape(label)}</span>
    <span class="card-value">${value}</span>
    ${bar ? `<span class="bar"><span style="width:${pct.replace(',', '.')}"></span></span>` : ''}
    ${detail ? `<span class="card-detail">${escape(detail)}</span>` : ''}
  </div>`;
}

function renderModule(module: ModuleCoverage): string {
  const total = module.operations.length;
  const pct = percent(module.coveredOperations, total);
  return `<details class="module" data-module="${escape(module.name.toLowerCase())}"${module.state !== 'nao-iniciado' ? ' open' : ''}>
    <summary>
      <span class="mod-name">${escape(module.name)}</span>
      <span class="state state-${module.state}">${STATE_LABEL[module.state]}</span>
      <span class="mod-progress"><span class="bar"><span style="width:${pct.replace(',', '.')}"></span></span>
      <span class="count">${module.coveredOperations}/${total}</span></span>
    </summary>
    <div class="ops">
      ${module.operations.map(renderOperation).join('\n')}
    </div>
    ${renderNotes(module)}
  </details>`;
}

function renderOperation(operation: OperationCoverage): string {
  const search = `${operation.module} ${operation.method} ${operation.path} ${operation.summary ?? ''}`.toLowerCase();
  const chips = [
    ...operation.documentedStatuses.map((status) =>
      operation.coveredStatuses.includes(status)
        ? `<span class="chip ok" title="Testado">${status} ✓</span>`
        : `<span class="chip todo" title="Documentado, ainda sem teste">${status}</span>`,
    ),
    ...operation.undocumentedStatuses.map(
      (status) => `<span class="chip undoc" title="Recebido nos testes, mas não documentado no Swagger">${status} !</span>`,
    ),
  ].join('');

  const tests = operation.tests.length
    ? `<details class="tests"><summary>${operation.tests.length} ${operation.tests.length === 1 ? 'teste' : 'testes'}</summary><ul>${operation.tests
        .map((test) => `<li class="${test.passing ? '' : 'failing'}">${escape(test.title)}${test.passing ? '' : ' <b>(falhando)</b>'}</li>`)
        .join('')}</ul></details>`
    : '<span class="no-tests">sem testes</span>';

  return `<div class="op${operation.covered ? ' covered' : ''}" data-covered="${operation.covered ? 1 : 0}" data-search="${escape(search)}">
    <span class="method m-${operation.method.toLowerCase()}">${operation.method}</span>
    <div class="route">
      <code>${highlightParams(operation.path)}</code>
      ${operation.summary ? `<span class="summary">${escape(operation.summary)}</span>` : ''}
    </div>
    <div class="chips">${chips || '<span class="no-tests">nenhum status documentado</span>'}</div>
    <div class="test-list">${tests}</div>
  </div>`;
}

function renderNotes(module: ModuleCoverage): string {
  const sections: string[] = [];
  if (module.rules.length) {
    sections.push(`<div class="note rules"><h3>Regras de negócio</h3><ul>${module.rules
      .map((rule) => `<li>${escape(rule.text)}<span class="from">${escape(rule.test)}</span></li>`)
      .join('')}</ul></div>`);
  }
  if (module.bugs.length) {
    sections.push(`<div class="note bugs"><h3>Bugs conhecidos</h3><ul>${module.bugs
      .map((bug) => `<li>${escape(bug.text)}<span class="from">${escape(bug.test)}</span></li>`)
      .join('')}</ul></div>`);
  }
  if (module.failingTests.length) {
    sections.push(`<div class="note failing"><h3>Testes falhando</h3><ul>${module.failingTests
      .map((test) => `<li>${escape(test.title)}<span class="from">${escape(test.file)}</span></li>`)
      .join('')}</ul></div>`);
  }
  return sections.length ? `<div class="notes">${sections.join('')}</div>` : '';
}

function renderUnknownCalls(model: CoverageModel): string {
  if (!model.unknownCalls.length) return '';
  return `<section class="unknown">
    <h2>Rotas chamadas pelos testes que não existem no Swagger</h2>
    <p>Podem ter sido removidas ou renomeadas na API, ou o client está usando a rota errada.</p>
    <ul>${model.unknownCalls
      .map((call) => `<li><span class="method m-${call.method.toLowerCase()}">${call.method}</span> <code>${escape(call.path)}</code> <span class="from">${escape(call.tests.join(' · '))}</span></li>`)
      .join('')}</ul>
  </section>`;
}

function percent(part: number, total: number): string {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(1).replace('.', ',').replace(',0', '')}%`;
}

function highlightParams(path: string): string {
  return escape(path).replace(/\{(\w+)\}/g, '<span class="param">{$1}</span>');
}

function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const STYLES = `
:root {
  --bg: #f6f7f9; --surface: #ffffff; --surface-2: #f0f2f5; --border: #e2e5ea;
  --text: #1c2330; --muted: #5d6675; --accent: #2563eb;
  --ok: #157f3b; --ok-bg: #e3f5e9; --todo: #6b7280; --todo-bg: #f3f4f6;
  --warn: #9a5b00; --warn-bg: #fff3d6; --bad: #b42318; --bad-bg: #fde8e7;
  --get: #2563eb; --post: #15803d; --put: #c2410c; --patch: #7c3aed; --delete: #dc2626;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0f1218; --surface: #171b23; --surface-2: #1f2430; --border: #2a303d;
    --text: #e6e9ef; --muted: #9aa3b2; --accent: #6b9bff;
    --ok: #5fd08a; --ok-bg: #12301f; --todo: #9aa3b2; --todo-bg: #232836;
    --warn: #f3b44c; --warn-bg: #3a2a0c; --bad: #ff8a80; --bad-bg: #3b1513;
    --get: #6b9bff; --post: #5fd08a; --put: #fb923c; --patch: #b794f6; --delete: #f87171;
  }
}
:root[data-theme="dark"] {
  --bg: #0f1218; --surface: #171b23; --surface-2: #1f2430; --border: #2a303d;
  --text: #e6e9ef; --muted: #9aa3b2; --accent: #6b9bff;
  --ok: #5fd08a; --ok-bg: #12301f; --todo: #9aa3b2; --todo-bg: #232836;
  --warn: #f3b44c; --warn-bg: #3a2a0c; --bad: #ff8a80; --bad-bg: #3b1513;
  --get: #6b9bff; --post: #5fd08a; --put: #fb923c; --patch: #b794f6; --delete: #f87171;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 13px; }
.page { max-width: 1180px; margin: 0 auto; padding: 24px 16px 48px; }
.top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.sub { margin: 2px 0 0; color: var(--muted); }
.meta { margin: 0; color: var(--muted); font-size: 12px; text-align: right; }
.warn-text { color: var(--warn); }

.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.card-label { color: var(--muted); font-size: 12px; }
.card-value { font-size: 26px; font-weight: 650; line-height: 1.1; font-variant-numeric: tabular-nums; }
.card-value small { font-size: 15px; color: var(--muted); font-weight: 500; }
.card-detail { font-size: 12px; color: var(--muted); }
.card.warn .card-value { color: var(--warn); }
.card.bad .card-value, .card.bad .card-detail { color: var(--bad); }
.bar { display: block; height: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; }
.bar > span { display: block; height: 100%; background: var(--ok); border-radius: 3px; }

.toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; position: sticky; top: 0; z-index: 2; background: var(--bg); padding: 8px 0; }
#search { flex: 1 1 260px; min-width: 0; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font: inherit; }
#search:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface); }
.seg button, .ghost { font: inherit; color: var(--text); background: transparent; border: 0; padding: 8px 12px; cursor: pointer; }
.seg button + button { border-left: 1px solid var(--border); }
.seg button.active { background: var(--accent); color: #fff; }
.ghost { border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }

.module { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
.module > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 12px 16px; flex-wrap: wrap; }
.module > summary::-webkit-details-marker { display: none; }
.module > summary::before { content: "▸"; display: inline-block; color: var(--muted); transition: transform .15s; }
.module[open] > summary::before { transform: rotate(90deg); }
.mod-name { font-weight: 650; font-size: 15px; }
.state { font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
.state-nao-iniciado { background: var(--todo-bg); color: var(--todo); }
.state-em-andamento { background: var(--warn-bg); color: var(--warn); }
.state-completo { background: var(--ok-bg); color: var(--ok); }
.mod-progress { margin-left: auto; display: flex; align-items: center; gap: 10px; min-width: 160px; }
.mod-progress .bar { flex: 1; }
.count { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 13px; min-width: 44px; text-align: right; }

.ops { border-top: 1px solid var(--border); }
.op { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto auto; gap: 6px 14px; align-items: center; padding: 9px 16px; border-bottom: 1px solid var(--border); }
.op:last-child { border-bottom: 0; }
.op:not(.covered) .route code { color: var(--muted); }
.method { display: inline-block; font: 600 11px/1 ui-monospace, Consolas, monospace; padding: 4px 0; width: 56px; text-align: center; border-radius: 5px; color: #fff; }
.m-get { background: var(--get); } .m-post { background: var(--post); } .m-put { background: var(--put); }
.m-patch { background: var(--patch); } .m-delete { background: var(--delete); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .method { color: #0f1218; } }
:root[data-theme="dark"] .method { color: #0f1218; }
.route { display: flex; flex-direction: column; min-width: 0; }
.route code { overflow-wrap: anywhere; }
.param { color: var(--accent); }
.summary { color: var(--muted); font-size: 12px; }
.chips { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.chip { font: 600 11px/1 ui-monospace, Consolas, monospace; padding: 4px 6px; border-radius: 5px; white-space: nowrap; }
.chip.ok { background: var(--ok-bg); color: var(--ok); }
.chip.todo { background: var(--todo-bg); color: var(--todo); }
.chip.undoc { background: var(--warn-bg); color: var(--warn); }
.test-list { min-width: 90px; text-align: right; font-size: 12px; }
.tests summary { cursor: pointer; color: var(--accent); }
.tests ul { text-align: left; margin: 6px 0 0; padding-left: 18px; color: var(--muted); }
.tests li.failing { color: var(--bad); }
.no-tests { color: var(--muted); font-size: 12px; }

.notes { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; padding: 12px 16px 16px; border-top: 1px solid var(--border); background: var(--surface-2); }
.note h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.note ul { margin: 0; padding-left: 18px; }
.note li { margin-bottom: 4px; }
.note.bugs h3 { color: var(--warn); } .note.failing h3 { color: var(--bad); }
.from { display: block; color: var(--muted); font-size: 12px; }

.unknown { margin-top: 24px; background: var(--warn-bg); border-radius: 10px; padding: 14px 16px; }
.unknown h2 { margin: 0 0 4px; font-size: 15px; color: var(--warn); }
.unknown p { margin: 0 0 8px; color: var(--muted); }
.unknown ul { margin: 0; padding-left: 0; list-style: none; }
.unknown li { margin-bottom: 6px; }

.legend { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 20px; color: var(--muted); font-size: 12px; }
.legend > span { display: inline-flex; align-items: center; gap: 6px; }
.empty { text-align: center; color: var(--muted); padding: 32px 0; }

@media (max-width: 720px) {
  .op { grid-template-columns: 64px minmax(0, 1fr); }
  .chips, .test-list { grid-column: 2; justify-content: flex-start; text-align: left; }
  .mod-progress { margin-left: 0; width: 100%; }
  .meta { text-align: left; }
}
`;

const SCRIPT = `
const search = document.getElementById('search');
const modules = [...document.querySelectorAll('.module')];
const toggle = document.getElementById('toggle-all');
let filter = 'all';

function apply() {
  const term = search.value.trim().toLowerCase();
  let anyVisible = false;
  for (const module of modules) {
    let visibleOps = 0;
    for (const op of module.querySelectorAll('.op')) {
      const matchesFilter = filter === 'all' || (filter === 'covered') === (op.dataset.covered === '1');
      const matchesTerm = !term || op.dataset.search.includes(term);
      op.hidden = !(matchesFilter && matchesTerm);
      if (!op.hidden) visibleOps++;
    }
    module.hidden = visibleOps === 0;
    if (term && visibleOps) module.open = true;
    anyVisible ||= visibleOps > 0;
  }
  document.getElementById('empty').hidden = anyVisible;
}

search.addEventListener('input', apply);
for (const button of document.querySelectorAll('[data-filter]')) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('active', b === button));
    apply();
  });
}
toggle.addEventListener('click', () => {
  const open = toggle.textContent === 'Expandir tudo';
  modules.forEach((module) => (module.open = open));
  toggle.textContent = open ? 'Recolher tudo' : 'Expandir tudo';
});
`;
