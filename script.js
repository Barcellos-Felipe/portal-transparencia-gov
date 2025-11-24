// Variáveis globais
let dadosEmendas = [];
let dadosConvenios = [];
let dadosFavorecidos = [];

// Configuração centralizada de tabelas
const tabelasConfig = {
    emendas: {
        dados: () => dadosEmendas,
        dadosFiltrados: [],
        paginacao: { paginaAtual: 1, itensPorPagina: 10 },
        ordenacao: { coluna: null, direcao: 'asc' },
        colunas: ['Ano da Emenda', 'Nome do Autor da Emenda', 'Tipo de Emenda', 'Nome Função', 'Nome Subfunção', 'Valor Empenhado', 'Valor Pago'],
        renderLinha: (item) => [
            item['Ano da Emenda'] || '-',
            item['Nome do Autor da Emenda'] || '-',
            item['Tipo de Emenda'] || '-',
            item['Nome Função'] || '-',
            item['Nome Subfunção'] || '-',
            `<span class="valor-monetario">${formatarMoeda(item['Valor Empenhado'])}</span>`,
            `<span class="valor-monetario">${formatarMoeda(item['Valor Pago'])}</span>`
        ]
    },
    convenios: {
        dados: () => dadosConvenios,
        dadosFiltrados: [],
        paginacao: { paginaAtual: 1, itensPorPagina: 10 },
        ordenacao: { coluna: null, direcao: 'asc' },
        colunas: ['Data Publicação Convênio', 'Número Convênio', 'Convenente', 'Nome Função', 'Valor Convênio', 'Objeto Convênio'],
        renderLinha: (item) => [
            item['Data Publicação Convênio'] || '-',
            item['Número Convênio'] || '-',
            item['Convenente'] || '-',
            item['Nome Função'] || '-',
            `<span class="valor-monetario">${formatarMoeda(item['Valor Convênio'])}</span>`,
            (item['Objeto Convênio'] || '-').substring(0, 100) + '...'
        ]
    },
    favorecidos: {
        dados: () => dadosFavorecidos,
        dadosFiltrados: [],
        paginacao: { paginaAtual: 1, itensPorPagina: 10 },
        ordenacao: { coluna: null, direcao: 'asc' },
        colunas: ['Ano/Mês', 'Favorecido', 'Tipo Favorecido', 'Nome do Autor da Emenda', 'Valor Recebido'],
        renderLinha: (item) => [
            item['Ano/Mês'] || '-',
            item['Favorecido'] || '-',
            item['Tipo Favorecido'] || '-',
            item['Nome do Autor da Emenda'] || '-',
            `<span class="valor-monetario">${formatarMoeda(item['Valor Recebido'])}</span>`
        ]
    }
};

// Gráficos
let funcaoChart, anoChart, parlamentaresChart, tipoEmendaChart, favorecidosChart;

// Utilitários
const formatarMoeda = (valor) => {
    const num = parseFloat(valor) || 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
};

const formatarNumero = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor);
};

// Utilitários compartilhados para gráficos
const isMobile = () => window.innerWidth < 768;
const obterFontSize = (mobileSize, desktopSize) => isMobile() ? mobileSize : desktopSize;
const formatarValorEixo = (value) => 'R$ ' + (value / 1000000).toFixed(1) + 'M';

const opcoesComuns = {
    responsive: true,
    maintainAspectRatio: false
};

const obterOpcoesEixoY = () => ({
    beginAtZero: true,
    ticks: {
        callback: formatarValorEixo,
        font: { size: obterFontSize(10, 12) }
    }
});

const obterOpcoesEixoX = (rotacao = false) => ({
    ticks: {
        font: { size: obterFontSize(9, 11) },
        ...(rotacao && {
            maxRotation: isMobile() ? 45 : 0,
            minRotation: isMobile() ? 45 : 0
        })
    }
});

// Carregar dados
async function carregarDados() {
    try {
        const [resEmendas, resConvenios, resFavorecidos] = await Promise.all([
            // fetch('https://portal-transparencia-gov.onrender.com/api/data/emendas'),
            // fetch('https://portal-transparencia-gov.onrender.com/api/data/convenios'),
            // fetch('https://portal-transparencia-gov.onrender.com/api/data/por_favorecido')
            fetch('../data/emendas_web.json'),
            fetch('../data/emendas_convenios_web.json'),
            fetch('../data/emendas_por_favorecido_web.json')
        ]);

        dadosEmendas = await resEmendas.json();
        dadosConvenios = await resConvenios.json();
        dadosFavorecidos = await resFavorecidos.json();

        inicializarDashboard();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro ao carregar dados. Verifique se os arquivos JSON estão disponíveis.');
    }
}

