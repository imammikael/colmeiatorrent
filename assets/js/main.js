/* --- CÉREBRO PRINCIPAL DO COLMEIATORRENT (V5 - COM BANNER) --- */

// --- PASSO 1: CONEXÃO COM O SUPABASE ---
const SUPABASE_URL = 'https://imbnelgjhixhwjqtotgb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltYm5lbGdqaGl4aHdqcXRvdGdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMTU2ODIsImV4cCI6MjA3NjU5MTY4Mn0.lVy6WoDdFiEG8iWNU60m23YxZw1kMgh2W5VrvAjh5Ks';

// O 'supabase' é carregado no index.html, então podemos usá-lo globalmente
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- PASSO 2: FUNÇÃO PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
    loadLayoutAndInitScripts();
});

async function loadLayoutAndInitScripts() {
    const headerPlaceholder = document.getElementById('header-placeholder');
    const footerPlaceholder = document.getElementById('footer-placeholder');
    
    // 1. Carrega Header e Footer em paralelo
    const loadPromises = [];
    if (headerPlaceholder) {
        loadPromises.push(
            fetch('_header.html')
                .then(res => res.text())
                .then(data => headerPlaceholder.innerHTML = data)
        );
    }
    if (footerPlaceholder) {
        loadPromises.push(
            fetch('_footer.html')
                .then(res => res.text())
                .then(data => footerPlaceholder.innerHTML = data)
        );
    }
    
    // 2. Espera que AMBOS (header e footer) estejam prontos
    await Promise.all(loadPromises);
    initHeaderJavaScript(); 
    initFooterJavaScript();
    loadPageContent();
}

/**
 * Função "Roteadora": Decide qual conteúdo carregar
 */
function loadPageContent() {
    const path = window.location.pathname.split("/").pop();
    const params = new URLSearchParams(window.location.search);
    const searchQuery = params.get('q'); // Pega o termo de busca (ex: "ultimato")

    // ROTA 1: Se houver um termo de busca, CARREGA A BUSCA (Prioridade Máxima)
    if (searchQuery) {
        loadSearchResultsContent(searchQuery);
    }
    // ROTA 2: Se não houver busca, verifica qual página é
    else if (path === 'index.html' || path === '') {
        loadHomePageContent();
    } 
    else if (path === 'single-filme.html') {
        loadSingleFilmeContent();
    }
    // ADICIONE ESTA NOVA CONDIÇÃO
    else if (path === 'arquivo-genero.html') {
        loadArquivoGeneroContent();
    }
    // ADICIONE ESTA NOVA CONDIÇÃO
    else if (path === 'pedidos.html') {
        loadPedidosPage();
    }
}

/**
 * Busca e preenche o menu de categorias (chamado por loadLayoutAndInitScripts)
 */
async function loadCategoriesMenu() {
    const menuContainer = document.getElementById('category-menu-placeholder');
    if (!menuContainer) return; 

    const { data: generos, error } = await supabase
        .from('generos')
        .select('nome, slug')
        .order('nome', { ascending: true });

    if (error) {
        console.error('Erro ao buscar gêneros:', error);
        menuContainer.innerHTML = '<li><a href="#">Erro</a></li>';
        return;
    }

    let menuHTML = '';
    for (const genero of generos) {
        menuHTML += `<li><a href="arquivo-genero.html?slug=${genero.slug}">${genero.nome}</a></li>`;
    }
    menuContainer.innerHTML = menuHTML;
}

/**
 * Carrega o conteúdo principal da Home: O Banner e as Prateleiras
 */
async function loadHomePageContent() {
    // 1. Carrega o Banner
    const bannerPlaceholder = document.getElementById('banner-placeholder');
    if (bannerPlaceholder) {
        await loadHeroBanner(bannerPlaceholder);
    }
    
    // 2. Carrega Prateleiras
    const prateleirasContainer = document.getElementById('prateleiras-container');
    if (prateleirasContainer) {
        await loadAllShelves(prateleirasContainer);
    }
}

/**
 * Busca o filme em destaque e constrói o Banner
 */
