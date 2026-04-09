const STORAGE_KEY = "organizador-financeiro-mensal";

function escaparHtml(texto) {
    return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function formatarMoeda(valor) {
    return valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function normalizarValorMonetario(valor) {
    const numero = Number(valor);

    if (!Number.isFinite(numero) || numero <= 0) {
        return 0;
    }

    return Math.round(numero * 100) / 100;
}

function converterParaCentavos(valor) {
    return Math.round(Number(valor || 0) * 100);
}

function somarValores(valores) {
    const totalCentavos = valores.reduce(
        (soma, valor) => soma + converterParaCentavos(valor),
        0
    );

    return totalCentavos / 100;
}

function gerarMesAtual() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    return `${ano}-${mes}`;
}

function formatarMes(valor) {
    const [ano, mes] = valor.split("-");
    const data = new Date(Number(ano), Number(mes) - 1, 1);

    return data.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric"
    });
}

function escaparCsv(texto) {
    return `"${String(texto).replaceAll('"', '""')}"`;
}

function normalizarLancamento(item) {
    const valor = normalizarValorMonetario(item.valor);
    const tipo = item.tipo === "economia" || item.tipo === "guardado" ? "guardado" : "gasto";

    return {
        id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        descricao: typeof item.descricao === "string" ? item.descricao : "Sem descricao",
        categoria: typeof item.categoria === "string" ? item.categoria : "",
        tipo,
        valor,
        criadoEm: Number(item.criadoEm) || Date.now()
    };
}

function normalizarMes(valor) {
    if (Array.isArray(valor)) {
        return {
            renda: 0,
            meta: 0,
            lancamentos: valor.map(normalizarLancamento).filter((item) => item.valor > 0)
        };
    }

    if (valor && typeof valor === "object") {
        const meta = normalizarValorMonetario(valor.meta);
        const renda = normalizarValorMonetario(valor.renda);
        const lancamentosOriginais = Array.isArray(valor.lancamentos) ? valor.lancamentos : [];

        return {
            renda,
            meta,
            lancamentos: lancamentosOriginais.map(normalizarLancamento).filter((item) => item.valor > 0)
        };
    }

    return {
        renda: 0,
        meta: 0,
        lancamentos: []
    };
}

function carregarDados() {
    const salvo = localStorage.getItem(STORAGE_KEY);

    if (!salvo) {
        return {};
    }

    try {
        const dados = JSON.parse(salvo);

        if (!dados || typeof dados !== "object") {
            return {};
        }

        return Object.fromEntries(
            Object.entries(dados).map(([mes, valor]) => [mes, normalizarMes(valor)])
        );
    } catch (erro) {
        return {};
    }
}

function salvarDados() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado.dados));
}

function criarId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function garantirMes(mes) {
    if (!estado.dados[mes]) {
        estado.dados[mes] = {
            renda: 0,
            meta: 0,
            lancamentos: []
        };
    }

    return estado.dados[mes];
}

function temConteudoNoMes(mes) {
    return mes.lancamentos.length > 0 || mes.meta > 0 || mes.renda > 0;
}

function removerMesSeVazio() {
    const mes = obterMesAtual();

    if (!temConteudoNoMes(mes)) {
        delete estado.dados[estado.mesSelecionado];
    }
}

function obterMesAtual() {
    return garantirMes(estado.mesSelecionado);
}

function obterLancamentosDoMes() {
    return obterMesAtual().lancamentos;
}

function obterLancamentosFiltrados(lancamentos) {
    if (estado.filtroCategoria === "todas") {
        return lancamentos;
    }

    return lancamentos.filter((item) => {
        const categoria = item.categoria.trim() || "Sem categoria";
        return categoria === estado.filtroCategoria;
    });
}

function preencherFiltroCategorias(lancamentos) {
    const select = document.getElementById("filtroCategoria");
    const categorias = [...new Set(
        lancamentos.map((item) => item.categoria.trim() || "Sem categoria")
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));

    const opcoes = ['<option value="todas">Todas as categorias</option>']
        .concat(
            categorias.map((categoria) => {
                const segura = escaparHtml(categoria);
                return `<option value="${segura}">${segura}</option>`;
            })
        )
        .join("");

    select.innerHTML = opcoes;

    const filtroExiste = categorias.includes(estado.filtroCategoria);
    select.value = filtroExiste ? estado.filtroCategoria : "todas";
    estado.filtroCategoria = select.value;
}

