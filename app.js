/* --- MYTHOS ENGINE V16 (FINAL STABLE) --- */

let identityDB = null;
let scenariosDB = null;
let userMandala = {};
let userRealSituation = "";
let currentScenario = null;
let currentStepIndex = 0;
let storyContext = "";
let drawnCards = [];
let isWaitingForDraw = false;
let currentSaveId = null; // ID unique pour la sauvegarde

// 1. INIT
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(`identity_engine.json?v=${Date.now()}`);
        identityDB = await res.json();
        if (typeof SCENARIO_LIBRARY !== 'undefined') {
            scenariosDB = { mythos_scenarios_library: SCENARIO_LIBRARY };
        } else {
            scenariosDB = { mythos_scenarios_library: [] };
        }
    } catch(e) { console.error("Init Error", e); }
});

// 2. START
function startGame() {
    const name = document.getElementById('user-name').value.trim();
    const dob = document.getElementById('user-dob').value;
    const gender = document.getElementById('user-gender').value;
    const stage = document.getElementById('user-stage').value;
    const situation = document.getElementById('user-situation').value.trim();
    
    currentSaveId = null; // Reset de la sauvegarde pour une nouvelle partie

    if (!name || !dob || !situation) {
        alert("L'Oracle a besoin de toutes vos informations.");
        return;
    }

    if (typeof calculateMandala === "function") {
        userMandala = calculateMandala(name, dob);
    } else {
        userMandala = { keywords: "Ame" };
    }
    userMandala.gender = gender;
    userMandala.lifeStage = stage;
    userRealSituation = situation;

    const setup = document.getElementById('setup-container');
    setup.style.transition = "opacity 1s";
    setup.style.opacity = 0;
    
    setTimeout(() => {
        setup.classList.add('hidden');
        document.getElementById('game-interface').classList.remove('hidden');
        
        // On force l'image neutre au départ
        const heroImg = document.getElementById('hero-img');
        if(heroImg) {
            heroImg.style.display = 'block';
            heroImg.src = "images/neutre.jpg";
        }

        // Texte d'attente
        const stats = document.getElementById('hero-stats-content');
        if(stats) stats.innerHTML = `<div class="hero-summary-box"><h4>Profil Astral</h4><p class="hero-summary-text"><strong>Essence :</strong> Arcane ${userMandala.axes.QUINT.v}<br><em>En attente du destin...</em></p></div>`;
        
        showScenarioMenu();
    }, 1000);
}

// 3. MISE A JOUR IMAGE (ROBUSTE)
function updateHeroPortrait(scenarioIndex) {
    if (!scenarioIndex) return;
    
    // 1. DÉFINITION DE L'ÂGE
    const stageMapping = { 'enfant': 1, 'ado': 2, 'adulte': 3, 'sage': 4, 'spirituel': 5 };
    const currentStage = (userMandala.lifeStage || 'adulte').toLowerCase();
    const pCode = stageMapping[currentStage] || 3;
    
    // 2. DÉFINITION DU GENRE
    let suffix = ""; 
    if (pCode === 5) {
        suffix = ""; // Exception Spirituel
    } else {
        const genre = (userMandala.gender || 'Homme').toLowerCase();
        suffix = genre.startsWith('f') ? "F" : "H";
    }
    
    // 3. CONSTRUCTION DU CHEMIN
    const imgPath = `portraits/${scenarioIndex}-${pCode}${suffix}.png`;
    console.log(`[MYTHOS] Chargement : ${imgPath}`);
    
    // 4. APPLICATION AU DOM
    const img = document.getElementById('hero-img');
    if (img) {
        img.style.display = 'block'; 
        img.onerror = function() {
            console.warn(`Image manquante : ${imgPath}. Repli sur neutre.`);
            this.src = "images/neutre.jpg";
            this.onerror = null; 
        };
        img.src = imgPath;
    }
}

// 4. MENU SCENARIOS
// DANS app.js