async function loadHeroBanner(bannerPlaceholder) {
    const { data: banner_data, error } = await supabase
        .from('filmes')
        .select('id, titulo, sinopse, banner_image_url, banner_video_url')
        .eq('is_featured', true)
        .limit(1)
        .single();

    if (error || !banner_data) {
        console.error('Erro ao buscar banner:', error);
        bannerPlaceholder.style.display = 'none'; // Esconde o banner se der erro
        return;
    }

    // "Desenha" o HTML do banner
    bannerPlaceholder.innerHTML = `
        <div class="hero-banner" id="hero-banner">
            <div class="banner-media-wrapper">
                <div class="banner-video-container">
                    <video id="banner-video-player" playsinline muted autoplay>
                        <source src="${banner_data.banner_video_url}" type="video/mp4">
                    </video>
                </div>
                <div class="banner-image" style="background-image: url('${banner_data.banner_image_url}');"></div>
            </div>
            <div class="banner-overlay"></div>
            <div class="banner-content container">
                <h1>${banner_data.titulo}</h1>
                <p>${banner_data.sinopse.substring(0, 200)}...</p>
                <a href="single-filme.html?id=${banner_data.id}" class="btn-destaque">
                    Ver Detalhes
                </a>
            </div>
            <div class="banner-controls">
                <button id="volume-toggle-btn" class="control-btn">
                    <i class="fa-solid fa-volume-xmark"></i>
                </button>
                <button id="replay-btn" class="control-btn" style="display: none;">
                    <i class="fa-solid fa-arrow-rotate-right"></i>
                </button>
            </div>
        </div>
    `;

    // A CORREÇÃO: Chama o init do banner DEPOIS que o HTML foi criado
    initBannerJavaScript();
}

/**
 * Busca e desenha TODAS as prateleiras de filmes em paralelo
 */
async function loadAllShelves(prateleirasContainer) {
    if (!prateleirasContainer) return;
    // Mostra um carregamento inicial
    prateleirasContainer.innerHTML = "<p style='text-align: center; color: var(--cor-texto-secundario);'>Carregando prateleiras...</p>";

    try {
        const anoAtual = new Date().getFullYear();

        // 1. Define todas as "promessas" de busca
        const promessaUltimos = supabase.from('filmes').select('id, titulo, capa_url').order('data_adicionado', { ascending: false }).limit(6);
        const promessaEmAlta = supabase.from('filmes').select('id, titulo, capa_url').order('downloads', { ascending: false }).limit(6);
        const promessaLancamentos = supabase.from('filmes').select('id, titulo, capa_url').eq('ano_lancamento', anoAtual).limit(6);

        // Busca filmes que contenham o gênero 'acao'
        const promessaAcao = supabase.from('filmes').select('id, titulo, capa_url, generos!inner(slug)').eq('generos.slug', 'acao').limit(6);

        // Busca filmes que contenham 'terror' OU 'suspense'
        const promessaTerrorSuspense = supabase.from('filmes').select('id, titulo, capa_url, generos!inner(slug)').in('generos.slug', ['terror', 'suspense']).limit(6);

        // Busca clássicos (antes de 2000) ordenados por nota
        const promessaClassicos = supabase.from('filmes').select('id, titulo, capa_url').lt('ano_lancamento', 2000).order('imdb_rating', { ascending: false }).limit(6);

        // 2. Executa todas as buscas ao MESMO TEMPO (em paralelo)
        const [
            { data: ultimosFilmes },
            { data: filmesEmAlta },
            { data: filmesLancamentos },
            { data: filmesAcao },
            { data: filmesTerrorSuspense },
            { data: filmesClassicos }
        ] = await Promise.all([
            promessaUltimos,
            promessaEmAlta,
            promessaLancamentos,
            promessaAcao,
            promessaTerrorSuspense,
            promessaClassicos
        ]);

        // 3. "Desenha" o HTML final
        let prateleirasHTML = '';

        if (ultimosFilmes && ultimosFilmes.length > 0) {
            prateleirasHTML += createShelfHTML('Últimos Filmes Adicionados', ultimosFilmes);
        }
        if (filmesEmAlta && filmesEmAlta.length > 0) {
            prateleirasHTML += createShelfHTML('Em Alta', filmesEmAlta);
        }
        if (filmesLancamentos && filmesLancamentos.length > 0) {
            prateleirasHTML += createShelfHTML(`Lançamentos ${anoAtual}`, filmesLancamentos);
        }
        if (filmesAcao && filmesAcao.length > 0) {
            prateleirasHTML += createShelfHTML('Ação em Destaque', filmesAcao);
        }
        if (filmesTerrorSuspense && filmesTerrorSuspense.length > 0) {
            // Remove duplicatas caso um filme seja de terror E suspense
            const filmesUnicos = Array.from(new Map(filmesTerrorSuspense.map(filme => [filme.id, filme])).values());
            prateleirasHTML += createShelfHTML('Terror e Suspense', filmesUnicos);
        }
        if (filmesClassicos && filmesClassicos.length > 0) {
            prateleirasHTML += createShelfHTML('Clássicos que Nunca Envelhecem', filmesClassicos);
        }

        // 4. Injeta o HTML na página
        if (prateleirasHTML === '') {
            prateleirasContainer.innerHTML = "<p>Nenhum filme adicionado ainda.</p>";
        } else {
            prateleirasContainer.innerHTML = prateleirasHTML;
        }

    } catch (error) {
        console.error('Erro ao carregar prateleiras:', error);
        prateleirasContainer.innerHTML = "<p>Erro ao carregar filmes.</p>";
    }
}