function atualizarResumo(lancamentos) {
    const renda = obterMesAtual().renda;
    const totalGuardado = somarValores(lancamentos
        .filter((item) => item.tipo === "guardado")
        .map((item) => item.valor));

    const totalGastos = somarValores(lancamentos
        .filter((item) => item.tipo === "gasto")
        .map((item) => item.valor));

    const saldo = somarValores([renda, -totalGuardado, -totalGastos]);
    const saldoElement = document.getElementById("saldoMensal");
    const statusSaldo = document.getElementById("statusSaldo");

    document.getElementById("totalRenda").textContent = formatarMoeda(renda);
    document.getElementById("totalGuardado").textContent = formatarMoeda(totalGuardado);
    document.getElementById("totalGastos").textContent = formatarMoeda(totalGastos);
    saldoElement.textContent = formatarMoeda(saldo);
    saldoElement.classList.toggle("saldo-positivo", saldo >= 0);
    saldoElement.classList.toggle("saldo-negativo", saldo < 0);

    if (lancamentos.length === 0) {
        statusSaldo.textContent = renda > 0 ? "Seu saldo disponivel ja considera a renda mensal informada" : "Adicione movimentacoes para comecar";
    } else if (saldo > 0) {
        statusSaldo.textContent = "Voce ainda tem saldo disponivel no mes";
    } else if (saldo < 0) {
        statusSaldo.textContent = "Seus gastos e economias passaram da renda";
    } else {
        statusSaldo.textContent = "Sua renda foi totalmente distribuida no mes";
    }

    atualizarMeta(totalGuardado);
}

function atualizarMeta(totalGuardado) {
    const meta = obterMesAtual().meta;
    const texto = document.getElementById("metaProgressoTexto");
    const barra = document.getElementById("metaProgressoBarra");
    const mensagem = document.getElementById("metaMensagem");
    const inputMeta = document.getElementById("metaValor");

    inputMeta.value = meta > 0 ? meta.toFixed(2) : "";

    if (meta <= 0) {
        texto.textContent = "Nenhuma meta definida";
        barra.style.width = "0%";
        mensagem.textContent = "Defina uma meta para acompanhar quanto voce ja separou como economia neste mes.";
        return;
    }

    const percentual = Math.min((totalGuardado / meta) * 100, 100);
    texto.textContent = `${formatarMoeda(totalGuardado)} de ${formatarMoeda(meta)}`;
    barra.style.width = `${percentual}%`;

    if (totalGuardado >= meta) {
        mensagem.textContent = "Parabens, voce atingiu sua meta de economia deste mes.";
    } else {
        mensagem.textContent = `Faltam ${formatarMoeda(meta - totalGuardado)} para chegar na meta.`;
    }
}

function atualizarRenda() {
    const renda = obterMesAtual().renda;
    const inputRenda = document.getElementById("rendaValor");
    inputRenda.value = renda > 0 ? renda.toFixed(2) : "";
}

function atualizarCabecalhoLista(lancamentosFiltrados, totalLancamentos) {
    const resumo = document.getElementById("listaResumo");
    const nomeMes = formatarMes(estado.mesSelecionado);

    if (totalLancamentos === 0) {
        resumo.textContent = `Nenhum lancamento registrado em ${nomeMes}.`;
        return;
    }

    if (estado.filtroCategoria !== "todas") {
        resumo.textContent = `${lancamentosFiltrados.length} lancamento(s) encontrados na categoria ${estado.filtroCategoria} em ${nomeMes}.`;
        return;
    }

    resumo.textContent = `${totalLancamentos} lancamento(s) registrado(s) em ${nomeMes}.`;
}