function showScenarioMenu() {
    const bar = document.getElementById('action-bar');
    bar.innerHTML = "";
    document.getElementById('active-encounter').innerHTML = `
        <div style="text-align:center; padding-bottom:10px; animation:fadeIn 1s;">
            <h2 style="color:#d4af37; font-size:2em; margin:0; text-shadow:0 2px 5px black;">Le Miroir de l'Âme</h2>
            <p style="color:#ccc; margin-top:5px;">Choisissez le décor de votre quête :</p>
        </div>
    `;
    
    const grid = document.createElement('div');
    grid.className = "scenario-grid";
    
    if (!scenariosDB || !scenariosDB.mythos_scenarios_library) return;
    
    scenariosDB.mythos_scenarios_library.forEach((s, idx) => {
        const card = document.createElement('div');
        card.className = "scenario-card-btn";
        const imgNum = idx + 1;
        
        // --- NOUVEAUTÉ : Calcul du nombre d'étapes ---
        // On compte la longueur du tableau 'steps'. Si pas de steps, on met "?".
        const stepCount = (s.steps && s.steps.length) ? s.steps.length : "?";
        
        card.innerHTML = `
            <div class="card-top-visual">
                <img src="images/${imgNum}.png" onerror="this.src='https://via.placeholder.com/300x150?text=Scenario'">
                <div style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.7); color:#fff; padding:2px 6px; border-radius:4px; font-size:0.8em; border:1px solid #d4af37;">
                    ⏳ ${stepCount} Tours
                </div>
            </div>
            <div class="card-bottom-text">
                <div class="card-title">${s.title}</div>
                <div class="card-desc">
                    <strong style="color:#d4af37;">Durée : ${stepCount} Étapes</strong><br>
                    ${s.intent || "..."}
                </div>
            </div>
        `;
        card.onclick = () => launchScenario(s.id, imgNum);
        grid.appendChild(card);
    });
    bar.appendChild(grid);
}
// 5. LANCEMENT DU SCENARIO
async function launchScenario(id, imgIndex) {
    currentScenario = scenariosDB.mythos_scenarios_library.find(x => x.id === id);
    currentStepIndex = 0; storyContext = ""; drawnCards = [];

    // MISE A JOUR DU PORTRAIT
    updateHeroPortrait(imgIndex);

    document.getElementById('action-bar').innerHTML = "<div style='text-align:center; color:#888; margin-top:20px;'>Le destin s'écrit...</div>";
    document.getElementById('active-encounter').innerHTML = "";
    
    const book = document.getElementById('book-content');
    book.innerHTML = `<img src="images/${imgIndex}.png" class="book-header-img"><p id="loading-txt" style="text-align:center; color:#d4af37;"><em>Connexion à l'Oracle...</em></p>`;
    document.querySelector('.book-title').innerText = currentScenario.title;

    const deepData = (typeof getHeroDeepData === 'function') ? getHeroDeepData(userMandala, userMandala.lifeStage) : "Profil";
    const res = await callAI("GENESIS", null, deepData);
    
    const loader = document.getElementById('loading-txt');
    if(loader) loader.remove();

    let data = safeJSONParse(res);
    if (!data) data = { story_right: res, hero_description: "..." };

    addToBook("Prologue", data.story_right);

    if (data.hero_description) {
        const stats = document.getElementById('hero-stats-content');
        stats.innerHTML = `<div class="hero-summary-box"><h4>L'Âme du Héros</h4><p class="hero-summary-text">${data.hero_description}</p></div>`;
    }

    playStep();
}

// 6. ETAPE SUIVANTE
function playStep() {
    if (currentStepIndex >= currentScenario.steps.length) {
        endGame(); return;
    }
    const step = currentScenario.steps[currentStepIndex];
    
    const zone = document.getElementById('active-encounter');
    zone.innerHTML = `
        <div style="background:rgba(0,0,0,0.8); padding:20px; border:1px solid #5d4037; border-radius:8px; animation:fadeIn 1s;">
            <h3 style="color:#d4af37; margin:0 0 10px 0;">CHAPITRE ${step.step} : ${step.phase}</h3>
            <p style="color:#ddd; font-size:1.1em;">${step.instruction}</p>
        </div>
    `;
    document.getElementById('action-bar').innerHTML = "<div style='text-align:center; color:#d4af37; margin-top:15px; font-style:italic;'>Le destin attend... Maintenez le clic pour tirer une carte.</div>";

    isWaitingForDraw = true;
    spawnCards();
}