// Inicializar Dashboard
function inicializarDashboard() {
    atualizarIndicadores();
    criarGraficos();
    
    // Inicializar dados filtrados
    Object.keys(tabelasConfig).forEach(tipo => {
        tabelasConfig[tipo].dadosFiltrados = [...tabelasConfig[tipo].dados()];
    });
    
    popularTabelas();
    popularFiltros();
    configurarFiltros();
    configurarPaginacao();
    configurarOrdenacao();
    atualizarDataAtualizacao();
    inicializarInteracoesExtras();
}

// Atualizar Indicadores
function atualizarIndicadores() {
    const totalEmpenhado = dadosEmendas.reduce((acc, curr) => 
        acc + (parseFloat(curr['Valor Empenhado']) || 0), 0);
    
    const totalLiquidado = dadosEmendas.reduce((acc, curr) => 
        acc + (parseFloat(curr['Valor Liquidado']) || 0), 0);
    
    const totalPago = dadosEmendas.reduce((acc, curr) => 
        acc + (parseFloat(curr['Valor Pago']) || 0), 0);
    
    const totalEmendas = dadosEmendas.length;
    const totalConvenios = dadosConvenios.length;
    
    const favoreicosUnicos = new Set(
        dadosFavorecidos.map(d => d['Favorecido'])
    ).size;

    document.getElementById('total-empenhado').textContent = formatarMoeda(totalEmpenhado);
    document.getElementById('total-liquidado').textContent = formatarMoeda(totalLiquidado);
    document.getElementById('total-pago').textContent = formatarMoeda(totalPago);
    document.getElementById('total-emendas').textContent = formatarNumero(totalEmendas);
    document.getElementById('total-convenios').textContent = formatarNumero(totalConvenios);
    document.getElementById('total-favorecidos').textContent = formatarNumero(favoreicosUnicos);
}

// Criar Gráficos
function criarGraficos() {
    criarGraficoFuncao();
    criarGraficoAno();
    criarGraficoParlamentares();
    criarGraficoTipoEmenda();
    criarGraficoFavorecidos();
}

function criarGraficoFuncao() {
    const funcoes = {};
    
    dadosEmendas.forEach(emenda => {
        const funcao = emenda['Nome Função'] || 'Não especificado';
        const valor = parseFloat(emenda['Valor Empenhado']) || 0;
        funcoes[funcao] = (funcoes[funcao] || 0) + valor;
    });

    const dados = Object.entries(funcoes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const ctx = document.getElementById('funcaoChart').getContext('2d');
    funcaoChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.map(d => d[0]),
            datasets: [{
                label: 'Valor Empenhado',
                data: dados.map(d => d[1]),
                backgroundColor: 'rgba(52, 152, 219, 0.6)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => formatarMoeda(context.parsed.y)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => {
                            return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
                        },
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        },
                        maxRotation: window.innerWidth < 768 ? 45 : 0,
                        minRotation: window.innerWidth < 768 ? 45 : 0
                    }
                }
            }
        }
    });
}

function criarGraficoAno() {
    const anos = {};
    
    dadosEmendas.forEach(emenda => {
        const ano = emenda['Ano da Emenda'];
        const valorEmpenhado = parseFloat(emenda['Valor Empenhado']) || 0;
        const valorPago = parseFloat(emenda['Valor Pago']) || 0;
        
        if (!anos[ano]) {
            anos[ano] = { empenhado: 0, pago: 0 };
        }
        anos[ano].empenhado += valorEmpenhado;
        anos[ano].pago += valorPago;
    });

    const anosOrdenados = Object.keys(anos).sort();

    const ctx = document.getElementById('anoChart').getContext('2d');
    anoChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: anosOrdenados,
            datasets: [
                {
                    label: 'Valor Empenhado',
                    data: anosOrdenados.map(ano => anos[ano].empenhado),
                    borderColor: 'rgba(52, 152, 219, 1)',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Valor Pago',
                    data: anosOrdenados.map(ano => anos[ano].pago),
                    borderColor: 'rgba(39, 174, 96, 1)',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return context.dataset.label + ': ' + formatarMoeda(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => {
                            return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
                        },
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: window.innerWidth < 768 ? 10 : 11
                        }
                    }
                }
            }
        }
    });
}

