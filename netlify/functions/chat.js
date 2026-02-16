const { GoogleGenerativeAI } = require("@google/generative-ai");

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        // --- 1. SÉCURITÉ : ON RÉCUPÈRE LA CLÉ CHEZ NETLIFY ---
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Clé API introuvable dans les variables d'environnement.");

        const genAI = new GoogleGenerativeAI(apiKey);
        
        // --- 2. LE MODÈLE QUE TU VEUX (2.5) ---
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", // On garde ta version 2.5
            generationConfig: { temperature: 1.0, responseMimeType: "application/json" } 
        });

        const body = JSON.parse(event.body || '{}');
        
        // --- RÈGLES D'ÂGE ET DE SEXE ---
        const stage = body.heroStage ? body.heroStage.toLowerCase() : "adulte";
        let ageRule = "";
        if (stage.includes("enfant")) {
            ageRule = `RÈGLE ÂGE (ENFANT 8-10 ANS) : Vocabulaire simple et magique. Pas de concepts adultes.`;
        } else if (stage.includes("ado")) {
            ageRule = `RÈGLE ÂGE (ADO) : Ton rebelle, intense, émotionnel, quête d'identité.`;
        }

        const gender = body.heroGender ? body.heroGender.toUpperCase() : "NEUTRE";
        let genderRule = `SEXE DU HÉROS : ${gender}.`;
        if (gender === "FEMME") {
            genderRule += ` IMPÉRATIF : LE PROTAGONISTE EST UNE FEMME. Utilise "ELLE", "LA", "CETTE". Accorde tout au féminin.`;
        } else if (gender === "HOMME") {
            genderRule += `Utilise "IL", "LE". Accorde au masculin.`;
        }

        let finalPrompt = "";

        // --- CAS A : GENESIS ---
        if (body.action === "GENESIS") {
            finalPrompt = `
            RÔLE : Moteur Narratif Mythos.
            SCÉNARIO : ${body.scenarioTitle}.
            STYLE : "${body.styleInstruction}".
            
            IDENTITÉ DU HÉROS :
            - STADE : ${stage.toUpperCase()}
            - ${genderRule}
            - ${ageRule}
            
            DONNÉES TECHNIQUES DU MANDALA (SOURCE DE L'ÂME) : 
            ${body.profileKeywords}
            
            SITUATION DE DÉPART : "${body.userSituation}"
            
            TÂCHE PRIORITAIRE :
            1. PROLOGUE (story_right) : Écris le début de l'histoire.
            2. PSYCHOLOGIE (hero_description) :
               - Analyse la dynamique du héros avec nuance et bienveillance.
               - Mets en lumière ses forces (Lumière) tout en évoquant ses défis (Ombre).
               - Explique comment ses contradictions peuvent devenir une force.
               - Ton : Inspirant, clair et constructif. (Max 100 mots).
            
            FORMAT JSON :
            { 
                "story_right": "Le texte du prologue...", 
                "internal_left": "Pensée intérieure...",
                "hero_description": "Portrait psychologique nuancé..."
            }`;
        }
        
        // --- CAS B : NARRATE ---
        else if (body.action === "NARRATE") {
            finalPrompt = `
            SUITE DE L'HISTOIRE.
            STYLE : ${body.styleInstruction}.
            HÉROS : ${stage} / ${genderRule}.
            ${ageRule}
            
            --- OBJECTIF NARRATIF OBLIGATOIRE (LE SCÉNARIO) ---
            L'histoire DOIT réaliser cette étape maintenant : "${body.stepInstruction}".
            Intègre cet événement ou cette prise de conscience dans la narration.
            
            --- RAPPEL DU FIL ROUGE ---
            QUÊTE RÉELLE : "${body.userSituation}".
            
            --- MÉMOIRE DU RÉCIT ---
            ${body.previousStory ? body.previousStory.slice(-10000) : "Début."}
            
            --- ACTION ---
            ACTION JOUEUR : "${body.userAction}". 
            CARTE TIRÉE : ${body.cardData ? body.cardData.name : ""}.
            Interprète la carte pour influencer la réussite ou la tournure de cette étape.
            
            FORMAT JSON : { "story_right": "Suite...", "internal_left": "Pensée..." }`;
        }
        
        // --- CAS C : OPTIONS ---
        else if (body.action === "OPTIONS") {
            finalPrompt = `
            CONTEXTE : Jeu narratif de Tarot psychologique.
            CARTE TIRÉE : ${body.cardData ? body.cardData.name : "Inconnue"}.
            HÉROS : ${stage} ${gender}.
            
            OBJECTIF DU CHAPITRE À VENIR : "${body.stepInstruction}".
            
            TA MISSION : Proposer 3 actions narratives simples.
            Ces actions doivent permettre au héros d'avancer vers l'objectif du chapitre en utilisant l'énergie de la carte.
            
            INTERDICTIONS FORMELLES :
            - INTERDIT de parler de "dégâts", "bonus", "parade".
            - INTERDIT de faire des listes à puces.
            
            FORMAT JSON ATTENDU (Court, max 10 mots par choix) :
            { "A": "...", "B": "...", "C": "..." }
            `;
        }

        console.log(`Envoi Gemini 2.5... Action: ${body.action}`);
        const result = await model.generateContent(finalPrompt);
        const text = result.response.text();

        return { statusCode: 200, headers, body: JSON.stringify({ reply: text }) };

    } catch (err) {
        console.error("ERREUR FATALE:", err);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: err.message }) 
        };
    }
};