// 7. CARTES (DRAG & DROP + LONG PRESS)
function spawnCards() {
    const zone = document.getElementById('deck-scatter-zone');
    zone.innerHTML = "";
    const w = zone.clientWidth; 
    const h = zone.clientHeight;
    
    for(let i=1; i<=22; i++) {
        if (drawnCards.includes(i)) continue;
        
        const c = document.createElement('div');
        c.className = "sidebar-small-card";
        
        c.style.left = Math.floor(Math.random() * (w - 100)) + "px";
        c.style.top = Math.floor(Math.random() * (h - 200)) + "px";
        c.style.transform = `rotate(${Math.floor(Math.random()*60)-30}deg)`;
        
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let pressTimer = null;

        c.onmousedown = (e) => {
            if (!isWaitingForDraw) return;
            e.preventDefault();

            isDragging = false;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = c.offsetLeft;
            initialTop = c.offsetTop;
            
            c.style.zIndex = 1000;
            c.style.cursor = "grabbing";

            // CLIC LONG POUR OUVRIR (600ms)
            pressTimer = setTimeout(() => {
                if (!isDragging) {
                    triggerRevealAnimation(c, i);
                    document.onmousemove = null;
                    document.onmouseup = null;
                }
            }, 600);

            // GESTION DU DÉPLACEMENT
            document.onmousemove = (ev) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;

                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    isDragging = true;
                    clearTimeout(pressTimer); 
                    c.style.left = (initialLeft + dx) + "px";
                    c.style.top = (initialTop + dy) + "px";
                }
            };

            document.onmouseup = () => {
                clearTimeout(pressTimer);
                document.onmousemove = null;
                document.onmouseup = null;
                c.style.zIndex = "auto";
                c.style.cursor = "grab";
            };
        };
        
        zone.appendChild(c);
    }
}

function triggerRevealAnimation(cardElement, cardId) {
    isWaitingForDraw = false; 
    cardElement.style.transition = "all 0.5s ease";
    cardElement.style.transform = "scale(1.3) rotate(0deg)";
    cardElement.style.boxShadow = "0 0 30px #d4af37";
    cardElement.style.zIndex = 2000;

    setTimeout(() => { 
        cardElement.remove(); 
        revealCard(cardId); 
    }, 500);
}

function revealCard(id) {
    drawnCards.push(id);
    const cardData = identityDB ? identityDB.cards.find(x => x.id === id) : { name: "Arcane "+id, id: id };
    
    const zone = document.getElementById('active-encounter');
    const old = zone.innerHTML;
    zone.innerHTML = `<img src="cartes/${id}.jpg">${old}`;

    callAI("OPTIONS", cardData).then(res => {
        const data = safeJSONParse(res);
        showOptions(data || {A:"Avancer", B:"Observer", C:"Ressentir"}, cardData);
    });
}

// 8. OPTIONS ET SAISIE LITTÉRAIRE
function showOptions(opts, cardData) {
    const bar = document.getElementById('action-bar');
    bar.innerHTML = "";
    
    const row = document.createElement('div');
    row.className = "suggestions-row";
    
    ["A","B","C"].forEach(k => {
        if(opts[k]) {
            const b = document.createElement('div');
            b.className = "chip-btn";
            b.innerHTML = `<strong>${k}</strong><span>${opts[k]}</span>`;
            b.onclick = () => resolveTurn(cardData, opts[k]);
            row.appendChild(b);
        }
    });
    bar.appendChild(row);
    
    const inputDiv = document.createElement('div');
    inputDiv.className = "input-row";
    inputDiv.innerHTML = `
        <textarea id="manual-act" class="manual-input" placeholder="Ou écrivez votre destin ici..."></textarea>
        <button id="btn-ok" class="interaction-btn">VALIDER</button>
    `;
    bar.appendChild(inputDiv);
    
    document.getElementById('btn-ok').onclick = () => {
        const val = document.getElementById('manual-act').value;
        if(val) resolveTurn(cardData, val);
    };
    
    document.getElementById('manual-act').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('btn-ok').click();
        }
    });
}

// 9. RÉSOLUTION DU TOUR
async function resolveTurn(cardData, actionTxt) {
    document.getElementById('action-bar').innerHTML = "<div style='text-align:center; color:#888;'>L'Oracle tisse la suite...</div>";
    const res = await callAI("NARRATE", cardData, actionTxt);
    const data = safeJSONParse(res);
    
    if (data) {
        addToBook(`Chapitre ${currentStepIndex+1}`, data.story_right, data.internal_left, cardData.id);
    } else {
        addToBook(`Chapitre ${currentStepIndex+1}`, res, "", cardData.id);
    }
    
    currentStepIndex++;
    saveProgress(true); // AUTO-SAVE
    playStep();
}

