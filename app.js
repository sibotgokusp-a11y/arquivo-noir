// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://xjjhrsazuzexzkbqrpkj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ejXl0bF0P9ivWe6HhFIW2A_RR09ISke';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let catalogData = [];
let currentMangaId = null;

// =========================================
// BANCO DE DADOS (SUPABASE)
// =========================================

// Busca os mangás do banco ao carregar a página
async function fetchCatalog() {
    const { data, error } = await supabase
        .from('mangas_db') // Precisaremos criar essa tabela, ou o código criará dinamicamente se configurado
        .select('*');
    
    if (error) {
        console.error("Erro ao carregar catálogo:", error);
        return;
    }

    // Organiza os dados por categoria para o layout do site
    const organized = {};
    data.forEach(item => {
        if (!organized[item.category]) organized[item.category] = [];
        organized[item.category].push(item);
    });

    catalogData = Object.keys(organized).map(cat => ({
        category: cat,
        items: organized[cat]
    }));

    renderCatalog();
}

// =========================================
// UPLOAD DE IMAGENS (STORAGE)
// =========================================
async function processUpload() {
    const title = document.getElementById('up-title').value.trim() || 'Dossiê Desconhecido';
    const category = document.getElementById('up-category').value.trim() || 'Acervo Geral';
    const files = document.getElementById('up-files').files;

    if (files.length === 0) { alert('Selecione imagens!'); return; }

    const statusMsg = document.getElementById('up-count');
    statusMsg.innerText = "Enviando para a nuvem... aguarde.";

    const folderName = `manga_${Date.now()}`;
    const pageUrls = [];

    // Faz o upload de cada imagem para o Storage do Supabase
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = `${folderName}/page_${i}.${file.name.split('.').pop()}`;
        
        const { data, error } = await supabase.storage
            .from('mangas')
            .upload(filePath, file);

        if (error) {
            console.error("Erro no upload:", error);
            continue;
        }

        // Pega a URL pública da imagem
        const { data: urlData } = supabase.storage
            .from('mangas')
            .getPublicUrl(filePath);
            
        pageUrls.push(urlData.publicUrl);
    }

    // Salva as informações no Banco de Dados (Tabela)
    const { error: dbError } = await supabase
        .from('mangas_db')
        .insert([{
            title: title,
            category: category,
            img: pageUrls[0], // Primeira imagem é a capa
            pages: pageUrls,
            desc: 'Arquivo salvo na nuvem.'
        }]);

    if (dbError) {
        alert("Erro ao salvar no banco de dados.");
    } else {
        alert("Dossiê sincronizado com sucesso!");
        location.reload(); // Recarrega para mostrar o novo item
    }
}

// =========================================
// RENDERIZAÇÃO E PROGRESSO
// =========================================
function getProgress(id) { return parseInt(localStorage.getItem('prog_' + id)) || 0; }
function saveProgress(id, index) { localStorage.setItem('prog_' + id, index); renderCatalog(); }

function renderCatalog() {
    const container = document.getElementById('catalog-content');
    container.innerHTML = '';
    
    // Atualiza o Autocomplete das categorias no Modal de Upload
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
// MODAIS E UPLOAD (SISTEMA DE CATEGORIAS)
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
    // Fecha se clicar fora do modal ou no botão com o X
    if (e.target.id === modalId || e.target.closest('button')) {
        document.getElementById(modalId).classList.remove('active');
    }
}

function openUploadModal() { 
    document.getElementById('uploadModal').classList.add('active'); 
}

document.getElementById('up-files').addEventListener('change', function(e) {
    const count = e.target.files.length;
    document.getElementById('up-count').innerText = count > 0 ? `${count} arquivos selecionados.` : '';
});