function renderizarGrafico(lancamentos) {
    const grafico = document.getElementById("graficoCategorias");

    if (lancamentos.length === 0) {
        grafico.innerHTML = '<div class="empty-state">Adicione movimentacoes para visualizar o grafico por categoria.</div>';
        return;
    }

    const grupos = {};

    lancamentos.forEach((item) => {
        const categoria = item.categoria.trim() || "Sem categoria";

        if (!grupos[categoria]) {
            grupos[categoria] = {
                gasto: 0,
                guardado: 0
            };
        }

        grupos[categoria][item.tipo] += item.valor;
    });

    const totais = Object.entries(grupos)
        .map(([categoria, valores]) => ({
            categoria,
            total: valores.gasto + valores.guardado,
            gasto: valores.gasto,
            guardado: valores.guardado
        }))
        .sort((a, b) => b.total - a.total);

    const maiorTotal = totais[0]?.total || 1;

    grafico.innerHTML = totais.map((item) => {
        const larguraGasto = (item.gasto / maiorTotal) * 100;
        const larguraGuardado = (item.guardado / maiorTotal) * 100;
        const categoria = escaparHtml(item.categoria);

        return `
            <div class="chart-item">
                <div class="chart-line">
                    <strong>${categoria}</strong>
                    <span>${formatarMoeda(item.total)}</span>
                </div>
                <div class="chart-bar">
                    <div class="chart-fill" style="width: ${larguraGasto}%"></div>
                </div>
                <p class="chart-note">Gastos: ${formatarMoeda(item.gasto)}</p>
                <div class="chart-bar">
                    <div class="chart-fill guardado" style="width: ${larguraGuardado}%"></div>
                </div>
                <p class="chart-note">Guardado: ${formatarMoeda(item.guardado)}</p>
            </div>
        `;
    }).join("");
}

function renderizarLancamentos() {
    const lista = document.getElementById("listaLancamentos");
    const lancamentos = obterLancamentosDoMes();
    const lancamentosFiltrados = obterLancamentosFiltrados(lancamentos);

    preencherFiltroCategorias(lancamentos);
    atualizarRenda();
    atualizarResumo(lancamentos);
    atualizarCabecalhoLista(lancamentosFiltrados, lancamentos.length);
    renderizarGrafico(lancamentos);

    if (lancamentosFiltrados.length === 0) {
        lista.innerHTML = estado.filtroCategoria === "todas"
            ? '<div class="empty-state">Ainda nao ha lancamentos neste mes. Use o formulario ao lado para comecar.</div>'
            : '<div class="empty-state">Nenhum lancamento encontrado para o filtro selecionado.</div>';
        return;
    }

    const itens = [...lancamentosFiltrados]
        .sort((a, b) => b.criadoEm - a.criadoEm)
        .map((item) => {
            const estaEditando = estado.editandoId === item.id;
            const descricao = escaparHtml(item.descricao);
            const categoriaTexto = item.categoria ? escaparHtml(item.categoria) : "Sem categoria";
            const categoria = item.categoria ? `Categoria: ${categoriaTexto}` : categoriaTexto;
            const valorClass = item.tipo === "guardado" ? "guardado" : "gasto";
            const tipoRotulo = item.tipo === "guardado" ? "Guardado" : "Gasto";

            if (estaEditando) {
                const categoriaValor = escaparHtml(item.categoria);

                return `
                    <article class="transaction-item is-editing">
                        <div class="transaction-main">
                            <div class="edit-grid">
                                <div class="field">
                                    <label for="editDescricao-${item.id}">Descricao</label>
                                    <input id="editDescricao-${item.id}" data-edit-field="descricao" data-id="${item.id}" type="text" maxlength="60" value="${descricao}">
                                </div>
                                <div class="field">
                                    <label for="editValor-${item.id}">Valor</label>
                                    <input id="editValor-${item.id}" data-edit-field="valor" data-id="${item.id}" type="number" min="0" step="0.01" inputmode="decimal" value="${item.valor}">
                                </div>
                                <div class="field">
                                    <label for="editTipo-${item.id}">Tipo</label>
                                    <select id="editTipo-${item.id}" data-edit-field="tipo" data-id="${item.id}">
                                        <option value="gasto" ${item.tipo === "gasto" ? "selected" : ""}>Gasto</option>
                                        <option value="guardado" ${item.tipo === "guardado" ? "selected" : ""}>Guardar como economia</option>
                                    </select>
                                </div>
                                <div class="field">
                                    <label for="editCategoria-${item.id}">Categoria</label>
                                    <input id="editCategoria-${item.id}" data-edit-field="categoria" data-id="${item.id}" type="text" maxlength="30" value="${categoriaValor}">
                                </div>
                            </div>
                        </div>
                        <div class="transaction-actions">
                            <div class="transaction-buttons">
                                <button class="save-button" type="button" data-action="salvar-edicao" data-id="${item.id}">Salvar</button>
                                <button class="cancel-button" type="button" data-action="cancelar-edicao" data-id="${item.id}">Cancelar</button>
                            </div>
                        </div>
                    </article>
                `;
            }

            return `
                <article class="transaction-item">
                    <div class="transaction-main">
                        <div class="transaction-top">
                            <h3 class="transaction-title">${descricao}</h3>
                            <span class="tag ${item.tipo}">${tipoRotulo}</span>
                        </div>
                        <div class="transaction-meta">${categoria}</div>
                    </div>
                    <div class="transaction-actions">
                        <div class="transaction-value ${valorClass}">${formatarMoeda(item.valor)}</div>
                        <div class="transaction-buttons">
                            <button class="edit-button" type="button" data-action="editar" data-id="${item.id}">Editar</button>
                            <button class="remove-button" type="button" data-action="excluir" data-id="${item.id}">Excluir</button>
                        </div>
                    </div>
                </article>
            `;
        })
        .join("");

    lista.innerHTML = itens;
}