// 10. FIN DU JEU
function endGame() {
    saveProgress(true); // SAVE FINALE
    
    const zone = document.getElementById('active-encounter');
    zone.innerHTML = `
        <div style="text-align:center; animation: fadeIn 2s; margin-top:20%;">
            <h1 style="color:#d4af37; font-size:3em; text-shadow:0 0 20px #d4af37; font-family:'Cinzel'">LÉGENDE ACCOMPLIE</h1>
            <p style="color:#fff; font-size:1.2em; font-family:'Lato'">Le destin est scellé.</p>
        </div>
    `;

    const bar = document.getElementById('action-bar');
    bar.innerHTML = `
        <div style="display:flex; justify-content:center; width:100%;">
            <button onclick="location.reload()" class="enter-btn" style="width:auto; padding:15px 40px; font-size:1.2em;">
                NOUVELLE AVENTURE
            </button>
        </div>
    `;

    const overlay = document.getElementById('victory-overlay');
    if (overlay) {
        overlay.style.display = 'block';
        overlay.style.opacity = '1';
        
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 2000); 
        }, 6000);
    }
}

// 11. UTILITAIRES D'AFFICHAGE
function addToBook(title, txt, thought="", cardId = null) {
    const book = document.getElementById('book-content');
    const div = document.createElement('div');
    div.className = "book-chapter-row";
    
    let htmlContent = `<h3>${title}</h3>`;
    if (cardId) {
        htmlContent += `<img src="cartes/${cardId}.jpg" class="book-img-right" alt="Arcane ${cardId}">`;
    }
    htmlContent += `<div class="story-text-content">${txt}</div>`;
    
    div.innerHTML = `<div class="col-story">${htmlContent}</div>`;
    book.appendChild(div);
    
    // Scroll auto au début du chapitre
    setTimeout(() => {
        div.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }, 100); 
    
    if(thought && thought.length > 5) {
        const stream = document.getElementById('hero-thoughts-stream');
        const t = document.createElement('div');
        t.className = "hero-thought-bubble";
        
        let labelReaction = "Réaction";
        if (title.toLowerCase().includes("chapitre")) {
            labelReaction = "Réaction au " + title.split(':')[0];
        } else {
            labelReaction = "Réaction au " + title;
        }

        t.innerHTML = `<div class="thought-label">${labelReaction}</div><div class="thought-content">"${thought}"</div>`;
        stream.prepend(t);
    }
    storyContext += `\n[${title}] ${txt}`;
}

function safeJSONParse(str) {
    try {
        const s = str.substring(str.indexOf('{'), str.lastIndexOf('}')+1);
        return JSON.parse(s);
    } catch(e) { return null; }
}

// DANS app.js

async function callAI(action, card=null, extraContext="") {
    const loader = document.getElementById('oracle-loader');
    if(loader) loader.classList.remove('hidden');
    
    // 1. RÉCUPÉRATION DE L'INSTRUCTION DE L'ÉTAPE EN COURS
    let currentStepInstruction = "";
    if (currentScenario && currentScenario.steps && currentScenario.steps[currentStepIndex]) {
        // On prend l'instruction précise du tableau steps (ex: "Rencontre avec une créature...")
        currentStepInstruction = currentScenario.steps[currentStepIndex].instruction;
    }
    
    const payload = {
        action: action,
        scenarioTitle: currentScenario ? currentScenario.title : "",
        styleInstruction: currentScenario ? currentScenario.prompt_style : "",
        
        // ICI : ON ENVOIE L'INSTRUCTION DU CHAPITRE À L'IA
        stepInstruction: currentStepInstruction, 
        
        heroStage: userMandala.lifeStage,
        heroGender: userMandala.gender,
        userSituation: userRealSituation,
        profileKeywords: extraContext, 
        previousStory: storyContext,
        cardData: card,
        userAction: extraContext 
    };
    
    try {
        const req = await fetch('/.netlify/functions/chat', { method: 'POST', body: JSON.stringify(payload) });
        const json = await req.json();
        if(loader) loader.classList.add('hidden');
        return json.reply;
    } catch(e) {
        if(loader) loader.classList.add('hidden');
        return "L'Oracle est muet.";
    }
}
/* --- MATHS MANDALA --- */
function reduce(n) { if (n <= 22 && n > 0) return n; let s = 0; n.toString().split('').forEach(d => s += parseInt(d)); return s > 22 ? reduce(s) : s; }
function sumDigits(n) { let s = 0; n.toString().split('').forEach(d => s += parseInt(d)); return s; }
function getEnergy(val) { let s = (val === 19) ? 10 : (val <= 9 ? val : sumDigits(val)); return { v: val, s: s, t: (s === 10 ? 1 : (s <= 9 ? s : sumDigits(s))) }; }
function addEnergy(e1, e2) { return { v: reduce(e1.v + e2.v), s: reduce(e1.s + e2.s), t: reduce(e1.t + e2.t) }; }
function addEnergy3(e1, e2, e3) { return { v: reduce(e1.v + e2.v + e3.v), s: reduce(e1.s + e2.s + e3.s), t: reduce(e1.t + e2.t + e3.t) }; }