function processUpload() {
    // 1. Verifica os campos de texto
    const titleEl = document.getElementById('up-title');
    const categoryEl = document.getElementById('up-category');
    
    if (!titleEl) { alert("ERRO: Campo de título não encontrado no HTML!"); return; }
    
    const title = titleEl.value.trim() || 'Dossiê Desconhecido';
    const finalCategory = (categoryEl && categoryEl.value.trim()) ? categoryEl.value.trim() : 'Acervo Geral';
    
    // 2. Verifica os arquivos
    const filesEl = document.getElementById('up-files');
    if (!filesEl || filesEl.files.length === 0) { 
        alert('Selecione uma pasta com imagens primeiro!'); 
        return; 
    }

    const files = filesEl.files;
    
    // 3. Filtra para pegar SOMENTE imagens
    const imageFiles = Array.from(files)
        .filter(file => file.type.startsWith('image/'))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (imageFiles.length === 0) { 
        alert(`Nenhuma imagem detectada! Você selecionou ${files.length} arquivos, mas nenhum é formato de imagem (JPG, PNG).`); 
        return; 
    }

    // 4. Cria o mangá
    const pagesUrls = imageFiles.map(file => URL.createObjectURL(file));

    const newItem = {
        id: 'm_' + Date.now(), 
        title: title, 
        img: pagesUrls[0],
        meta: `${pagesUrls.length} Páginas`, 
        desc: 'Arquivo importado localmente.', 
        pages: pagesUrls
    };

    let categoryRow = catalogData.find(row => row.category.toLowerCase() === finalCategory.toLowerCase());
    
    if (categoryRow) {
        categoryRow.items.unshift(newItem);
    } else {
        catalogData.unshift({ category: finalCategory, items: [newItem] });
    }

    // 5. Salva e Limpa a tela
    renderCatalog();
    
    titleEl.value = '';
    if(categoryEl) categoryEl.value = '';
    filesEl.value = '';
    document.getElementById('up-count').innerText = '';
    document.getElementById('uploadModal').classList.remove('active');
    
    alert("Dossiê registrado com sucesso!");
}

// =========================================
// LEITOR PREMIUM (READER)
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

// =========================================
// EVENTOS E CONFIGURAÇÕES
// =========================================
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
// CARROSSEL DO HERO BANNER (NETFLIX STYLE)
// =========================================
let heroInterval;
let currentHeroIndex = 0;

function startHeroCarousel() {
    // Pega todos os itens do catálogo e junta num array só (adicionando o nome da categoria a eles)
    const allItems = catalogData.flatMap(row => row.items.map(item => ({ ...item, categoryName: row.category })));
    
    // Se não tiver mangá, não faz nada
    if (allItems.length === 0) return;

    // Pega os 5 primeiros mangás (ou os mais recentes) para girar no banner
    const heroItems = allItems.slice(0, 5);

    const updateHero = () => {
        const item = heroItems[currentHeroIndex];
        
        const imgContainer = document.getElementById('hero-img-container');
        const contentContainer = document.getElementById('hero-content');
        const bgImg = document.getElementById('hero-bg');

        // 1. Apaga tudo suavemente (Fade out)
        imgContainer.classList.remove('opacity-100');
        imgContainer.classList.add('opacity-0');
        contentContainer.classList.remove('opacity-100');
        contentContainer.classList.add('opacity-0');

        // 2. Espera ficar escuro, troca os dados e acende de novo
        setTimeout(() => {
            bgImg.src = item.img;
            document.getElementById('hero-title').innerText = item.title;
            document.getElementById('hero-desc').innerText = item.desc || 'Sem descrição disponível nos arquivos.';
            document.getElementById('hero-tag').innerText = item.categoryName;

            // Conecta os botões ao mangá atual
            document.getElementById('hero-btn-details').onclick = () => openModal(item.id);
            document.getElementById('hero-btn-read').onclick = () => {
                currentMangaId = item.id;
                openReader();
            };

            // Reinicia a animação de zoom lento da imagem
            bgImg.classList.remove('scale-110');
            void bgImg.offsetWidth; // Força o navegador a reiniciar a animação
            bgImg.classList.add('scale-110');

            // Fade In (Acende)
            imgContainer.classList.remove('opacity-0');
            imgContainer.classList.add('opacity-100');
            contentContainer.classList.remove('opacity-0');
            contentContainer.classList.add('opacity-100');

            // Prepara o próximo mangá para daqui a pouco
            currentHeroIndex = (currentHeroIndex + 1) % heroItems.length;
        }, 700); // 700ms é o tempo do fade out
    };

    // Roda a primeira vez na hora
    updateHero();

    // Limpa o timer antigo (se existir) e cria um novo a cada 8 segundos
    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(updateHero, 8000);
}

// Inicialização
renderCatalog();
if (localStorage.getItem('arquivo_theme')) {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('arquivo_theme'));
}