function criarGraficoParlamentares() {
    const parlamentares = {};
    
    dadosEmendas.forEach(emenda => {
        const nome = emenda['Nome do Autor da Emenda'] || 'Não especificado';
        const valor = parseFloat(emenda['Valor Empenhado']) || 0;
        parlamentares[nome] = (parlamentares[nome] || 0) + valor;
    });

    const dados = Object.entries(parlamentares)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const ctx = document.getElementById('parlamentaresChart').getContext('2d');
    parlamentaresChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.map(d => d[0]),
            datasets: [{
                label: 'Valor Empenhado',
                data: dados.map(d => d[1]),
                backgroundColor: 'rgba(52, 152, 219, 0.6)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => formatarMoeda(context.parsed.x)
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => {
                            return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
                        },
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        }
                    }
                }
            }
        }
    });
}

function criarGraficoTipoEmenda() {
    const tipos = {};
    
    dadosEmendas.forEach(emenda => {
        const tipo = emenda['Tipo de Emenda'] || 'Não especificado';
        const valor = parseFloat(emenda['Valor Empenhado']) || 0;
        tipos[tipo] = (tipos[tipo] || 0) + valor;
    });

    const dados = Object.entries(tipos).sort((a, b) => b[1] - a[1]);

    const ctx = document.getElementById('tipoEmendaChart').getContext('2d');
    tipoEmendaChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: dados.map(d => d[0]),
            datasets: [{
                data: dados.map(d => d[1]),
                backgroundColor: [
                    'rgba(52, 152, 219, 0.7)',
                    'rgba(46, 204, 113, 0.7)',
                    'rgba(155, 89, 182, 0.7)',
                    'rgba(241, 196, 15, 0.7)',
                    'rgba(231, 76, 60, 0.7)',
                    'rgba(52, 73, 94, 0.7)'
                ],
                borderColor: 'rgba(255, 255, 255, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: window.innerWidth < 768 ? 'bottom' : 'right',
                    labels: {
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        },
                        padding: window.innerWidth < 768 ? 8 : 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = formatarMoeda(context.parsed);
                            return label + ': ' + value;
                        }
                    }
                }
            }
        }
    });
}

function criarGraficoFavorecidos() {
    const favorecidos = {};
    
    dadosFavorecidos.forEach(item => {
        const nome = item['Favorecido'] || 'Não especificado';
        const valor = parseFloat(item['Valor Recebido']) || 0;
        favorecidos[nome] = (favorecidos[nome] || 0) + valor;
    });

    const dados = Object.entries(favorecidos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const ctx = document.getElementById('favorecidosChart').getContext('2d');
    const isMobile = window.innerWidth < 768;
    const maxLength = isMobile ? 25 : 40;
    
    favorecidosChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dados.map(d => d[0].length > maxLength ? d[0].substring(0, maxLength) + '...' : d[0]),
            datasets: [{
                label: 'Valor Recebido',
                data: dados.map(d => d[1]),
                backgroundColor: 'rgba(39, 174, 96, 0.6)',
                borderColor: 'rgba(39, 174, 96, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: (context) => {
                            const index = context[0].dataIndex;
                            return dados[index][0];
                        },
                        label: (context) => formatarMoeda(context.parsed.x)
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => {
                            return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
                        },
                        font: {
                            size: isMobile ? 9 : 11
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            size: isMobile ? 8 : 10
                        }
                    }
                }
            }
        }
    });
}

// Popular Tabelas
function popularTabelas() {
    popularTabela('emendas');
    popularTabela('convenios');
    popularTabela('favorecidos');
}

