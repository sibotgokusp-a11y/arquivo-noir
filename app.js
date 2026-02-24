// =========================================
// 1. CONFIGURAÇÃO SUPABASE (NUVEM)
// =========================================
const SUPABASE_URL = 'https://xjjhrsazuzexzkbqrpkj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ejXl0bF0P9ivWe6HhFIW2A_RR09ISke';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let catalogData = [];
let currentMangaId = null;

// =========================================
// SISTEMA DE AUTENTICAÇÃO E LOGIN
// =========================================

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    handleAuthState(session?.user);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        handleAuthState(session?.user);
    });
}

function handleAuthState(user) {
    currentUser = user;
    const loginScreen = document.getElementById('loginModal');
    const appNav = document.getElementById('main-nav');
    const btnUpload = document.getElementById('btn-novo-dossie');
    const btnLogin = document.getElementById('btn-login');

    if (user) {
        // Usuário logado: libera o acesso e carrega os dados
        loginScreen.classList.add('hidden');
        appNav.style.display = 'flex';
        if(btnUpload) btnUpload.classList.remove('hidden');
        if(btnLogin) btnLogin.innerText = 'Sair';
        
        // Busca os dados APENAS se estiver logado
        fetchCatalog();
    } else {
        // Visitante/Logout: bloqueia tudo
        loginScreen.classList.remove('hidden');
        appNav.style.display = 'none';
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        
        // Limpa os dados do DOM por segurança
        document.getElementById('catalog-content').innerHTML = '';
        catalogData = [];
    }
}

async function processLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    const btn = document.getElementById('btn-submit-login');

    if (!email || !pass) { 
        alert("Preencha as credenciais completas."); 
        return; 
    }

    const originalText = btn.innerText;
    btn.innerText = "Verificando...";
    btn.disabled = true;

    // Login simples. A criação de conta foi removida do frontend.
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });

    btn.innerText = originalText;
    btn.disabled = false;

    if (error) {
        alert("Acesso negado: Credenciais inválidas ou sem permissão.");
    } else {
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        // O handleAuthState será chamado automaticamente pelo onAuthStateChange
    }
}

function openLoginModal() {
    if (currentUser) {
        const confirmar = confirm("Deseja trancar os arquivos e sair do sistema?");
        if (confirmar) {
            supabaseClient.auth.signOut();
        }
    }
}

// Inicia a verificação de sessão (O checkSession cuida de mostrar o login ou o catálogo)
checkSession();

// =========================================
// 2. BUSCAR DADOS DA NUVEM (NOVO CÉREBRO)
// =========================================
async function fetchCatalog() {
    const { data, error } = await supabaseClient
        .from('mangas_db')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao buscar dados na nuvem:", error);
        return;
    }

    // Organiza os dados que vieram do banco para o formato que o seu visual espera
    const organized = {};
    data.forEach(item => {
        const cat = item.category || 'Acervo Geral';
        if (!organized[cat]) organized[cat] = [];
        organized[cat].push({
            id: item.id,
            title: item.title,
            img: item.img,
            meta: `${item.pages ? item.pages.length : 0} Páginas`,
            desc: item.description || item.desc || 'Arquivo armazenado no servidor central.',
            pages: item.pages || []
        });
    });

    catalogData = Object.keys(organized).map(cat => ({
        category: cat,
        items: organized[cat]
    }));

    renderCatalog();
}

// =========================================
// 3. RENDERIZAÇÃO E PROGRESSO (SEU CÓDIGO)
// =========================================
function getProgress(id) { return parseInt(localStorage.getItem('prog_' + id)) || 0; }
function saveProgress(id, index) { localStorage.setItem('prog_' + id, index); renderCatalog(); }

