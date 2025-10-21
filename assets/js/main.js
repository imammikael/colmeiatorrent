// Espera o documento HTML ser completamente carregado para executar o script
document.addEventListener('DOMContentLoaded', function() {

    // --- Lógica da Barra de Pesquisa (com Live Search) ---
    const searchToggle = document.querySelector('.search-toggle');
    const searchContainer = document.querySelector('.search-container');
    const searchForm = document.querySelector('.search-form');
    const searchBar = document.querySelector('.search-bar');
    const searchCloseBtn = document.querySelector('.search-close-btn');
    const liveSearchResults = document.getElementById('live-search-results'); // Novo container

    if (searchToggle && searchContainer && searchBar && liveSearchResults) {
        
        // Funções para abrir e fechar (sem alterações)
        const openSearch = () => {
            searchContainer.classList.add('active');
            setTimeout(() => searchBar.focus(), 50);
        };
        const closeSearch = () => {
            searchContainer.classList.remove('active');
            searchBar.value = ''; // Limpa a busca ao fechar
            liveSearchResults.innerHTML = ''; // Limpa os resultados ao fechar
        };

        searchToggle.addEventListener('click', openSearch);
        searchCloseBtn.addEventListener('click', closeSearch);
        document.addEventListener('keydown', (event) => {
            if (searchContainer.classList.contains('active') && event.key === 'Escape') {
                closeSearch();
            }
        });

        // A MÁGICA DO LIVE SEARCH
        let debounceTimeout;
        searchBar.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            const query = searchBar.value;

            if (query.length < 2) {
                liveSearchResults.innerHTML = '';
                return;
            }

            // Debounce: espera 300ms após o usuário parar de digitar para fazer a busca
            debounceTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`live-search.php?q=${encodeURIComponent(query)}`);
                    const movies = await response.json();

                    liveSearchResults.innerHTML = ''; // Limpa os resultados antigos

                    if (movies.length > 0) {
                        movies.forEach(movie => {
                            const item = document.createElement('a');
                            item.href = `single-filme.php?id=${movie.id}`;
                            item.classList.add('live-search-item');
                            item.innerHTML = `
                                <img src="${movie.capa_url}" alt="">
                                <span class="title">${movie.titulo}</span>
                            `;
                            liveSearchResults.appendChild(item);
                        });
                    } else {
                        liveSearchResults.innerHTML = '<div class="no-results">Nenhum filme encontrado.</div>';
                    }
                } catch (error) {
                    console.error('Erro na busca ao vivo:', error);
                }
            }, 300);
        });
    }

    // --- Lógica do Menu Hambúrguer ---
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mainNav = document.querySelector('.main-nav');
    const dropdownToggle = document.querySelector('.main-nav .dropdown > a');
    if (hamburgerMenu && mainNav) {
        hamburgerMenu.addEventListener('click', function() {
            mainNav.classList.toggle('mobile-active');
        });
    }
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', function(event) {
            if (window.innerWidth <= 992) {
                event.preventDefault();
                this.parentElement.classList.toggle('open');
            }
        });
    }

    // --- Lógica do Olhinho para Ver/Ocultar Senha ---
    const togglePasswordIcons = document.querySelectorAll('.toggle-password');
    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            const passwordInput = this.previousElementSibling;
            const iconElement = this.querySelector('i');
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                iconElement.classList.remove('fa-eye');
                iconElement.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                iconElement.classList.remove('fa-eye-slash');
                iconElement.classList.add('fa-eye');
            }
        });
    });

    // --- Lógica do Botão "Voltar ao Topo" ---
    const backToTopBtn = document.getElementById('back-to-top-btn');

    if (backToTopBtn) {
        // NOVA FUNÇÃO PARA ROLAGEM SUAVE CONTROLADA
        const smoothScrollToTop = () => {
            const targetPosition = 0;
            const startPosition = window.pageYOffset;
            const distance = targetPosition - startPosition;
            const duration = 1000; // Duração da animação em milissegundos (1000ms = 1 segundo)
            let startTime = null;

            const animation = (currentTime) => {
                if (startTime === null) startTime = currentTime;
                const timeElapsed = currentTime - startTime;
                const run = Math.min(timeElapsed / duration, 1); // Garante que não passe de 1
                // Fórmula de "easing" para uma aceleração e desaceleração suave
                const ease = 0.5 * (1 - Math.cos(Math.PI * run));
                
                window.scrollTo(0, startPosition + distance * ease);
                
                if (timeElapsed < duration) {
                    requestAnimationFrame(animation);
                }
            };
            requestAnimationFrame(animation);
        };

        // Mostra ou esconde o botão com base na rolagem (sem alterações aqui)
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });

        // MUDANÇA: O clique agora chama a nossa nova função
        backToTopBtn.addEventListener('click', function(event) {
            event.preventDefault();
            smoothScrollToTop(); // Chama a nova função em vez do scrollTo padrão
        });
    }

});