function createShelfHTML(titulo, filmes) {
    let html = `
        <section class="content-shelf">
            <h2 class="shelf-title">${titulo}</h2>
            <div class="shelf-grid">
    `;
    for (const filme of filmes) {
        html += `
            <a href="single-filme.html?id=${filme.id}" class="movie-card">
                <img src="${filme.capa_url}" alt="Pôster de ${filme.titulo}">
                <div class="card-overlay">
                    <h3 class="card-title">${filme.titulo}</h3>
                </div>
            </a>
        `;
    }
    html += '</div></section>';
    return html;
}

/**
 * Busca os detalhes de um filme específico e desenha a página
 */
async function loadSingleFilmeContent() {
    const contentPlaceholder = document.getElementById('movie-details-content');
    if (!contentPlaceholder) return;

    // 1. Pega o ID do filme da URL (ex: ...?id=16)
    const params = new URLSearchParams(window.location.search);
    const filmeId = params.get('id');

    if (!filmeId) {
        contentPlaceholder.innerHTML = `<div class="error-message"><h1>Filme não encontrado</h1><p>O ID do filme não foi fornecido na URL.</p></div>`;
        return;
    }

    // 2. Busca os dados do filme E seus gêneros relacionados de uma só vez
    // ATENÇÃO: Esta consulta complexa só funciona se você fez o Passo 3 (a "Ligação" dos gêneros)
    const { data: filme, error } = await supabase
        .from('filmes')
        .select(`
            *,
            generos ( id, nome, slug )
        `)
        .eq('id', filmeId)
        .single(); // .single() pega o único filme com esse ID

    if (error || !filme) {
        console.error('Erro ao buscar detalhes do filme:', error);
        contentPlaceholder.innerHTML = `<div class="error-message"><h1>Filme não encontrado</h1><p>Não foi possível carregar os detalhes deste filme.</p></div>`;
        return;
    }

    // 3. Busca os filmes "Semelhantes"
    let filmesSemelhantesHTML = '';
    if (filme.generos && filme.generos.length > 0) {
        // Pega o ID do primeiro gênero para usar como critério
        const primeiroGeneroId = filme.generos[0].id;

        // Busca filmes que também estão nesse gênero
        const { data: semelhantes } = await supabase
            .from('filme_genero') // Começa pela tabela de ligação
            .select(`
                filmes ( id, titulo, capa_url )
            `)
            .eq('genero_id', primeiroGeneroId) // Filtra pelo gênero
            .neq('filme_id', filmeId) // Exclui o filme atual
            .limit(6);
        
        if (semelhantes && semelhantes.length > 0) {
            for (const item of semelhantes) {
                // O Supabase retorna { filmes: { id: ..., titulo: ... } }
                const sem = item.filmes; 
                filmesSemelhantesHTML += `
                    <a href="single-filme.html?id=${sem.id}" class="sidebar-movie-item">
                        <img src="${sem.capa_url}" alt="Pôster de ${sem.titulo}">
                        <div class="sidebar-movie-title">${sem.titulo}</div>
                    </a>
                `;
            }
        }
    }

    // 4. Prepara os dados para o HTML
    const generosHTML = filme.generos.map(g => 
        `<a href="arquivo-genero.html?slug=${g.slug}">${g.nome}</a>`
    ).join(', ');
    
    const sinopseHTML = filme.sinopse ? filme.sinopse.replace(/\n/g, '<br>') : 'Sinopse não disponível.';
    const trailerHTML = filme.trailer_url ? `
        <div class="trailer-section">
            <h2>Trailer</h2>
            <div class="video-container">
                <iframe src="${getYoutubeEmbedUrl(filme.trailer_url)}" frameborder="0" allowfullscreen></iframe>
            </div>
        </div>
    ` : '';

    // 5. "Desenha" o HTML final e o injeta na página
    const filmeHTML = `
        <div class="main-and-sidebar-container">
            <div class="main-content">
                <div class="movie-details-container">
                    <div class="movie-poster">
                        <img src="${filme.capa_url}" alt="Pôster de ${filme.titulo}">
                    </div>
                    <div class="movie-info">
                        <h1>${filme.titulo}</h1>
                        
                        <p class="movie-sinopse">${sinopseHTML}</p>
                        <ul class="tech-specs">
                            <li><strong>IMDb:</strong> ${filme.imdb_rating || 'N/A'}</li>
                            <li><strong>Ano:</strong> ${filme.ano_lancamento || 'N/A'}</li>
                            <li><strong>Gênero:</strong> ${generosHTML || 'N/A'}</li>
                            <li><strong>Formato:</strong> ${filme.formato || 'N/A'}</li>
                            <li><strong>Qualidade:</strong> ${filme.qualidade || 'N/A'}</li>
                            <li><strong>Áudio:</strong> ${filme.audio || 'N/A'}</li>
                            <li><strong>Tamanho:</strong> ${filme.tamanho || 'N/A'}</li>
                            <li><strong>Duração:</strong> ${formatarDuracao(filme.duracao_min)}</li>
                            <li><strong>Qualidade de Vídeo:</strong> ${filme.qualidade_video || 'N/A'}</li>
                        </ul>
                        <div class="download-buttons">
                            <a href="${filme.link_encurtado}" target="_blank" class="btn-download primary">Download </a>
                            
                            </div>
                    </div>
                </div>
            </div>
        </div>
        ${trailerHTML}
        
        `;
    
    contentPlaceholder.innerHTML = filmeHTML;

    // 6. Atualiza o título da aba do navegador
    document.title = `ColmeiaTorrent - ${filme.titulo}`;
}