function adicionarLancamento(evento) {
    evento.preventDefault();

    const form = evento.currentTarget;
    const descricao = form.descricao.value.trim();
    const categoria = form.categoria.value.trim();
    const tipo = form.tipo.value;
    const valor = normalizarValorMonetario(form.valor.value);

    if (!descricao || Number.isNaN(valor) || valor <= 0) {
        return;
    }

    obterLancamentosDoMes().push({
        id: criarId(),
        descricao,
        categoria,
        tipo,
        valor,
        criadoEm: Date.now()
    });

    salvarDados();
    renderizarLancamentos();
    form.reset();
    form.tipo.value = "gasto";
    document.getElementById("descricao").focus();
}

function salvarMeta(evento) {
    evento.preventDefault();

    const meta = normalizarValorMonetario(evento.currentTarget.metaValor.value);

    obterMesAtual().meta = meta;
    removerMesSeVazio();
    salvarDados();
    renderizarLancamentos();
}

function salvarRenda(evento) {
    evento.preventDefault();

    const renda = normalizarValorMonetario(evento.currentTarget.rendaValor.value);

    obterMesAtual().renda = renda;
    removerMesSeVazio();
    salvarDados();
    renderizarLancamentos();
}

function removerMeta() {
    obterMesAtual().meta = 0;
    removerMesSeVazio();
    salvarDados();
    renderizarLancamentos();
}

function removerRenda() {
    obterMesAtual().renda = 0;
    removerMesSeVazio();
    salvarDados();
    renderizarLancamentos();
}

function iniciarEdicao(id) {
    estado.editandoId = id;
    renderizarLancamentos();
}

function cancelarEdicao() {
    estado.editandoId = null;
    renderizarLancamentos();
}

function salvarEdicao(id) {
    const mes = obterMesAtual();
    const item = mes.lancamentos.find((lancamento) => lancamento.id === id);

    if (!item) {
        return;
    }

    const descricao = document.getElementById(`editDescricao-${id}`)?.value.trim() || "";
    const valor = normalizarValorMonetario(document.getElementById(`editValor-${id}`)?.value);
    const tipo = document.getElementById(`editTipo-${id}`)?.value || "gasto";
    const categoria = document.getElementById(`editCategoria-${id}`)?.value.trim() || "";

    if (!descricao || Number.isNaN(valor) || valor <= 0) {
        return;
    }

    item.descricao = descricao;
    item.valor = valor;
    item.tipo = tipo === "guardado" ? "guardado" : "gasto";
    item.categoria = categoria;
    estado.editandoId = null;
    salvarDados();
    renderizarLancamentos();
}

function excluirLancamento(id) {
    const mes = obterMesAtual();
    mes.lancamentos = mes.lancamentos.filter((item) => item.id !== id);
    removerMesSeVazio();

    salvarDados();
    renderizarLancamentos();
}