function popularTabela(tipo) {
    const config = tabelasConfig[tipo];
    const { paginaAtual, itensPorPagina } = config.paginacao;
    
    let dadosOrdenados = config.dadosFiltrados;
    if (config.ordenacao.coluna) {
        const th = document.querySelector(`#table-${tipo} th[data-column="${config.ordenacao.coluna}"]`);
        const tipoDado = th.getAttribute('data-type');
        dadosOrdenados = ordenarDados(config.dadosFiltrados, config.ordenacao.coluna, config.ordenacao.direcao, tipoDado);
    }
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const dadosPagina = dadosOrdenados.slice(inicio, fim);
    
    const tbody = document.querySelector(`#table-${tipo} tbody`);
    tbody.innerHTML = '';
    
    dadosPagina.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = config.renderLinha(item).map(html => `<td>${html}</td>`).join('');
        tbody.appendChild(tr);
    });
    
    atualizarInfoPaginacao(tipo, config.dadosFiltrados.length, paginaAtual, itensPorPagina);
}

function ordenarDados(dados, coluna, direcao, tipo) {
    return [...dados].sort((a, b) => {
        let valorA = a[coluna];
        let valorB = b[coluna];
        
        if (tipo === 'number') {
            valorA = parseFloat(valorA) || 0;
            valorB = parseFloat(valorB) || 0;
        } else if (tipo === 'date') {
            // Converter datas no formato DD/MM/YYYY para objeto Date
            const parseData = (str) => {
                if (!str) return new Date(0);
                const partes = str.split('/');
                if (partes.length === 3) {
                    return new Date(partes[2], partes[1] - 1, partes[0]);
                }
                return new Date(str);
            };
            valorA = parseData(valorA);
            valorB = parseData(valorB);
        } else {
            valorA = (valorA || '').toString().toLowerCase();
            valorB = (valorB || '').toString().toLowerCase();
        }
        
        if (valorA < valorB) return direcao === 'asc' ? -1 : 1;
        if (valorA > valorB) return direcao === 'asc' ? 1 : -1;
        return 0;
    });
}



// Atualizar informações de paginação
function atualizarInfoPaginacao(tipo, totalRegistros, paginaAtual, itensPorPagina) {
    const totalPaginas = Math.ceil(totalRegistros / itensPorPagina) || 1;
    const inicio = totalRegistros > 0 ? (paginaAtual - 1) * itensPorPagina + 1 : 0;
    const fim = Math.min(paginaAtual * itensPorPagina, totalRegistros);
    
    document.getElementById(`${tipo}-range`).textContent = totalRegistros > 0 ? `${inicio}-${fim}` : '0';
    document.getElementById(`${tipo}-total`).textContent = totalRegistros;
    document.getElementById(`${tipo}-current-page`).textContent = paginaAtual;
    document.getElementById(`${tipo}-total-pages`).textContent = totalPaginas;
    
    // Habilitar/desabilitar botões
    document.getElementById(`${tipo}-first`).disabled = paginaAtual === 1;
    document.getElementById(`${tipo}-prev`).disabled = paginaAtual === 1;
    document.getElementById(`${tipo}-next`).disabled = paginaAtual === totalPaginas;
    document.getElementById(`${tipo}-last`).disabled = paginaAtual === totalPaginas;
}

// Popular Filtros
function popularFiltros() {
    // Filtros de Emendas
    const funcoes = [...new Set(dadosEmendas.map(e => e['Nome Função']))].sort();
    const anos = [...new Set(dadosEmendas.map(e => e['Ano da Emenda']))].sort();
    
    const selectFuncao = document.getElementById('filter-emendas-funcao');
    funcoes.forEach(funcao => {
        const option = document.createElement('option');
        option.value = funcao;
        option.textContent = funcao;
        selectFuncao.appendChild(option);
    });
    
    const selectAno = document.getElementById('filter-emendas-ano');
    anos.forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        selectAno.appendChild(option);
    });

    // Filtros de Convênios
    const funcoesConvenios = [...new Set(dadosConvenios.map(c => c['Nome Função']))].sort();
    const selectFuncaoConvenios = document.getElementById('filter-convenios-funcao');
    funcoesConvenios.forEach(funcao => {
        const option = document.createElement('option');
        option.value = funcao;
        option.textContent = funcao;
        selectFuncaoConvenios.appendChild(option);
    });

    // Filtros de Favorecidos
    const tiposFavorecidos = [...new Set(dadosFavorecidos.map(f => f['Tipo Favorecido']))].sort();
    const selectTipo = document.getElementById('filter-favorecidos-tipo');
    tiposFavorecidos.forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo;
        option.textContent = tipo;
        selectTipo.appendChild(option);
    });

    const autoresFavorecidos = [...new Set(dadosFavorecidos.map(f => f['Nome do Autor da Emenda']))].sort();
    const selectAutor = document.getElementById('filter-favorecidos-autor');
    autoresFavorecidos.forEach(autor => {
        const option = document.createElement('option');
        option.value = autor;
        option.textContent = autor;
        selectAutor.appendChild(option);
    });
}