/**
 * Função auxiliar para extrair ID do vídeo do YouTube
 */
function getYoutubeEmbedUrl(url) {
    if (!url) return '';
    let videoId = '';
    const regex = /(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
    const match = url.match(regex);
    if (match) {
        videoId = match[1];
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
}

/**
 * Função auxiliar para formatar duração
 */
function formatarDuracao(total_minutos) {
    if (!total_minutos || total_minutos <= 0) { return 'N/A'; }
    const horas = Math.floor(total_minutos / 60);
    const minutos = total_minutos % 60;
    let resultado = '';
    if (horas > 0) { resultado += `${horas}h`; }
    if (minutos > 0) { if (horas > 0) { resultado += ' '; } resultado += `${minutos}min`; }
    return resultado;
}

/**
 * Carrega o formulário e a lista de pedidos
 */
async function loadPedidosPage() {
    const contentPlaceholder = document.getElementById('pedidos-content-placeholder');
    if (!contentPlaceholder) return;

    // 1. "Desenha" o layout estático da página (formulário e container da lista)
    contentPlaceholder.innerHTML = `
        <div class="pedidos-form-container">
            <form id="pedido-form">
                <div class="form-group">
                    <label for="nome_usuario">Seu Nome</label>
                    <input type="text" id="nome_usuario" name="nome_usuario" required>
                </div>
                <div class="form-group">
                    <label for="pedido_filme">Nome do Filme (e ano, se souber)</label>
                    <input type="text" id="pedido_filme" name="pedido_filme" required>
                </div>
                <button type="submit" class="btn-submit" id="pedido-submit-btn">Enviar Pedido</button>
            </form>
            <div id="pedido-feedback" class="feedback-message" style="display: none;"></div>
        </div>

        <section class="pedidos-list-container">
            <h2>Pedidos Recentes</h2>
            <div id="pedidos-list">
                <p>Carregando pedidos...</p>
            </div>
        </section>
    `;

    // 2. Adiciona o "ouvinte" de envio ao formulário
    const pedidoForm = document.getElementById('pedido-form');
    const submitButton = document.getElementById('pedido-submit-btn');
    const feedback = document.getElementById('pedido-feedback');

    pedidoForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o recarregamento da página
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        const formData = new FormData(pedidoForm);
        const nome = formData.get('nome_usuario');
        const pedido = formData.get('pedido_filme');

        // Insere os dados no Supabase
        const { error } = await supabase
            .from('pedidos')
            .insert({ nome_usuario: nome, pedido_filme: pedido });

        if (error) {
            console.error('Erro ao enviar pedido:', error);
            feedback.textContent = 'Erro ao enviar pedido. Tente novamente.';
            feedback.className = 'feedback-message error';
            feedback.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = 'Enviar Pedido';
        } else {
            feedback.textContent = 'Pedido enviado com sucesso!';
            feedback.className = 'feedback-message success';
            feedback.style.display = 'block';
            submitButton.disabled = false;
            pedidoForm.reset();
            // Recarrega a lista de pedidos para mostrar o novo
            fetchAndDisplayRequests(); 
        }
    });

    // 3. Busca e exibe os pedidos existentes
    fetchAndDisplayRequests();
}

/**
 * Busca e "desenha" a lista de pedidos
 */