function exportarCsv() {
    const mes = obterMesAtual();
    const lancamentos = mes.lancamentos;

    if (lancamentos.length === 0 && mes.meta <= 0 && mes.renda <= 0) {
        return;
    }

    const linhas = [
        ["Mes", "Renda mensal", "Meta", "Descricao", "Categoria", "Tipo", "Valor", "Criado em"].map(escaparCsv).join(",")
    ];

    lancamentos
        .slice()
        .sort((a, b) => a.criadoEm - b.criadoEm)
        .forEach((item) => {
            const data = new Date(item.criadoEm).toLocaleDateString("pt-BR");
            linhas.push([
                formatarMes(estado.mesSelecionado),
                mes.renda > 0 ? mes.renda.toFixed(2) : "",
                mes.meta > 0 ? mes.meta.toFixed(2) : "",
                item.descricao,
                item.categoria || "Sem categoria",
                item.tipo,
                item.valor.toFixed(2),
                data
            ].map(escaparCsv).join(","));
        });

    if (lancamentos.length === 0) {
        linhas.push([
            formatarMes(estado.mesSelecionado),
            mes.renda > 0 ? mes.renda.toFixed(2) : "",
            mes.meta > 0 ? mes.meta.toFixed(2) : "",
            "",
            "",
            "",
            "",
            ""
        ].map(escaparCsv).join(","));
    }

    const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `organizador-financeiro-${estado.mesSelecionado}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function trocarMes(evento) {
    estado.mesSelecionado = evento.target.value || gerarMesAtual();
    estado.filtroCategoria = "todas";
    estado.editandoId = null;
    renderizarLancamentos();
}

function filtrarCategoria(evento) {
    estado.filtroCategoria = evento.target.value;
    estado.editandoId = null;
    renderizarLancamentos();
}

function limparMesAtual() {
    const mes = obterMesAtual();
    const temConteudo = temConteudoNoMes(mes);

    if (!temConteudo) {
        return;
    }

    const confirmar = window.confirm("Deseja apagar todos os lancamentos, a renda e a meta deste mes?");

    if (!confirmar) {
        return;
    }

    delete estado.dados[estado.mesSelecionado];
    estado.filtroCategoria = "todas";
    estado.editandoId = null;
    salvarDados();
    renderizarLancamentos();
}

function configurarEventos() {
    document.getElementById("financeForm").addEventListener("submit", adicionarLancamento);
    document.getElementById("metaForm").addEventListener("submit", salvarMeta);
    document.getElementById("rendaForm").addEventListener("submit", salvarRenda);
    document.getElementById("mesSelecionado").addEventListener("input", trocarMes);
    document.getElementById("atualizarTudo").addEventListener("click", atualizarTudo);
    document.getElementById("filtroCategoria").addEventListener("change", filtrarCategoria);
    document.getElementById("limparMes").addEventListener("click", limparMesAtual);
    document.getElementById("removerMeta").addEventListener("click", removerMeta);
    document.getElementById("removerRenda").addEventListener("click", removerRenda);
    document.getElementById("exportarCsv").addEventListener("click", exportarCsv);
    document.getElementById("listaLancamentos").addEventListener("click", (evento) => {
        const botao = evento.target.closest("[data-action]");

        if (botao) {
            const { action, id } = botao.dataset;

            if (action === "editar") {
                iniciarEdicao(id);
            } else if (action === "cancelar-edicao") {
                cancelarEdicao();
            } else if (action === "salvar-edicao") {
                salvarEdicao(id);
            } else if (action === "excluir") {
                excluirLancamento(id);
            }
        }
    });
}

function atualizarTudo() {
    estado.dados = carregarDados();
    estado.editandoId = null;
    renderizarLancamentos();
}

function iniciar() {
    estado.mesSelecionado = gerarMesAtual();
    document.getElementById("mesSelecionado").value = estado.mesSelecionado;
    configurarEventos();
    renderizarLancamentos();
}

const estado = {
    dados: carregarDados(),
    mesSelecionado: gerarMesAtual(),
    filtroCategoria: "todas",
    editandoId: null
};

document.addEventListener("DOMContentLoaded", iniciar);