// Configurar Filtros
function configurarFiltros() {
    // Filtros de Emendas
    const filterAutor = document.getElementById('filter-emendas-autor');
    const filterFuncao = document.getElementById('filter-emendas-funcao');
    const filterAno = document.getElementById('filter-emendas-ano');

    const filtrarEmendas = () => {
        const autor = filterAutor.value.toLowerCase();
        const funcao = filterFuncao.value;
        const ano = filterAno.value;

        tabelasConfig.emendas.dadosFiltrados = dadosEmendas.filter(emenda => {
            const matchAutor = !autor || (emenda['Nome do Autor da Emenda'] || '').toLowerCase().includes(autor);
            const matchFuncao = !funcao || emenda['Nome Função'] === funcao;
            const matchAno = !ano || emenda['Ano da Emenda'] === ano;
            return matchAutor && matchFuncao && matchAno;
        });

        tabelasConfig.emendas.paginacao.paginaAtual = 1;
        popularTabela('emendas');
    };

    filterAutor.addEventListener('input', filtrarEmendas);
    filterFuncao.addEventListener('change', filtrarEmendas);
    filterAno.addEventListener('change', filtrarEmendas);

    // Filtros de Convênios
    const filterConvenente = document.getElementById('filter-convenios-convenente');
    const filterFuncaoConvenios = document.getElementById('filter-convenios-funcao');

    const filtrarConvenios = () => {
        const convenente = filterConvenente.value.toLowerCase();
        const funcao = filterFuncaoConvenios.value;

        tabelasConfig.convenios.dadosFiltrados = dadosConvenios.filter(convenio => {
            const matchConvenente = !convenente || (convenio['Convenente'] || '').toLowerCase().includes(convenente);
            const matchFuncao = !funcao || convenio['Nome Função'] === funcao;
            return matchConvenente && matchFuncao;
        });

        tabelasConfig.convenios.paginacao.paginaAtual = 1;
        popularTabela('convenios');
    };

    filterConvenente.addEventListener('input', filtrarConvenios);
    filterFuncaoConvenios.addEventListener('change', filtrarConvenios);

    // Filtros de Favorecidos
    const filterNome = document.getElementById('filter-favorecidos-nome');
    const filterTipo = document.getElementById('filter-favorecidos-tipo');
    const filterAutorFav = document.getElementById('filter-favorecidos-autor');

    const filtrarFavorecidos = () => {
        const nome = filterNome.value.toLowerCase();
        const tipo = filterTipo.value;
        const autor = filterAutorFav.value;

        tabelasConfig.favorecidos.dadosFiltrados = dadosFavorecidos.filter(favorecido => {
            const matchNome = !nome || (favorecido['Favorecido'] || '').toLowerCase().includes(nome);
            const matchTipo = !tipo || favorecido['Tipo Favorecido'] === tipo;
            const matchAutor = !autor || favorecido['Nome do Autor da Emenda'] === autor;
            return matchNome && matchTipo && matchAutor;
        });

        tabelasConfig.favorecidos.paginacao.paginaAtual = 1;
        popularTabela('favorecidos');
    };

    filterNome.addEventListener('input', filtrarFavorecidos);
    filterTipo.addEventListener('change', filtrarFavorecidos);
    filterAutorFav.addEventListener('change', filtrarFavorecidos);
}