function calculateMandala(name, dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    const J = getEnergy(reduce(d.getDate()));
    const M = getEnergy(reduce(d.getMonth() + 1));
    const A = getEnergy(reduce(sumDigits(d.getFullYear())));
    const T = addEnergy3(J, M, A);
    const REL = addEnergy(J, A); const INC = addEnergy(M, T); const ETHER = addEnergy(REL, INC); 
    const P_AE = addEnergy(M, J); const P_AF = addEnergy(M, A); const P_ET = addEnergy(J, T); const P_FT = addEnergy(A, T); 
    const AP = addEnergy(P_AE, P_AF); const EP = addEnergy(P_AE, P_ET); const FP = addEnergy(P_AF, P_FT); const TP = addEnergy(P_ET, P_FT); 
    const AH = addEnergy(AP, T); const EH = addEnergy(EP, A); const FH = addEnergy(FP, J); const TH = addEnergy(TP, M); 
    const QUINT_H = addEnergy(addEnergy(AH, TH), addEnergy(EH, FH)); 

    return { 
        user: name, birthdate: dateStr, 
        core: { EAU: J, AIR: M, FEU: A, TERRE: T, ETHER: ETHER }, 
        axes: { REL: REL, INC: INC, QUINT: ETHER },
        pivots: { AE: P_AE, AF: P_AF, ET: P_ET, FT: P_FT },
        pe: { AIR: AP, EAU: EP, FEU: FP, TERRE: TP },
        re: { AIR: AH, EAU: EH, FEU: FH, TERRE: TH },
        sage: { QUINT_NOUV: QUINT_H }
    };
}

function getHeroDeepData(mandala, stage) {
    if (!identityDB) return "Profil Standard";
    
    const getTxt = (cardId, schemaIndex) => {
        const card = identityDB.cards.find(x => x.id === cardId);
        if (!card || !card.personality || !card.personality.schema) return `[Arcane ${cardId}]`;
        const content = card.personality.schema[schemaIndex] || "";
        return `[${card.name}] : ${content}`;
    };
    
    let rawData = `Analyse du Mandala pour ${mandala.user} :\n`;
    const s = stage ? stage.toLowerCase() : "adulte";
    
    if (s.includes('enfant')) {
        rawData += `1. ESSENCE PROFONDE : ${getTxt(mandala.axes.QUINT.v, "1")}\n`;
        rawData += `2. MONDE MENTAL : ${getTxt(mandala.core.AIR.v, "2")}\n`;
        rawData += `3. MONDE ÉMOTIONNEL : ${getTxt(mandala.core.EAU.v, "3")}\n`;
        rawData += `4. ÉNERGIE VITALE : ${getTxt(mandala.core.FEU.v, "4")}\n`;
    } 
    else if (s.includes('ado')) {
        rawData += `1. IDENTITÉ : ${getTxt(mandala.axes.QUINT.v, "6")}\n`;
        rawData += `2. CONFLIT : ${getTxt(mandala.axes.INC.v, "19")}\n`;
        rawData += `3. RELATION : ${getTxt(mandala.axes.REL.v, "8")}\n`;
    }
    else { 
        rawData += `1. MISSION DE VIE : ${getTxt(mandala.axes.QUINT.v, "1")}\n`;
        rawData += `2. DÉFI MAJEUR : ${getTxt(mandala.axes.INC.v, "19")}\n`;
        rawData += `3. ACTION : ${getTxt(mandala.pe.TERRE.v, "9")}\n`;
        rawData += `4. SOCIAL : ${getTxt(mandala.pe.FEU.v, "8")}\n`;
    }
    
    return rawData;
}

/* --- LIGHTBOX (ZOOM IMAGE) --- */
document.addEventListener('click', function(e) {
    const target = e.target;
    if (target.tagName === 'IMG') {
        if (
            target.id === 'hero-img' ||                          
            target.classList.contains('book-img-right') ||   
            target.classList.contains('book-header-img') || 
            target.closest('.card-top-visual') ||                
            target.closest('#active-encounter')                  
        ) {
            openLightbox(target.src);
        }
    }
});

function openLightbox(imgSrc) {
    const box = document.getElementById('mythos-lightbox');
    const img = document.getElementById('lightbox-img');
    if(box && img) {
        img.src = imgSrc;
        box.classList.remove('hidden');
        box.style.display = 'flex';
    }
}

function closeLightbox() {
    const box = document.getElementById('mythos-lightbox');
    if(box) {
        box.classList.add('hidden');
        setTimeout(() => { box.style.display = 'none'; }, 300);
    }
}