async function fetchAndDisplayRequests() {
    const listContainer = document.getElementById('pedidos-list');
    if (!listContainer) return;

    // Busca os 25 pedidos mais recentes
    const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);

    if (error) {
        console.error('Erro ao buscar pedidos:', error);
        listContainer.innerHTML = '<p>Não foi possível carregar os pedidos.</p>';
        return;
    }

    if (pedidos.length === 0) {
        listContainer.innerHTML = '<p>Nenhum pedido feito ainda. Seja o primeiro!</p>';
        return;
    }

    // "Desenha" o HTML da lista
    listContainer.innerHTML = ''; // Limpa a mensagem "Carregando..."
    pedidos.forEach(pedido => {
        const pedidoItem = document.createElement('div');
        pedidoItem.className = 'pedido-item';
        
        // Formata a data (ex: 24/10/2025)
        const dataFormatada = new Date(pedido.created_at).toLocaleDateString('pt-BR');
        
        pedidoItem.innerHTML = `
            <div class="pedido-header">
                <span class="pedido-author"><i class="fa-solid fa-user"></i> ${htmlspecialchars(pedido.nome_usuario)}</span>
                <span class="pedido-date">${dataFormatada}</span>
            </div>
            <div class="pedido-body">
                <p>${htmlspecialchars(pedido.pedido_filme)}</p>
            </div>
        `;
        listContainer.appendChild(pedidoItem);
    });
}

/**
 * Busca e desenha a página de um gênero específico, com paginação
 */
async function loadArquivoGeneroContent() {
    const contentPlaceholder = document.getElementById('archive-content-placeholder');
    if (!contentPlaceholder) return;
    contentPlaceholder.innerHTML = `<p style="text-align: center; color: var(--cor-texto-secundario);">Carregando gênero...</p>`;

    // 1. Pega o slug e a página da URL
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    const currentPage = parseInt(params.get('pagina') || '1', 10);
    const filmesPorPagina = 18;
    const offset = (currentPage - 1) * filmesPorPagina;

    if (!slug) {
        contentPlaceholder.innerHTML = `<div class="error-message"><h1>Gênero não encontrado</h1><p>O gênero não foi especificado.</p></div>`;
        return;
    }

    // 2. Busca as informações do gênero (ID e Nome) pelo slug
    const { data: genero, error: generoError } = await supabase
        .from('generos')
        .select('id, nome')
        .eq('slug', slug)
        .single();

    if (generoError || !genero) {
        console.error('Erro ao buscar gênero:', generoError);
        contentPlaceholder.innerHTML = `<div class="error-message"><h1>Gênero não encontrado</h1><p>Este gênero não existe.</p></div>`;
        return;
    }

    // 3. Atualiza o título da aba do navegador
    document.title = `ColmeiaTorrent - Gênero: ${genero.nome}`;

    // 4. Conta o total de filmes nesse gênero para a paginação
    const { count, error: countError } = await supabase
        .from('filme_genero')
        .select('filme_id', { count: 'exact', head: true })
        .eq('genero_id', genero.id);

    if (countError) {
        console.error('Erro ao contar filmes do gênero:', countError);
        contentPlaceholder.innerHTML = `<div class="error-message"><h1>Erro</h1><p>Não foi possível contar os filmes deste gênero.</p></div>`;
        return;
    }

    const totalFilmes = count || 0;
    const totalPaginas = Math.ceil(totalFilmes / filmesPorPagina);

    // 5. Busca os filmes da página atual (usando a tabela de ligação)
    const { data: filmesData, error: filmesError } = await supabase
        .from('filme_genero')
        .select(`
            filmes ( id, titulo, capa_url )
        `)
        .eq('genero_id', genero.id)
        .order('id', { foreignTable: 'filmes', ascending: false }) // Ordena pelos filmes mais recentes
        .range(offset, offset + filmesPorPagina - 1);

    if (filmesError) {
        console.error('Erro ao buscar filmes do gênero:', filmesError);
        contentPlaceholder.innerHTML = `<div class="error-message"><h1>Erro</h1><p>Não foi possível buscar os filmes deste gênero.</p></div>`;
        return;
    }

    // 6. "Desenha" o HTML final
    let html = `<h1 class="page-title">Gênero: ${genero.nome}</h1>`;

    if (filmesData && filmesData.length > 0) {
        // Extrai os dados dos filmes do join (que vêm aninhados)
        const filmes = filmesData.map(item => item.filmes).filter(Boolean);

        html += '<div class="shelf-grid">';
        for (const filme of filmes) {
            html += `
                <a href="single-filme.html?id=${filme.id}" class="movie-card">
                    <img src="${filme.capa_url}" alt="Pôster de ${filme.titulo}">
                    <div class="card-overlay"><h3 class="card-title">${filme.titulo}</h3></div>
                </a>
            `;
        }
        html += '</div>';

        // 7. Desenha a Paginação
        if (totalPaginas > 1) {
            html += '<nav class="pagination"><ul>';
            const baseUrl = `arquivo-genero.html?slug=${slug}`;

            if (currentPage > 1) {
                html += `<li><a href="${baseUrl}&pagina=${currentPage - 1}">&laquo; Anterior</a></li>`;
            }
            for (let i = 1; i <= totalPaginas; i++) {
                html += `<li class="${i === currentPage ? 'active' : ''}"><a href="${baseUrl}&pagina=${i}">${i}</a></li>`;
            }
            if (currentPage < totalPaginas) {
                html += `<li><a href="${baseUrl}&pagina=${currentPage + 1}">Próximo &raquo;</a></li>`;
            }
            html += '</ul></nav>';
        }
    } else {
        html += '<p style="text-align: center; color: var(--cor-texto-secundario);">Nenhum filme encontrado para este gênero ainda.</p>';
    }

    // 8. Injeta o HTML na página
    contentPlaceholder.innerHTML = html;
}

