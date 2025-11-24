// Variáveis globais
let dadosEmendas = [];
let dadosConvenios = [];
let dadosFavorecidos = [];

// Dados filtrados para paginação
let dadosEmendasFiltrados = [];
let dadosConveniosFiltrados = [];
let dadosFavorecidosFiltrados = [];

// Estado da paginação
let paginacaoEmendas = { paginaAtual: 1, itensPorPagina: 10 };
let paginacaoConvenios = { paginaAtual: 1, itensPorPagina: 10 };
let paginacaoFavorecidos = { paginaAtual: 1, itensPorPagina: 10 };

// Estado da ordenação
let ordenacaoEmendas = { coluna: null, direcao: 'asc' };
let ordenacaoConvenios = { coluna: null, direcao: 'asc' };
let ordenacaoFavorecidos = { coluna: null, direcao: 'asc' };

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
    dadosEmendasFiltrados = [...dadosEmendas];
    dadosConveniosFiltrados = [...dadosConvenios];
    dadosFavorecidosFiltrados = [...dadosFavorecidos];
    
    popularTabelas();
    popularFiltros();
    configurarFiltros();
    configurarPaginacao();
    configurarOrdenacao();
    atualizarDataAtualizacao();
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
    popularTabelaEmendas();
    popularTabelaConvenios();
    popularTabelaFavorecidos();
}

function ordenarDados(dados, coluna, direcao, tipo) {
    return [...dados].sort((a, b) => {
        let valorA = a[coluna];
        let valorB = b[coluna];
        
        if (tipo === 'number') {
            valorA = parseFloat(valorA) || 0;
            valorB = parseFloat(valorB) || 0;
        } else {
            valorA = (valorA || '').toString().toLowerCase();
            valorB = (valorB || '').toString().toLowerCase();
        }
        
        if (valorA < valorB) return direcao === 'asc' ? -1 : 1;
        if (valorA > valorB) return direcao === 'asc' ? 1 : -1;
        return 0;
    });
}