/* --- SAUVEGARDE & BIBLIOTHÈQUE --- */
function saveProgress(silent = false) {
    if (!userMandala.user || !currentScenario) return;

    if (!currentSaveId) {
        currentSaveId = "mythos_" + Date.now();
    }

    const saveData = {
        id: currentSaveId,
        date: new Date().toLocaleString(),
        heroName: userMandala.user,
        scenarioTitle: currentScenario.title,
        scenarioId: currentScenario.id,
        heroPortraitIndex: getScenarioImgIndex(currentScenario.id),
        mandala: userMandala,
        situation: userRealSituation,
        stepIndex: currentStepIndex,
        context: storyContext,
        htmlContent: document.getElementById('book-content').innerHTML,
        heroStats: document.getElementById('hero-stats-content').innerHTML,
        thoughts: document.getElementById('hero-thoughts-stream').innerHTML
    };

    let library = JSON.parse(localStorage.getItem("mythos_library") || "[]");
    
    const existingIndex = library.findIndex(s => s.id === currentSaveId);
    if (existingIndex !== -1) {
        library[existingIndex] = saveData;
    } else {
        library.push(saveData);
    }
    
    localStorage.setItem("mythos_library", JSON.stringify(library));
    
    if (!silent) alert("Légende sauvegardée avec succès !");
    else console.log("Auto-save effectuée.");
}

function getScenarioImgIndex(scenId) {
    const idx = scenariosDB.mythos_scenarios_library.findIndex(s => s.id === scenId);
    return idx + 1;
}