// Configurar Paginação
function configurarPaginacao() {
    // Paginação Emendas
    document.getElementById('emendas-first').addEventListener('click', () => {
        tabelasConfig.emendas.paginacao.paginaAtual = 1;
        popularTabela('emendas');
    });
    
    document.getElementById('emendas-prev').addEventListener('click', () => {
        if (tabelasConfig.emendas.paginacao.paginaAtual > 1) {
            tabelasConfig.emendas.paginacao.paginaAtual--;
            popularTabela('emendas');
        }
    });
    
    document.getElementById('emendas-next').addEventListener('click', () => {
        const totalPaginas = Math.ceil(tabelasConfig.emendas.dadosFiltrados.length / tabelasConfig.emendas.paginacao.itensPorPagina);
        if (tabelasConfig.emendas.paginacao.paginaAtual < totalPaginas) {
            tabelasConfig.emendas.paginacao.paginaAtual++;
            popularTabela('emendas');
        }
    });
    
    document.getElementById('emendas-last').addEventListener('click', () => {
        const totalPaginas = Math.ceil(tabelasConfig.emendas.dadosFiltrados.length / tabelasConfig.emendas.paginacao.itensPorPagina);
        tabelasConfig.emendas.paginacao.paginaAtual = totalPaginas;
        popularTabela('emendas');
    });
    
    document.getElementById('emendas-per-page').addEventListener('change', (e) => {
        tabelasConfig.emendas.paginacao.itensPorPagina = parseInt(e.target.value);
        tabelasConfig.emendas.paginacao.paginaAtual = 1;
        popularTabela('emendas');
    });

    // Paginação Convênios
    document.getElementById('convenios-first').addEventListener('click', () => {
        tabelasConfig.convenios.paginacao.paginaAtual = 1;
        popularTabela('convenios');
    });
    
    document.getElementById('convenios-prev').addEventListener('click', () => {
        if (tabelasConfig.convenios.paginacao.paginaAtual > 1) {
            tabelasConfig.convenios.paginacao.paginaAtual--;
            popularTabela('convenios');
        }
    });
    
    document.getElementById('convenios-next').addEventListener('click', () => {
        const totalPaginas = Math.ceil(tabelasConfig.convenios.dadosFiltrados.length / tabelasConfig.convenios.paginacao.itensPorPagina);
        if (tabelasConfig.convenios.paginacao.paginaAtual < totalPaginas) {
            tabelasConfig.convenios.paginacao.paginaAtual++;
            popularTabela('convenios');
        }
    });
    
    document.getElementById('convenios-last').addEventListener('click', () => {
        const totalPaginas = Math.ceil(tabelasConfig.convenios.dadosFiltrados.length / tabelasConfig.convenios.paginacao.itensPorPagina);
        tabelasConfig.convenios.paginacao.paginaAtual = totalPaginas;
        popularTabela('convenios');
    });
    
    document.getElementById('convenios-per-page').addEventListener('change', (e) => {
        tabelasConfig.convenios.paginacao.itensPorPagina = parseInt(e.target.value);
        tabelasConfig.convenios.paginacao.paginaAtual = 1;
        popularTabela('convenios');
    });

    // Paginação Favorecidos
    document.getElementById('favorecidos-first').addEventListener('click', () => {
        tabelasConfig.favorecidos.paginacao.paginaAtual = 1;
        popularTabela('favorecidos');
    });
    
    document.getElementById('favorecidos-prev').addEventListener('click', () => {
        if (tabelasConfig.favorecidos.paginacao.paginaAtual > 1) {
            tabelasConfig.favorecidos.paginacao.paginaAtual--;
            popularTabela('favorecidos');
        }
    });
    
    document.getElementById('favorecidos-next').addEventListener('click', () => {
        const totalPaginas = Math.ceil(tabelasConfig.favorecidos.dadosFiltrados.length / tabelasConfig.favorecidos.paginacao.itensPorPagina);
        if (tabelasConfig.favorecidos.paginacao.paginaAtual < totalPaginas) {
            tabelasConfig.favorecidos.paginacao.paginaAtual++;
            popularTabela('favorecidos');
        }
    });
    
    document.getElementById('favorecidos-last').addEventListener('click', () => {
        const totalPaginas = Math.ceil(tabelasConfig.favorecidos.dadosFiltrados.length / tabelasConfig.favorecidos.paginacao.itensPorPagina);
        tabelasConfig.favorecidos.paginacao.paginaAtual = totalPaginas;
        popularTabela('favorecidos');
    });
    
    document.getElementById('favorecidos-per-page').addEventListener('change', (e) => {
        tabelasConfig.favorecidos.paginacao.itensPorPagina = parseInt(e.target.value);
        tabelasConfig.favorecidos.paginacao.paginaAtual = 1;
        popularTabela('favorecidos');
    });
}