function popularTabelaEmendas() {
    const { paginaAtual, itensPorPagina } = paginacaoEmendas;
    
    // Aplicar ordenação se houver
    let dadosOrdenados = dadosEmendasFiltrados;
    if (ordenacaoEmendas.coluna) {
        const th = document.querySelector(`#table-emendas th[data-column="${ordenacaoEmendas.coluna}"]`);
        const tipo = th.getAttribute('data-type');
        dadosOrdenados = ordenarDados(dadosEmendasFiltrados, ordenacaoEmendas.coluna, ordenacaoEmendas.direcao, tipo);
    }
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const dadosPagina = dadosOrdenados.slice(inicio, fim);
    
    const tbody = document.querySelector('#table-emendas tbody');
    tbody.innerHTML = '';
    
    dadosPagina.forEach(emenda => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${emenda['Ano da Emenda'] || '-'}</td>
            <td>${emenda['Nome do Autor da Emenda'] || '-'}</td>
            <td>${emenda['Tipo de Emenda'] || '-'}</td>
            <td>${emenda['Nome Função'] || '-'}</td>
            <td>${emenda['Nome Subfunção'] || '-'}</td>
            <td class="valor-monetario">${formatarMoeda(emenda['Valor Empenhado'])}</td>
            <td class="valor-monetario">${formatarMoeda(emenda['Valor Pago'])}</td>
        `;
        tbody.appendChild(tr);
    });
    
    atualizarInfoPaginacao('emendas', dadosEmendasFiltrados.length, paginaAtual, itensPorPagina);
}

function popularTabelaConvenios() {
    const { paginaAtual, itensPorPagina } = paginacaoConvenios;
    
    // Aplicar ordenação se houver
    let dadosOrdenados = dadosConveniosFiltrados;
    if (ordenacaoConvenios.coluna) {
        const th = document.querySelector(`#table-convenios th[data-column="${ordenacaoConvenios.coluna}"]`);
        const tipo = th.getAttribute('data-type');
        dadosOrdenados = ordenarDados(dadosConveniosFiltrados, ordenacaoConvenios.coluna, ordenacaoConvenios.direcao, tipo);
    }
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const dadosPagina = dadosOrdenados.slice(inicio, fim);
    
    const tbody = document.querySelector('#table-convenios tbody');
    tbody.innerHTML = '';
    
    dadosPagina.forEach(convenio => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${convenio['Data Publicação Convênio'] || '-'}</td>
            <td>${convenio['Número Convênio'] || '-'}</td>
            <td>${convenio['Convenente'] || '-'}</td>
            <td>${convenio['Nome Função'] || '-'}</td>
            <td class="valor-monetario">${formatarMoeda(convenio['Valor Convênio'])}</td>
            <td>${(convenio['Objeto Convênio'] || '-').substring(0, 100)}...</td>
        `;
        tbody.appendChild(tr);
    });
    
    atualizarInfoPaginacao('convenios', dadosConveniosFiltrados.length, paginaAtual, itensPorPagina);
}

function popularTabelaFavorecidos() {
    const { paginaAtual, itensPorPagina } = paginacaoFavorecidos;
    
    // Aplicar ordenação se houver
    let dadosOrdenados = dadosFavorecidosFiltrados;
    if (ordenacaoFavorecidos.coluna) {
        const th = document.querySelector(`#table-favorecidos th[data-column="${ordenacaoFavorecidos.coluna}"]`);
        const tipo = th.getAttribute('data-type');
        dadosOrdenados = ordenarDados(dadosFavorecidosFiltrados, ordenacaoFavorecidos.coluna, ordenacaoFavorecidos.direcao, tipo);
    }
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const dadosPagina = dadosOrdenados.slice(inicio, fim);
    
    const tbody = document.querySelector('#table-favorecidos tbody');
    tbody.innerHTML = '';
    
    dadosPagina.forEach(favorecido => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${favorecido['Ano/Mês'] || '-'}</td>
            <td>${favorecido['Favorecido'] || '-'}</td>
            <td>${favorecido['Tipo Favorecido'] || '-'}</td>
            <td>${favorecido['Nome do Autor da Emenda'] || '-'}</td>
            <td class="valor-monetario">${formatarMoeda(favorecido['Valor Recebido'])}</td>
        `;
        tbody.appendChild(tr);
    });
    
    atualizarInfoPaginacao('favorecidos', dadosFavorecidosFiltrados.length, paginaAtual, itensPorPagina);
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

        dadosEmendasFiltrados = dadosEmendas.filter(emenda => {
            const matchAutor = !autor || (emenda['Nome do Autor da Emenda'] || '').toLowerCase().includes(autor);
            const matchFuncao = !funcao || emenda['Nome Função'] === funcao;
            const matchAno = !ano || emenda['Ano da Emenda'] === ano;
            return matchAutor && matchFuncao && matchAno;
        });

        paginacaoEmendas.paginaAtual = 1;
        popularTabelaEmendas();
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

        dadosConveniosFiltrados = dadosConvenios.filter(convenio => {
            const matchConvenente = !convenente || (convenio['Convenente'] || '').toLowerCase().includes(convenente);
            const matchFuncao = !funcao || convenio['Nome Função'] === funcao;
            return matchConvenente && matchFuncao;
        });

        paginacaoConvenios.paginaAtual = 1;
        popularTabelaConvenios();
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

        dadosFavorecidosFiltrados = dadosFavorecidos.filter(favorecido => {
            const matchNome = !nome || (favorecido['Favorecido'] || '').toLowerCase().includes(nome);
            const matchTipo = !tipo || favorecido['Tipo Favorecido'] === tipo;
            const matchAutor = !autor || favorecido['Nome do Autor da Emenda'] === autor;
            return matchNome && matchTipo && matchAutor;
        });

        paginacaoFavorecidos.paginaAtual = 1;
        popularTabelaFavorecidos();
    };

    filterNome.addEventListener('input', filtrarFavorecidos);
    filterTipo.addEventListener('change', filtrarFavorecidos);
    filterAutorFav.addEventListener('change', filtrarFavorecidos);
}

// Configurar Paginação
function configurarPaginacao() {
    // Paginação Emendas
    document.getElementById('emendas-first').addEventListener('click', () => {
        paginacaoEmendas.paginaAtual = 1;
        popularTabelaEmendas();
    });
    
    document.getElementById('emendas-prev').addEventListener('click', () => {
        if (paginacaoEmendas.paginaAtual > 1) {
            paginacaoEmendas.paginaAtual--;
            popularTabelaEmendas();
        }
    });
    
    document.getElementById('emendas-next').addEventListener('click', () => {
        const totalPaginas = Math.ceil(dadosEmendasFiltrados.length / paginacaoEmendas.itensPorPagina);
        if (paginacaoEmendas.paginaAtual < totalPaginas) {
            paginacaoEmendas.paginaAtual++;
            popularTabelaEmendas();
        }
    });
    
    document.getElementById('emendas-last').addEventListener('click', () => {
        const totalPaginas = Math.ceil(dadosEmendasFiltrados.length / paginacaoEmendas.itensPorPagina);
        paginacaoEmendas.paginaAtual = totalPaginas;
        popularTabelaEmendas();
    });
    
    document.getElementById('emendas-per-page').addEventListener('change', (e) => {
        paginacaoEmendas.itensPorPagina = parseInt(e.target.value);
        paginacaoEmendas.paginaAtual = 1;
        popularTabelaEmendas();
    });

    // Paginação Convênios
    document.getElementById('convenios-first').addEventListener('click', () => {
        paginacaoConvenios.paginaAtual = 1;
        popularTabelaConvenios();
    });
    
    document.getElementById('convenios-prev').addEventListener('click', () => {
        if (paginacaoConvenios.paginaAtual > 1) {
            paginacaoConvenios.paginaAtual--;
            popularTabelaConvenios();
        }
    });
    
    document.getElementById('convenios-next').addEventListener('click', () => {
        const totalPaginas = Math.ceil(dadosConveniosFiltrados.length / paginacaoConvenios.itensPorPagina);
        if (paginacaoConvenios.paginaAtual < totalPaginas) {
            paginacaoConvenios.paginaAtual++;
            popularTabelaConvenios();
        }
    });
    
    document.getElementById('convenios-last').addEventListener('click', () => {
        const totalPaginas = Math.ceil(dadosConveniosFiltrados.length / paginacaoConvenios.itensPorPagina);
        paginacaoConvenios.paginaAtual = totalPaginas;
        popularTabelaConvenios();
    });
    
    document.getElementById('convenios-per-page').addEventListener('change', (e) => {
        paginacaoConvenios.itensPorPagina = parseInt(e.target.value);
        paginacaoConvenios.paginaAtual = 1;
        popularTabelaConvenios();
    });

    // Paginação Favorecidos
    document.getElementById('favorecidos-first').addEventListener('click', () => {
        paginacaoFavorecidos.paginaAtual = 1;
        popularTabelaFavorecidos();
    });
    
    document.getElementById('favorecidos-prev').addEventListener('click', () => {
        if (paginacaoFavorecidos.paginaAtual > 1) {
            paginacaoFavorecidos.paginaAtual--;
            popularTabelaFavorecidos();
        }
    });
    
    document.getElementById('favorecidos-next').addEventListener('click', () => {
        const totalPaginas = Math.ceil(dadosFavorecidosFiltrados.length / paginacaoFavorecidos.itensPorPagina);
        if (paginacaoFavorecidos.paginaAtual < totalPaginas) {
            paginacaoFavorecidos.paginaAtual++;
            popularTabelaFavorecidos();
        }
    });
    
    document.getElementById('favorecidos-last').addEventListener('click', () => {
        const totalPaginas = Math.ceil(dadosFavorecidosFiltrados.length / paginacaoFavorecidos.itensPorPagina);
        paginacaoFavorecidos.paginaAtual = totalPaginas;
        popularTabelaFavorecidos();
    });
    
    document.getElementById('favorecidos-per-page').addEventListener('change', (e) => {
        paginacaoFavorecidos.itensPorPagina = parseInt(e.target.value);
        paginacaoFavorecidos.paginaAtual = 1;
        popularTabelaFavorecidos();
    });
}

// Configurar Ordenação
function configurarOrdenacao() {
    // Ordenação Emendas
    document.querySelectorAll('#table-emendas th[data-column]').forEach(th => {
        th.addEventListener('click', () => {
            const coluna = th.getAttribute('data-column');
            
            // Atualizar direção
            if (ordenacaoEmendas.coluna === coluna) {
                ordenacaoEmendas.direcao = ordenacaoEmendas.direcao === 'asc' ? 'desc' : 'asc';
            } else {
                ordenacaoEmendas.coluna = coluna;
                ordenacaoEmendas.direcao = 'asc';
            }
            
            // Atualizar classes visuais
            document.querySelectorAll('#table-emendas th').forEach(header => {
                header.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(ordenacaoEmendas.direcao === 'asc' ? 'sort-asc' : 'sort-desc');
            
            // Reordenar e exibir
            paginacaoEmendas.paginaAtual = 1;
            popularTabelaEmendas();
        });
    });

    // Ordenação Convênios
    document.querySelectorAll('#table-convenios th[data-column]').forEach(th => {
        th.addEventListener('click', () => {
            const coluna = th.getAttribute('data-column');
            
            if (ordenacaoConvenios.coluna === coluna) {
                ordenacaoConvenios.direcao = ordenacaoConvenios.direcao === 'asc' ? 'desc' : 'asc';
            } else {
                ordenacaoConvenios.coluna = coluna;
                ordenacaoConvenios.direcao = 'asc';
            }
            
            document.querySelectorAll('#table-convenios th').forEach(header => {
                header.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(ordenacaoConvenios.direcao === 'asc' ? 'sort-asc' : 'sort-desc');
            
            paginacaoConvenios.paginaAtual = 1;
            popularTabelaConvenios();
        });
    });

    // Ordenação Favorecidos
    document.querySelectorAll('#table-favorecidos th[data-column]').forEach(th => {
        th.addEventListener('click', () => {
            const coluna = th.getAttribute('data-column');
            
            if (ordenacaoFavorecidos.coluna === coluna) {
                ordenacaoFavorecidos.direcao = ordenacaoFavorecidos.direcao === 'asc' ? 'desc' : 'asc';
            } else {
                ordenacaoFavorecidos.coluna = coluna;
                ordenacaoFavorecidos.direcao = 'asc';
            }
            
            document.querySelectorAll('#table-favorecidos th').forEach(header => {
                header.classList.remove('sort-asc', 'sort-desc');
            });
            th.classList.add(ordenacaoFavorecidos.direcao === 'asc' ? 'sort-asc' : 'sort-desc');
            
            paginacaoFavorecidos.paginaAtual = 1;
            popularTabelaFavorecidos();
        });
    });
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