function openLibraryModal() {
    const modal = document.getElementById('library-modal');
    const list = document.getElementById('library-list');
    modal.classList.remove('hidden');
    
    const library = JSON.parse(localStorage.getItem("mythos_library") || "[]");
    
    if (library.length === 0) {
        list.innerHTML = "<p style='text-align:center; color:#888; margin-top:20px;'>Aucun parchemin trouvé.</p>";
        return;
    }

    list.innerHTML = "";
    library.reverse().forEach((save) => {
        const div = document.createElement('div');
        div.className = "library-item";
        div.innerHTML = `
            <div>
                <h4>${save.heroName} - ${save.scenarioTitle}</h4>
                <p>${save.date} • Chapitre ${save.stepIndex}</p>
            </div>
            <div class="lib-actions">
                <button class="btn-load" onclick="loadGame('${save.id}')">OUVRIR</button>
                <button class="btn-del" onclick="deleteSave('${save.id}')">X</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function closeLibraryModal() {
    document.getElementById('library-modal').classList.add('hidden');
}

function loadGame(saveId) {
    const library = JSON.parse(localStorage.getItem("mythos_library") || "[]");
    const save = library.find(s => s.id === saveId);
    
    if (!save) return;
    currentSaveId = save.id;

    userMandala = save.mandala;
    userRealSituation = save.situation;
    currentStepIndex = save.stepIndex;
    storyContext = save.context;
    
    currentScenario = scenariosDB.mythos_scenarios_library.find(s => s.id === save.scenarioId);

    document.getElementById('setup-container').classList.add('hidden');
    document.getElementById('game-interface').classList.remove('hidden');
    closeLibraryModal();

    document.getElementById('book-content').innerHTML = save.htmlContent;
    document.getElementById('hero-stats-content').innerHTML = save.heroStats;
    document.getElementById('hero-thoughts-stream').innerHTML = save.thoughts;
    document.querySelector('.book-title').innerText = currentScenario.title;

    if(save.heroPortraitIndex) updateHeroPortrait(save.heroPortraitIndex);
    else updateHeroPortrait(getScenarioImgIndex(currentScenario.id));

    document.getElementById('active-encounter').innerHTML = "";
    document.getElementById('action-bar').innerHTML = "";
    
    if (currentStepIndex >= currentScenario.steps.length) endGame();
    else playStep();
}

function deleteSave(saveId) {
    if(!confirm("Brûler ce parchemin définitivement ?")) return;
    let library = JSON.parse(localStorage.getItem("mythos_library") || "[]");
    library = library.filter(s => s.id !== saveId);
    localStorage.setItem("mythos_library", JSON.stringify(library));
    openLibraryModal(); 
}

    // 5. Imprimer / PDF (VERSION ROBUSTE "ONE SHOT")
    // 5. Imprimer / PDF (VERSION "LIVRE COMPLET" AVEC HÉROS & RÉACTIONS)
    // 5. Imprimer / PDF (VERSION FINALISÉE : HÉROS + RÉACTIONS + NETTOYAGE)
    // DANS app.js - Remplace la fonction printBook() par celle-ci :
    
    // DANS app.js - Remplace la fonction printBook() par celle-ci :
    
    function printBook() {
        if (!currentScenario) { alert("Aucune histoire à imprimer."); return; }
        
        const heroName = userMandala.user || "Le Héros";
        const title = currentScenario.title;
        const headerImgSrc = `images/${getScenarioImgIndex(currentScenario.id)}.png`;
        
        // --- 1. RÉCUPÉRATION DES DONNÉES ---
        const bookSource = document.getElementById('book-content');
        const thoughtsSource = document.getElementById('hero-thoughts-stream');
        const heroStats = document.getElementById('hero-stats-content').innerHTML;
        const heroImgSrc = document.getElementById('hero-img').src;
        
        // --- 2. CONSTRUCTION DU CONTENU PDF ---
        const tempContainer = document.createElement('div');
        
        // A. SECTION HÉROS
        const heroSection = document.createElement('div');
        heroSection.className = 'print-hero-section';
        heroSection.innerHTML = `
    <div class="hero-layout">
        <div class="hero-visual">
            <img src="${heroImgSrc}" class="print-hero-img">
            <div class="hero-caption">${heroName}</div>
        </div>
        <div class="print-hero-stats">${heroStats}</div>
    </div>
    <hr class="hero-separator">
    `;
        tempContainer.appendChild(heroSection);
        
        // B. CHAPITRES
        const chapters = Array.from(bookSource.querySelectorAll('.book-chapter-row'));
        const thoughts = Array.from(thoughtsSource.querySelectorAll('.hero-thought-bubble')); 
        
        chapters.forEach(chapter => {
            const chapterClone = chapter.cloneNode(true);
            const chapterTitle = chapterClone.querySelector('h3').innerText.trim();
            
            tempContainer.appendChild(chapterClone);
            
            const matchKey = chapterTitle.split(':')[0].trim().toLowerCase(); 
            const matchedThought = thoughts.find(t => {
                const label = t.querySelector('.thought-label').innerText.toLowerCase();
                return label.includes(matchKey);
            });
            
            if (matchedThought) {
                const reactionDiv = document.createElement('div');
                reactionDiv.className = 'print-reaction';
                const reactionText = matchedThought.querySelector('.thought-content').innerText;
                const cleanText = reactionText.replace(/^"|"$/g, '');
                reactionDiv.innerHTML = `<strong>Réaction :</strong> <em>"${cleanText}"</em>`;
                tempContainer.appendChild(reactionDiv);
            }
        });
        
        // --- 3. GÉNÉRATION ---
        const printWindow = window.open('', '_blank', 'width=900,height=900');
        
        printWindow.document.write(`
    <html>
    <head>
        <title>Légende de ${heroName}</title>
        <base href="${window.location.origin}${window.location.pathname}">
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Cormorant+Garamond:ital,wght@400;600&family=Lato:wght@400;700&display=swap" rel="stylesheet">
        
        <style>
            body { 
                font-family: 'Cormorant Garamond', serif; 
                padding: 40px; 
                color: #111; 
                background: #fff; 
                max-width: 800px; 
                margin: 0 auto; 
            }
            
            /* HEADER ÉPURÉ (SANS BORDURE) */
            .print-header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px double #8b0000; }
            h1 { font-family: 'Cinzel', serif; color: #8b0000; margin: 10px 0; font-size: 2.5em; }
            h2 { font-family: 'Cinzel', serif; color: #555; font-size: 1.1em; letter-spacing: 2px; text-transform: uppercase; }
            
            .book-header-img-top { 
                width: 100%; 
                height: auto; 
                max-height: 300px; 
                object-fit: contain; 
                border-radius: 4px; 
                /* PLUS DE BORDURE ICI */
            }

            /* SECTION HÉROS */
            .hero-layout { 
                display: flex; gap: 20px; align-items: flex-start; 
                background: #f8f8f8; padding: 20px; 
                border: 1px solid #ddd; border-radius: 8px; 
                margin-bottom: 30px;
            }
            .hero-visual { text-align: center; width: 150px; flex-shrink: 0; }
            .print-hero-img { width: 100%; height: auto; border: 3px double #d4af37; border-radius: 4px; }
            .hero-caption { font-family: 'Cinzel', serif; font-weight: bold; margin-top: 5px; color: #8b0000; font-size: 0.9em; }
            
            .print-hero-stats { flex: 1; font-family: 'Lato', sans-serif; font-size: 10pt; line-height: 1.4; color: #333; text-align: justify; }
            .print-hero-stats h4 { 
                color: #8b0000; margin: 0 0 5px 0; 
                border-bottom: 1px solid #d4af37; 
                padding-bottom: 2px; text-transform: uppercase; font-size: 0.9em;
            }
            .hero-separator { border: 0; border-top: 1px dashed #ccc; margin: 30px 0; }

            /* TEXTE */
            .book-chapter-row { margin-bottom: 15px; padding-top: 10px; break-inside: avoid; }
            h3 { font-family: 'Cinzel', serif; color: #000; margin-top: 0; font-size: 1.4em; text-transform: uppercase; border-left: 4px solid #8b0000; padding-left: 10px; }
            .book-img-right { 
                float: right; width: 120px; margin: 5px 0 15px 20px; 
                border: 1px solid #333; box-shadow: 3px 3px 0 #eee; 
            }
            .story-text-content { font-size: 12pt; line-height: 1.5; text-align: justify; }

            /* RÉACTIONS */
            .print-reaction { 
                background-color: #fffbf0; 
                border-left: 3px solid #d4af37; 
                padding: 10px 15px; 
                margin: 5px 0 30px 0; 
                font-family: 'Lato', sans-serif;
                font-size: 10pt;
                color: #444;
                page-break-inside: avoid;
            }
            .print-reaction strong { color: #d4af37; text-transform: uppercase; font-size: 0.85em; display: block; margin-bottom: 3px; }
        </style>
    </head>
    <body>
        <div class="print-header">
            <img src="${headerImgSrc}" class="book-header-img-top" onerror="this.style.display='none'">
            <h1>${title}</h1>
            <h2>L'Odyssée de ${heroName} • ${new Date().toLocaleDateString()}</h2>
        </div>
        
        <div class="content">
            ${tempContainer.innerHTML}
        </div>

        <script>
            window.onload = function() { 
                setTimeout(function() { 
                    window.print(); 
                    window.close(); 
                }, 800); 
            };
        </script>
    </body>
    </html>
    `);
        
        printWindow.document.close();
    }
function quitGame() {
    if (confirm("Voulez-vous retourner au menu principal ?")) {
        location.reload();
    }
}
    
    /* --- GESTION DU REDIMENSIONNEMENT (DRAG & DROP COLONNES) --- */
    document.addEventListener('DOMContentLoaded', () => {
        initResizers();
    });
    
    function initResizers() {
        const resizerLeft = document.getElementById('resizer-left');
        const resizerRight = document.getElementById('resizer-right');
        const sidebar = document.getElementById('sidebar');
        const bookPanel = document.getElementById('story-book-panel');
        
        if (!resizerLeft || !resizerRight) return;
        
        // --- 1. GESTION GAUCHE (SIDEBAR) ---
        resizerLeft.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.addEventListener('mousemove', resizeSidebar);
            document.addEventListener('mouseup', stopResizeSidebar);
            resizerLeft.classList.add('resizing');
            document.body.style.cursor = 'col-resize'; // Force le curseur partout
        });
        
        function resizeSidebar(e) {
            // La nouvelle largeur = Position X de la souris
            const newWidth = e.clientX;
            // Limites de sécurité (Min 150px, Max 40% de l'écran)
            if (newWidth > 150 && newWidth < window.innerWidth * 0.4) {
                sidebar.style.width = `${newWidth}px`;
            }
        }
        
        function stopResizeSidebar() {
            document.removeEventListener('mousemove', resizeSidebar);
            document.removeEventListener('mouseup', stopResizeSidebar);
            resizerLeft.classList.remove('resizing');
            document.body.style.cursor = 'default';
        }
        
        // --- 2. GESTION DROITE (LIVRE) ---
        resizerRight.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.addEventListener('mousemove', resizeBook);
            document.addEventListener('mouseup', stopResizeBook);
            resizerRight.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
        });
        
        function resizeBook(e) {
            // Largeur = Largeur totale - Position X de la souris
            const newWidth = window.innerWidth - e.clientX;
            // Limites de sécurité (Min 200px, Max 60% de l'écran)
            if (newWidth > 200 && newWidth < window.innerWidth * 0.6) {
                bookPanel.style.width = `${newWidth}px`;
            }
        }
        
        function stopResizeBook() {
            document.removeEventListener('mousemove', resizeBook);
            document.removeEventListener('mouseup', stopResizeBook);
            resizerRight.classList.remove('resizing');
            document.body.style.cursor = 'default';
        }
    }