/**
 * Busca filmes no Supabase e desenha a página de resultados
 */
async function loadSearchResultsContent(searchQuery) {
    // 1. Prepara os containers
    const homeContent = document.getElementById('home-content');
    const resultsContainer = document.getElementById('search-results-container');
    if (!homeContent || !resultsContainer) return;

    // Esconde a home, mostra os resultados
    homeContent.style.display = 'none';
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = `<p style="text-align: center; color: var(--cor-texto-secundario);">Buscando por "${searchQuery}"...</p>`;

    // 2. Prepara a busca "inteligente" (Full-Text Search)
    // Converte "vingadores ultimato" em "vingadores & ultimato"
    const searchWords = searchQuery.split(' ').filter(Boolean).join(' & ');

    // 3. Prepara a Paginação
    const params = new URLSearchParams(window.location.search);
    const currentPage = parseInt(params.get('pagina') || '1', 10);
    const filmesPorPagina = 18;
    const offset = (currentPage - 1) * filmesPorPagina;

    // 4. FAZ A CONSULTA AO SUPABASE
    // Primeiro, conta o total de resultados
    const { count, error: countError } = await supabase
        .from('filmes')
        .select('id', { count: 'exact', head: true })
        .textSearch('titulo', searchWords); // A busca inteligente!

    if (countError) {
         console.error('Erro ao contar busca:', countError);
         resultsContainer.innerHTML = `<p>Erro ao buscar resultados.</p>`;
         return;
    }

    const totalFilmes = count || 0;
    const totalPaginas = Math.ceil(totalFilmes / filmesPorPagina);

    // Agora, busca os filmes da página atual
    const { data: filmes, error: filmesError } = await supabase
        .from('filmes')
        .select('id, titulo, capa_url')
        .textSearch('titulo', searchWords)
        .order('data_adicionado', { ascending: false })
        .range(offset, offset + filmesPorPagina - 1);

    if (filmesError) {
        console.error('Erro ao buscar filmes:', filmesError);
        resultsContainer.innerHTML = `<p>Erro ao buscar resultados.</p>`;
        return;
    }

    // 5. "Desenha" o HTML dos Resultados
    let html = '';
    html += `<h1 class="page-title">Resultados da Busca por: "${htmlspecialchars(searchQuery)}"</h1>`;
    html += `<p style="color: var(--cor-texto-secundario); margin-top: -20px; margin-bottom: 30px;">${totalFilmes} filme(s) encontrado(s).</p>`;

    // (Aqui adicionaremos os filtros no futuro)

    if (filmes.length > 0) {
        html += '<div class="shelf-grid">';
        for (const filme of filmes) {
            html += `
                <a href="single-filme.html?id=${filme.id}" class="movie-card">
                    <img src="${filme.capa_url}" alt="Pôster de ${filme.titulo}">
                    <div class="card-overlay"><h3 class="card-title">${filme.titulo}</h3></div>
                </a>
            `;
        }
        html += '</div>';
    } else {
        html += '<p>Nenhum filme encontrado com este termo.</p>';
    }

    // 6. Desenha a Paginação
    if (totalPaginas > 1) {
        html += '<nav class="pagination"><ul>';
        const baseUrl = `index.html?q=${encodeURIComponent(searchQuery)}`;

        // Botão "Anterior"
        if (currentPage > 1) {
            html += `<li><a href="${baseUrl}&pagina=${currentPage - 1}">&laquo; Anterior</a></li>`;
        }
        // Links das páginas
        for (let i = 1; i <= totalPaginas; i++) {
            html += `<li class="${i === currentPage ? 'active' : ''}"><a href="${baseUrl}&pagina=${i}">${i}</a></li>`;
        }
        // Botão "Próximo"
        if (currentPage < totalPaginas) {
            html += `<li><a href="${baseUrl}&pagina=${currentPage + 1}">Próximo &raquo;</a></li>`;
        }
        html += '</ul></nav>';
    }

    // 7. Injeta o HTML final na página
    resultsContainer.innerHTML = html;

    // 8. Atualiza o Título da Aba
    document.title = `Busca: ${searchQuery} - ColmeiaTorrent`;
}

