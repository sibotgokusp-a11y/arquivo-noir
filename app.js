// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://xjjhrsazuzexzkbqrpkj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ejXl0bF0P9ivWe6HhFIW2A_RR09ISke';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let catalogData = [];
let currentMangaId = null;

// 1. BUSCAR DADOS NA NUVEM
async function fetchCatalog() {
    const { data, error } = await supabaseClient
        .from('mangas_db')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Erro ao carregar catálogo:", error);
        return;
    }

    // Agrupar por categoria
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

// 2. RENDERIZAR O CATÁLOGO NA TELA
function renderCatalog() {
    const container = document.getElementById('catalog-content');
    if (!container) return;
    container.innerHTML = '';

    catalogData.forEach(section => {
        let html = `
            <div class="mb-12">
                <h2 class="px-6 md:px-0 text-2xl font-bold mb-6 flex items-center gap-2">
                    <span class="w-2 h-8 bg-accent rounded-full"></span>
                    ${section.category}
                </h2>
                <div class="flex overflow-x-auto gap-4 px-6 md:px-0 pb-4 no-scrollbar">
        `;

        section.items.forEach(item => {
            html += `
                <div class="manga-card flex-none w-40 md:w-48 cursor-pointer group" onclick="openModal('${item.id}')">
                    <div class="relative aspect-[3/4] rounded-lg overflow-hidden border border-white/10 shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:border-accent/50">
                        <img src="${item.img}" class="w-full h-full object-cover" alt="${item.title}">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                             <button class="btn btn-primary w-full py-2 text-sm">Ver Detalhes</button>
                        </div>
                    </div>
                    <h3 class="mt-3 font-medium text-sm md:text-base line-clamp-1 group-hover:text-accent transition-colors">${item.title}</h3>
                </div>
            `;
        });

        html += `</div></div>`;
        container.innerHTML += html;
    });

    startHeroCarousel();
}

// 3. UPLOAD PARA O SUPABASE (IMAGENS + TEXTO)
async function processUpload() {
    const title = document.getElementById('up-title').value.trim() || 'Dossiê Desconhecido';
    const category = document.getElementById('up-category').value.trim() || 'Acervo Geral';
    const files = document.getElementById('up-files').files;

    if (files.length === 0) { alert('Selecione imagens!'); return; }

    const statusMsg = document.getElementById('up-count');
    statusMsg.innerText = "Sincronizando com o Arquivo Central...";

    const folderName = `manga_${Date.now()}`;
    const pageUrls = [];

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = `page_${i}.${file.name.split('.').pop()}`;
            const filePath = `${folderName}/${fileName}`;
            
            const { data, error } = await supabaseClient.storage
                .from('mangas')
                .upload(filePath, file);

            if (error) throw error;

            const { data: urlData } = supabaseClient.storage
                .from('mangas')
                .getPublicUrl(filePath);
                
            pageUrls.push(urlData.publicUrl);
        }

        const { error: dbError } = await supabaseClient
            .from('mangas_db')
            .insert([{
                title: title,
                category: category,
                img: pageUrls[0],
                pages: pageUrls,
                description: 'Dossiê carregado via terminal seguro.'
            }]);

        if (dbError) throw dbError;

        alert("Dossiê registrado com sucesso na nuvem!");
        location.reload();
    } catch (err) {
        console.error(err);
        alert("Erro na operação: " + err.message);
    }
}

// 4. CARROSSEL DINÂMICO
let heroInterval;
function startHeroCarousel() {
    const allItems = catalogData.flatMap(row => row.items.map(item => ({ ...item, categoryName: row.category })));
    if (allItems.length === 0) return;
    const heroItems = allItems.slice(0, 5);
    let currentHeroIndex = 0;

    const updateHero = () => {
        const item = heroItems[currentHeroIndex];
        const bgImg = document.getElementById('hero-bg');
        if(!bgImg) return;

        document.getElementById('hero-img-container').style.opacity = '0';
        document.getElementById('hero-content').style.opacity = '0';

        setTimeout(() => {
            bgImg.src = item.img;
            document.getElementById('hero-title').innerText = item.title;
            document.getElementById('hero-tag').innerText = item.categoryName;
            
            document.getElementById('hero-img-container').style.opacity = '1';
            document.getElementById('hero-content').style.opacity = '1';
            currentHeroIndex = (currentHeroIndex + 1) % heroItems.length;
        }, 700);
    };

    if (heroInterval) clearInterval(heroInterval);
    updateHero();
    heroInterval = setInterval(updateHero, 8000);
}

// INICIALIZAÇÃO
window.onload = fetchCatalog;