// Configurar Ordenação
function configurarOrdenacao() {
    const aplicarOrdenacao = (th, stateObj, dadosFiltradosRef, popularFunc) => {
        const coluna = th.getAttribute('data-column');
        const tipo = th.getAttribute('data-type');
        // Alternar direção
        if (stateObj.coluna === coluna) {
            stateObj.direcao = stateObj.direcao === 'asc' ? 'desc' : 'asc';
        } else {
            stateObj.coluna = coluna;
            stateObj.direcao = 'asc';
        }
        popularFunc();
        atualizarSortIcons(th.closest('table'), stateObj);
    };

    const atualizarSortIcons = (table, stateObj) => {
        table.querySelectorAll('th[data-column]').forEach(th => {
            const iconSpan = th.querySelector('.sort-icon');
            th.classList.remove('sort-asc','sort-desc');
            iconSpan.textContent = '⇅';
            iconSpan.setAttribute('aria-label','Ordenar');
            const coluna = th.getAttribute('data-column');
            if (stateObj.coluna === coluna) {
                if (stateObj.direcao === 'asc') {
                    th.classList.add('sort-asc');
                    iconSpan.textContent = '↑';
                    iconSpan.setAttribute('aria-label','Ordenado ascendente');
                } else {
                    th.classList.add('sort-desc');
                    iconSpan.textContent = '↓';
                    iconSpan.setAttribute('aria-label','Ordenado descendente');
                }
            }
        });
    };

    // Emendas
    document.querySelectorAll('#table-emendas th[data-column]').forEach(th => {
        th.addEventListener('click', () => aplicarOrdenacao(th, tabelasConfig.emendas.ordenacao, tabelasConfig.emendas.dadosFiltrados, () => popularTabela('emendas')));
    });
    atualizarSortIcons(document.getElementById('table-emendas'), tabelasConfig.emendas.ordenacao);

    // Convênios
    document.querySelectorAll('#table-convenios th[data-column]').forEach(th => {
        th.addEventListener('click', () => aplicarOrdenacao(th, tabelasConfig.convenios.ordenacao, tabelasConfig.convenios.dadosFiltrados, () => popularTabela('convenios')));
    });
    atualizarSortIcons(document.getElementById('table-convenios'), tabelasConfig.convenios.ordenacao);

    // Favorecidos
    document.querySelectorAll('#table-favorecidos th[data-column]').forEach(th => {
        th.addEventListener('click', () => aplicarOrdenacao(th, tabelasConfig.favorecidos.ordenacao, tabelasConfig.favorecidos.dadosFiltrados, () => popularTabela('favorecidos')));
    });
    atualizarSortIcons(document.getElementById('table-favorecidos'), tabelasConfig.favorecidos.ordenacao);
}

// -------- Interatividade Adicional --------
// Reset Filtros
function adicionarResetFiltros() {
    const configs = [
        { btn: '#reset-emendas', filtros: ['#filter-emendas-autor','#filter-emendas-funcao','#filter-emendas-ano'], tipo: 'emendas' },
        { btn: '#reset-convenios', filtros: ['#filter-convenios-convenente','#filter-convenios-funcao'], tipo: 'convenios' },
        { btn: '#reset-favorecidos', filtros: ['#filter-favorecidos-nome','#filter-favorecidos-tipo','#filter-favorecidos-autor'], tipo: 'favorecidos' }
    ];
    configs.forEach(cfg => {
        const btn = document.querySelector(cfg.btn);
        if (btn) {
            btn.addEventListener('click', () => {
                cfg.filtros.forEach(sel => { 
                    const el = document.querySelector(sel); 
                    if (el) el.value = ''; 
                });
                // Restaurar dados originais
                const dadosOriginais = cfg.tipo === 'emendas' ? dadosEmendas : 
                                      cfg.tipo === 'convenios' ? dadosConvenios : 
                                      dadosFavorecidos;
                tabelasConfig[cfg.tipo].dadosFiltrados = [...dadosOriginais];
                tabelasConfig[cfg.tipo].paginacao.paginaAtual = 1;
                popularTabela(cfg.tipo);
            });
        }
    });
}