/**
 * Função auxiliar para escapar HTML (segurança)
 */
function htmlspecialchars(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// --- FUNÇÕES DE INICIALIZAÇÃO DE JS ---

function initHeaderJavaScript() {
    // Chama a função para preencher o menu de categorias
    loadCategoriesMenu();

    const searchToggle = document.querySelector('.search-toggle');
    const searchContainer = document.querySelector('.search-container');
    const searchBar = document.querySelector('.search-bar');
    const searchCloseBtn = document.querySelector('.search-close-btn');
    const liveSearchResults = document.getElementById('live-search-results');
    
    if (searchToggle && searchContainer && searchBar && liveSearchResults) {
        const openSearch = () => { searchContainer.classList.add('active'); setTimeout(() => searchBar.focus(), 50); };
        const closeSearch = () => { searchContainer.classList.remove('active'); searchBar.value = ''; liveSearchResults.innerHTML = ''; };
        searchToggle.addEventListener('click', openSearch);
        searchCloseBtn.addEventListener('click', closeSearch);
        document.addEventListener('keydown', (event) => { if (searchContainer.classList.contains('active') && event.key === 'Escape') { closeSearch(); } });

        // --- INÍCIO DA NOVA LÓGICA DE LIVE SEARCH ---
        
        let debounceTimeout; // Variável para o timer do debounce

        searchBar.addEventListener('input', () => {
            // 1. Limpa qualquer timer anterior a cada tecla digitada
            clearTimeout(debounceTimeout);

            const query = searchBar.value.trim();

            // 2. Se a busca estiver vazia ou muito curta, limpa os resultados
            if (query.length < 2) {
                liveSearchResults.innerHTML = '';
                liveSearchResults.style.display = 'none'; // Esconde o container
                return;
            }

            // 3. Inicia um novo timer (300ms)
            // Só vamos fazer a busca quando o usuário parar de digitar
            debounceTimeout = setTimeout(async () => {
                try {
                    // 4. Prepara a busca "inteligente" (ex: "vinga ulti" -> "vinga & ulti")
                    const searchWords = query.split(' ').filter(Boolean).join(' & ');

                    // 5. Faz a consulta ao Supabase (limitada a 5 resultados)
                    const { data: filmes, error } = await supabase
                        .from('filmes')
                        .select('id, titulo, capa_url')
                        .textSearch('titulo', searchWords)
                        .order('data_adicionado', { ascending: false }) // Opcional: ordenar por relevância
                        .limit(5); // Só queremos alguns resultados rápidos

                    if (error) { throw error; } // Joga o erro para o catch

                    // 6. Limpa os resultados antigos e prepara para desenhar os novos
                    liveSearchResults.innerHTML = '';

                    if (filmes.length > 0) {
                        // "Desenha" o HTML dos resultados
                        filmes.forEach(filme => {
                            const item = document.createElement('a');
                            item.href = `single-filme.html?id=${filme.id}`;
                            item.classList.add('live-search-item');

                            const img = document.createElement('img');
                            img.src = filme.capa_url;
                            img.alt = ""; // Decorativo

                            const title = document.createElement('span');
                            title.classList.add('title');
                            title.textContent = filme.titulo; // Mais seguro que innerHTML

                            item.appendChild(img);
                            item.appendChild(title);
                            liveSearchResults.appendChild(item);
                        });
                        liveSearchResults.style.display = 'block'; // Mostra o container
                    } else {
                        // 7. Mostra a mensagem de "Nenhum resultado"
                        liveSearchResults.innerHTML = '<div class="no-results">Nenhum filme encontrado.</div>';
                        liveSearchResults.style.display = 'block'; // Mostra o container
                    }

                } catch (error) {
                    console.error('Erro na busca ao vivo:', error);
                    liveSearchResults.innerHTML = '<div class="no-results">Erro ao buscar.</div>';
                    liveSearchResults.style.display = 'block';
                }
            }, 300); // 300 milissegundos de espera
        });
        // --- FIM DA NOVA LÓGICA DE LIVE SEARCH ---
    }

    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mainNav = document.querySelector('.main-nav');
    if (hamburgerMenu && mainNav) {
        hamburgerMenu.addEventListener('click', () => {
            mainNav.classList.toggle('mobile-active');
            hamburgerMenu.classList.toggle('is-active'); // <-- ADICIONE ESTA LINHA
        });
    }

    // --- CÓDIGO CORRIGIDO/ADICIONADO ABAIXO ---
    // Lógica para abrir o dropdown de Categorias no Mobile
    const dropdownToggle = document.querySelector('.main-nav .dropdown > a');
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', function(event) {
            // Só executa a ação de 'abrir' se estivermos no modo mobile
            if (window.innerWidth <= 992) {
                event.preventDefault(); // Impede o link de navegar para '#'
                this.parentElement.classList.toggle('open'); // Adiciona/remove a classe .open no <li> pai
            }
        });
    }
    // --- FIM DA CORREÇÃO ---
}