function renderCatalog() {
    const container = document.getElementById('catalog-content');
    container.innerHTML = '';
    
    const datalist = document.getElementById('existing-categories');
    if(datalist) datalist.innerHTML = '';
    
    catalogData.forEach(row => {
        if(datalist) datalist.innerHTML += `<option value="${row.category}">`;

        let html = `<div class="mb-10"><h2 class="font-title text-2xl mb-4 px-6">${row.category}</h2><div class="flex gap-4 overflow-x-auto px-6 py-4 no-scrollbar scroll-smooth">`;
        
        row.items.forEach(item => {
            const progIndex = getProgress(item.id);
            const totalPages = item.pages ? item.pages.length : 0;
            const percent = totalPages > 0 ? ((progIndex + 1) / totalPages) * 100 : 0;
            
            html += `
                <div class="flex-none w-36 md:w-48 aspect-[2/3] relative rounded-md cursor-pointer transition-all duration-500 hover:scale-105 hover:-translate-y-2 hover:z-20 bg-surface border border-white/5 hover:border-accent shadow-xl hover:shadow-2xl hover:shadow-accent/20 overflow-hidden group" onclick="openModal('${item.id}')">
                    
                    <img src="${item.img}" alt="${item.title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100">
                    
                    <div class="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 z-20">
                        ${totalPages} PÁG
                    </div>

                    <div class="absolute bottom-0 left-0 h-1 bg-accent z-20 transition-all duration-300 group-hover:h-1.5" style="width: ${percent}%"></div>
                    
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-10">
                        <span class="font-title font-bold text-white text-sm md:text-lg leading-tight transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300 drop-shadow-md">
                            ${item.title}
                        </span>
                        <span class="text-accent text-xs font-semibold uppercase tracking-wider mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                            ${item.meta || 'Evidência'}
                        </span>
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
        container.innerHTML += html;
        startHeroCarousel();
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    document.getElementById('main-nav').style.display = viewName === 'reader' ? 'none' : 'flex';
    window.scrollTo(0,0);
}

// =========================================
// 4. MODAIS E UPLOAD (CONECTADO À NUVEM)
// =========================================
function openModal(id) {
    const manga = catalogData.flatMap(row => row.items).find(m => m.id === id); 
    if(!manga) return;
    
    currentMangaId = id;
    document.getElementById('modalImg').src = manga.img;
    document.getElementById('modalTitle').innerText = manga.title;
    document.getElementById('modalMeta').innerText = manga.meta || `${manga.pages.length} Páginas`;
    document.getElementById('modalDesc').innerText = manga.desc;
    document.getElementById('itemModal').classList.add('active');
}

function closeModal(e, modalId) {
    if (e.target.id === modalId || e.target.closest('button')) {
        document.getElementById(modalId).classList.remove('active');
    }
}

function openUploadModal() { 
    document.getElementById('uploadModal').classList.add('active'); 
}

// Atualiza o contador de arquivos selecionados
const upFilesEl = document.getElementById('up-files');
if(upFilesEl) {
    upFilesEl.addEventListener('change', function(e) {
        const count = e.target.files.length;
        document.getElementById('up-count').innerText = count > 0 ? `${count} arquivos selecionados.` : '';
    });
}

// O NOVO PROCESSO DE UPLOAD
async function processUpload() {
    const titleEl = document.getElementById('up-title');
    const categoryEl = document.getElementById('up-category');
    const filesEl = document.getElementById('up-files');
    const statusMsg = document.getElementById('up-count');
    
    const title = titleEl.value.trim() || 'Dossiê Desconhecido';
    const finalCategory = (categoryEl && categoryEl.value.trim()) ? categoryEl.value.trim() : 'Acervo Geral';
    
    if (!filesEl || filesEl.files.length === 0) { 
        alert('Selecione uma pasta com imagens primeiro!'); 
        return; 
    }

    const imageFiles = Array.from(filesEl.files)
        .filter(file => file.type.startsWith('image/'))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (imageFiles.length === 0) { 
        alert(`Nenhuma imagem detectada!`); 
        return; 
    }

    // Muda a mensagem para mostrar que está enviando para a nuvem
    if(statusMsg) statusMsg.innerText = "Sincronizando com os servidores... (Isso pode demorar dependendo das imagens)";

    const folderName = `manga_${Date.now()}`;
    const pageUrls = [];

    try {
        // 1. Sobe as imagens para o Storage
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            const fileName = `page_${i}.${file.name.split('.').pop()}`;
            const filePath = `${folderName}/${fileName}`;
            
            const { error } = await supabaseClient.storage.from('mangas').upload(filePath, file);
            if (error) throw error;

            const { data: urlData } = supabaseClient.storage.from('mangas').getPublicUrl(filePath);
            pageUrls.push(urlData.publicUrl);
        }

        // 2. Salva os dados no Banco de Dados
        const { error: dbError } = await supabaseClient.from('mangas_db').insert([{
            title: title,
            category: finalCategory,
            img: pageUrls[0],
            pages: pageUrls,
            description: 'Arquivo importado para a nuvem.'
        }]);

        if (dbError) throw dbError;

        // 3. Limpa a tela e recarrega
        titleEl.value = '';
        if(categoryEl) categoryEl.value = '';
        filesEl.value = '';
        if(statusMsg) statusMsg.innerText = '';
        document.getElementById('uploadModal').classList.remove('active');
        
        alert("Dossiê registrado com sucesso na NUVEM!");
        fetchCatalog(); // Busca os dados novos sem precisar de F5

    } catch (err) {
        console.error(err);
        alert("Erro no upload para a nuvem: " + err.message);
        if(statusMsg) statusMsg.innerText = "Falha na sincronização.";
    }
}

// =========================================
// 5. LEITOR PREMIUM (SEU CÓDIGO)
// =========================================
const readerState = {
    pages: [], currentIndex: 0,
    fitMode: localStorage.getItem('pref_fit') || 'contain',
    isSpread: localStorage.getItem('pref_spread') === 'true',
    toolbarVisible: true
};

const canvas = document.getElementById('reader-canvas');
const img1 = document.getElementById('reader-img-1');
const img2 = document.getElementById('reader-img-2');
const selector = document.getElementById('page-selector');

function openReader() {
    document.getElementById('itemModal').classList.remove('active');
    const manga = catalogData.flatMap(row => row.items).find(m => m.id === currentMangaId);
    
    readerState.pages = manga.pages;
    readerState.currentIndex = getProgress(currentMangaId);
    
    document.getElementById('reader-title').innerText = manga.title;
    document.getElementById('total-pages-label').innerText = manga.pages.length;
    
    selector.innerHTML = '';
    manga.pages.forEach((_, i) => selector.innerHTML += `<option value="${i}">Pág. ${i + 1}</option>`);

    setFitMode(readerState.fitMode, false);
    updateSpreadUI();
    updateReaderView();
    switchView('reader');
}

function closeReader() {
    if (document.fullscreenElement) document.exitFullscreen();
    switchView('catalog');
}

function updateReaderView() {
    const idx = readerState.currentIndex;
    preloadImage(idx + 1);
    if(readerState.isSpread) preloadImage(idx + 2);
    
    selector.value = idx;
    img1.src = readerState.pages[idx];
    
    if (readerState.isSpread && idx + 1 < readerState.pages.length) {
        img2.src = readerState.pages[idx + 1];
        img2.classList.remove('hidden');
    } else {
        img2.classList.add('hidden');
    }
    saveProgress(currentMangaId, idx);
}

function preloadImage(i) {
    if (i >= 0 && i < readerState.pages.length) { const p = new Image(); p.src = readerState.pages[i]; }
}

function nextPage() {
    const step = readerState.isSpread ? 2 : 1;
    if (readerState.currentIndex + step < readerState.pages.length) {
        readerState.currentIndex += step;
        updateReaderView();
    }
}

function prevPage() {
    const step = readerState.isSpread ? 2 : 1;
    readerState.currentIndex = Math.max(0, readerState.currentIndex - step);
    updateReaderView();
}

function goToPage(index) {
    readerState.currentIndex = readerState.isSpread && index % 2 !== 0 ? index - 1 : index;
    updateReaderView();
}

function toggleToolbar() {
    readerState.toolbarVisible = !readerState.toolbarVisible;
    document.getElementById('reader-toolbar').classList.toggle('hidden', !readerState.toolbarVisible);
}

function setFitMode(mode, save = true) {
    readerState.fitMode = mode;
    canvas.className = `reader-canvas fit-${mode} w-full h-full flex justify-center items-center bg-black transition-opacity duration-300`;
    document.querySelectorAll('[id^="btn-fit-"]').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-fit-${mode}`).classList.add('active');
    if(save) localStorage.setItem('pref_fit', mode);
}

function toggleSpreadMode() {
    readerState.isSpread = !readerState.isSpread;
    localStorage.setItem('pref_spread', readerState.isSpread);
    if (readerState.isSpread && readerState.currentIndex % 2 !== 0) readerState.currentIndex--;
    updateSpreadUI();
    updateReaderView();
}

function updateSpreadUI() {
    document.getElementById('btn-spread').classList.toggle('active', readerState.isSpread);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
}

function toggleSettings() { 
    document.getElementById('settingsPanel').classList.toggle('active'); 
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('arquivo_theme', theme);
    toggleSettings();
}

document.addEventListener('fullscreenchange', () => {
    document.getElementById('btn-fullscreen').classList.toggle('active', !!document.fullscreenElement);
    if (document.fullscreenElement && readerState.toolbarVisible) toggleToolbar();
});

document.addEventListener('keydown', (e) => {
    if (document.getElementById('view-reader').classList.contains('active')) {
        if (e.key === 'ArrowLeft') nextPage();
        if (e.key === 'ArrowRight') prevPage();
        if (e.key === 'Escape') closeReader();
    }
});

// =========================================
// 6. CARROSSEL DO HERO BANNER (SEU CÓDIGO)
// =========================================
let heroInterval;
let currentHeroIndex = 0;

function startHeroCarousel() {
    const allItems = catalogData.flatMap(row => row.items.map(item => ({ ...item, categoryName: row.category })));
    if (allItems.length === 0) return;

    const heroItems = allItems.slice(0, 5);

    const updateHero = () => {
        const item = heroItems[currentHeroIndex];
        const imgContainer = document.getElementById('hero-img-container');
        const contentContainer = document.getElementById('hero-content');
        const bgImg = document.getElementById('hero-bg');

        imgContainer.classList.remove('opacity-100');
        imgContainer.classList.add('opacity-0');
        contentContainer.classList.remove('opacity-100');
        contentContainer.classList.add('opacity-0');

        setTimeout(() => {
            bgImg.src = item.img;
            document.getElementById('hero-title').innerText = item.title;
            document.getElementById('hero-desc').innerText = item.desc || 'Sem descrição disponível nos arquivos.';
            document.getElementById('hero-tag').innerText = item.categoryName;

            document.getElementById('hero-btn-details').onclick = () => openModal(item.id);
            document.getElementById('hero-btn-read').onclick = () => {
                currentMangaId = item.id;
                openReader();
            };

            bgImg.classList.remove('scale-110');
            void bgImg.offsetWidth; 
            bgImg.classList.add('scale-110');

            imgContainer.classList.remove('opacity-0');
            imgContainer.classList.add('opacity-100');
            contentContainer.classList.remove('opacity-0');
            contentContainer.classList.add('opacity-100');

            currentHeroIndex = (currentHeroIndex + 1) % heroItems.length;
        }, 700);
    };

    updateHero();

    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(updateHero, 8000);
}

// =========================================
// INICIALIZAÇÃO
// =========================================
if (localStorage.getItem('arquivo_theme')) {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('arquivo_theme'));
}