// Global Search
function configurarBuscaGlobal() {
    const input = document.getElementById('global-search');
    if (!input) return;
    input.addEventListener('input', () => {
        const termo = input.value.toLowerCase();
        // Restaurar se vazio
        if (!termo) {
            tabelasConfig.emendas.dadosFiltrados = [...dadosEmendas];
            tabelasConfig.convenios.dadosFiltrados = [...dadosConvenios];
            tabelasConfig.favorecidos.dadosFiltrados = [...dadosFavorecidos];
            popularTabelas();
            return;
        }
        const filtrarObjeto = (arr, campos) => arr.filter(obj => campos.some(c => (obj[c]||'').toString().toLowerCase().includes(termo)));
        tabelasConfig.emendas.dadosFiltrados = filtrarObjeto(dadosEmendas,[ 'Nome do Autor da Emenda','Tipo de Emenda','Nome Função','Nome Subfunção']);
        tabelasConfig.convenios.dadosFiltrados = filtrarObjeto(dadosConvenios,['Convenente','Nome Função','Objeto Convênio']);
        tabelasConfig.favorecidos.dadosFiltrados = filtrarObjeto(dadosFavorecidos,['Favorecido','Tipo Favorecido','Nome do Autor da Emenda']);
        tabelasConfig.emendas.paginacao.paginaAtual=1; tabelasConfig.convenios.paginacao.paginaAtual=1; tabelasConfig.favorecidos.paginacao.paginaAtual=1;
        popularTabelas();
    });
}

// Row click highlight
function ativarClickLinhas() {
    ['#table-emendas','#table-convenios','#table-favorecidos'].forEach(sel => {
        const tbody = document.querySelector(sel+' tbody');
        if (!tbody) return;
        tbody.addEventListener('click', (e) => {
            const tr = e.target.closest('tr');
            if (!tr) return;
            tr.classList.toggle('row-active');
        });
    });
}

// Chart enhancements (center text for doughnut)
const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
        if (chart.config.type !== 'doughnut') return;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data[0]) return;
        const { ctx } = chart;
        const { x, y } = meta.data[0];
        const total = chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
        ctx.save();
        ctx.font = (window.innerWidth < 768 ? '12px' : '14px') + ' sans-serif';
        ctx.fillStyle = '#2c3e50';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatarMoeda(total), x, y);
        ctx.restore();
    }
};

// Override criarGraficoTipoEmenda to include plugin if not already added
// We append plugin registration after all charts creation

// Indicators click scroll
function configurarIndicadoresInterativos() {
    document.querySelectorAll('.indicator-card').forEach(card => {
        card.style.cursor='pointer';
        card.addEventListener('click', () => {
            document.querySelector('.charts-section')?.scrollIntoView({behavior:'smooth'});
        });
    });
}

// Inicialização extra após dashboard
function configurarTooltipsGraficos() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    document.querySelectorAll('.info-icon[data-tooltip]').forEach(icon => {
        const text = icon.getAttribute('data-tooltip');
        if (!text) return;
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-info-tooltip';
        tooltip.textContent = text;
        icon.appendChild(tooltip);
        const show = () => tooltip.classList.add('visible');
        const hide = () => tooltip.classList.remove('visible');
        if (isTouch) {
            icon.addEventListener('click', e => {
                e.stopPropagation();
                tooltip.classList.toggle('visible');
            });
            document.addEventListener('click', () => hide());
        } else {
            icon.addEventListener('mouseenter', show);
            icon.addEventListener('mouseleave', hide);
            icon.addEventListener('focus', show);
            icon.addEventListener('blur', hide);
        }
        icon.addEventListener('keydown', e => {
            if (e.key === 'Escape') hide();
            if ((e.key === 'Enter' || e.key === ' ') && isTouch) {
                e.preventDefault();
                tooltip.classList.toggle('visible');
            }
        });
    });
}
function inicializarInteracoesExtras() {
    adicionarResetFiltros();
    configurarBuscaGlobal();
    ativarClickLinhas();
    configurarIndicadoresInterativos();
    configurarTooltipsGraficos();
    // Registrar plugin global para doughnut center text
    try {
        const already = Chart.registry?.plugins?.some(p => p.id === 'centerText');
        if (!already) {
            Chart.register(centerTextPlugin);
        }
    } catch (e) {
        Chart.register(centerTextPlugin);
    }
}

// Atualizar Data de Atualização
function atualizarDataAtualizacao() {
    const hoje = new Date();
    const dataFormatada = hoje.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
    document.getElementById('last-update').textContent = dataFormatada;
}

// Iniciar aplicação quando a página carregar
document.addEventListener('DOMContentLoaded', carregarDados);