// --- LÓGICA DO CABEÇALHO PEGAJOSO (STICKY HEADER) ---
    const body = document.body;
    const header = document.querySelector('.global-header');
    if (header) {
        // Mede a altura exata do cabeçalho uma única vez
        const headerHeight = header.offsetHeight; 

        window.addEventListener('scroll', function() {
            // Se o usuário rolou mais do que a altura do próprio cabeçalho
            if (window.pageYOffset > headerHeight) {
                // Adiciona a classe ao BODY para ativar o modo 'sticky'
                if (!body.classList.contains('header-is-sticky')) {
                    body.style.paddingTop = headerHeight + 'px';
                    body.classList.add('header-is-sticky');
                }
            } else {
                // Remove a classe e o padding quando volta ao topo
                if (body.classList.contains('header-is-sticky')) {
                    body.classList.remove('header-is-sticky');
                    body.style.paddingTop = '0';
                }
            }
        });
    }
    // --- FIM DA LÓGICA PEGAJOSA ---

function initFooterJavaScript() {
    // --- Lógica do Botão "Voltar ao Topo" (Versão Suave) ---
    const backToTopBtn = document.getElementById('back-to-top-btn');
    if (backToTopBtn) {
        // A função de rolagem suave personalizada
        const smoothScrollToTop = () => {
            const targetPosition = 0;
            const startPosition = window.pageYOffset;
            const distance = targetPosition - startPosition;
            const duration = 1000; // 1 segundo para rolar
            let startTime = null;

            const animation = (currentTime) => {
                if (startTime === null) startTime = currentTime;
                const timeElapsed = currentTime - startTime;
                const run = Math.min(timeElapsed / duration, 1);
                const ease = 0.5 * (1 - Math.cos(Math.PI * run));
                window.scrollTo(0, startPosition + distance * ease);
                if (timeElapsed < duration) {
                    requestAnimationFrame(animation);
                }
            };
            requestAnimationFrame(animation);
        };

        // O ouvinte de rolagem para mostrar/esconder o botão
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });

        // O ouvinte de clique que chama a rolagem suave
        backToTopBtn.addEventListener('click', (event) => {
            event.preventDefault();
            smoothScrollToTop();
        });
    }

    // --- Atualiza o Ano do Copyright Automaticamente ---
    const yearSpan = document.getElementById('copyright-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

function initBannerJavaScript() {
    const player = document.getElementById('banner-video-player');
    if (!player) return;
    
    const volumeBtn = document.getElementById('volume-toggle-btn');
    const replayBtn = document.getElementById('replay-btn');
    const bannerImage = document.querySelector('.banner-image');
    let volumeFadeInterval;

    const fadeOutVolume = (onComplete) => {
        clearInterval(volumeFadeInterval);
        if (player.volume === 0) { if (onComplete) onComplete(); return; }
        volumeFadeInterval = setInterval(() => {
            const newVolume = Math.max(0, player.volume - 0.1);
            player.volume = newVolume;
            if (newVolume === 0) { clearInterval(volumeFadeInterval); if (onComplete) onComplete(); }
        }, 50);
    };

    const fadeInVolume = () => {
        clearInterval(volumeFadeInterval);
        if (player.muted || player.volume === 1) return; 
        volumeFadeInterval = setInterval(() => {
            const newVolume = Math.min(1, player.volume + 0.1);
            player.volume = newVolume;
            if (newVolume === 1) { clearInterval(volumeFadeInterval); }
        }, 50);
    };

    player.addEventListener('playing', () => {
        bannerImage.style.opacity = '0';
        volumeBtn.style.display = 'flex';
        replayBtn.style.display = 'none';
    });

    player.addEventListener('ended', () => {
        bannerImage.style.opacity = '1'; 
        volumeBtn.style.display = 'none';
        replayBtn.style.display = 'flex';
    });

    volumeBtn.addEventListener('click', () => {
        if (player.muted) {
            player.muted = false;
            player.volume = 1.0;
            volumeBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        } else {
            player.muted = true;
            volumeBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        }
    });

    replayBtn.addEventListener('click', () => {
        player.currentTime = 0;
        player.play();
    });

    const banner = document.getElementById('hero-banner');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (player) {
                if (entry.isIntersecting) {
                    player.play();
                    fadeInVolume();
                } else {
                    fadeOutVolume(() => {
                        player.pause();
                    });
                }
            }
        });
    }, { threshold: 0.5 });
    observer.observe(banner);
}

/**
 * Função auxiliar para escapar HTML (segurança)
 */
function htmlspecialchars(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}