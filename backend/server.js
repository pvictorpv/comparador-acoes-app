require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());

// --- Configuração da Brapi.dev ---
const BRAPI_API_KEY = process.env.BRAPI_API_KEY;
const BRAPI_BASE_URL = 'https://brapi.dev/api';

// --- CACHE NA MEMÓRIA ---
// Aqui guardaremos a lista de todas as ações para buscar instantaneamente
let cachedStocks = [];

/**
 * Função que carrega as ações para a memória do servidor.
 * Ela roda assim que o servidor liga.
 */
async function updateStockCache() {
    console.log(">>> Baixando lista de ações para o Cache Local... aguarde.");
    try {
        const response = await axios.get(`${BRAPI_BASE_URL}/quote/list`, {
            params: { 
                sortBy: 'volume', // Pega as mais populares/negociadas
                sortOrder: 'desc',
                limit: 1000, // Baixa 1000 ações (cobre praticamente tudo que importa)
                token: BRAPI_API_KEY 
            }
        });
        
        if (response.data && response.data.stocks) {
            cachedStocks = response.data.stocks;
            console.log(`>>> SUCESSO: ${cachedStocks.length} ações carregadas no Cache! Busca pronta.`);
        }
    } catch (error) {
        console.error(">>> ERRO ao criar cache:", error.message);
        console.log(">>> O sistema tentará usar a busca online como fallback.");
    }
}

// Inicia o cache assim que o script roda
updateStockCache();


/**
 * Endpoint 1: Rota de Busca (AGORA USA O CACHE)
 * Busca instantânea e inteligente (Nome OU Ticker)
 */
app.get('/api/search', async (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : '';
    
    if (!query || query.length < 2) return res.json([]); 

    // 1. Tenta buscar no nosso Cache Local (Muito rápido e preciso)
    if (cachedStocks.length > 0) {
        const filtered = cachedStocks.filter(stock => {
            const tickerMatch = stock.stock.toLowerCase().includes(query);
            const nameMatch = stock.name.toLowerCase().includes(query);
            return tickerMatch || nameMatch; // Aceita se bater no Nome OU no Ticker
        });

        // Pega os top 20 resultados do nosso filtro
        const suggestions = filtered.slice(0, 20).map(stock => ({
            value: stock.stock, 
            label: `${stock.name} (${stock.stock})`, 
            logo: stock.logo,
            website: stock.website
        }));
        
        return res.json(suggestions);
    }

    // 2. FALLBACK: Se o cache falhou (estava vazio), tenta a API direto (antigo método)
    try {
        const response = await axios.get(`${BRAPI_BASE_URL}/quote/list`, {
            params: { search: query, limit: 20, token: BRAPI_API_KEY }
        });
        
        const suggestions = response.data.stocks.map(stock => ({
            value: stock.stock, 
            label: `${stock.name} (${stock.stock})`, 
            logo: stock.logo,
            website: stock.website
        }));
        res.json(suggestions);

    } catch (error) {
        console.error("Erro na busca online:", error.message);
        res.status(500).json({ error: 'Erro ao buscar sugestões.' });
    }
});


/**
 * Helper: Busca dados da Brapi (Para Comparação)
 */
async function getBrapiQuote(ticker) {
    try {
        const response = await axios.get(`${BRAPI_BASE_URL}/quote/${ticker}`, {
            params: { token: BRAPI_API_KEY }
        });
        if (response.data && response.data.results && response.data.results.length > 0) {
            return response.data.results[0]; 
        }
        return { error: 'Ticker não encontrado na Brapi' };
    } catch (error) {
        return { error: 'Falha ao conectar na Brapi' };
    }
}

/**
 * Endpoint 2: Rota de Comparação
 */
app.get('/api/compare', async (req, res) => {
    try {
        const { tickerA, tickerB } = req.query; 

        if (!tickerA || !tickerB) {
            return res.status(400).json({ error: 'Tickers A e B são obrigatórios.' });
        }
        
        const dataA = await getBrapiQuote(tickerA.toUpperCase());
        const dataB = await getBrapiQuote(tickerB.toUpperCase());

        if (dataA.error) return res.status(404).json({ error: dataA.error });
        if (dataB.error) return res.status(404).json({ error: dataB.error });

        const marketCapA = dataA.marketCap;
        const priceA = dataA.regularMarketPrice;
        const marketCapB = dataB.marketCap;

        if (!marketCapA || !priceA || !marketCapB) {
            return res.status(404).json({ 
                error: 'Dados incompletos (MarketCap ou Preço) não encontrados.' 
            });
        }
        
        if (priceA === 0) {
            return res.status(400).json({ error: 'Preço da Empresa A é zero.' });
        }

        const sharesA = marketCapA / priceA;
        const hypotheticalPriceA = marketCapB / sharesA;

        res.json({
            tickerA: dataA.symbol,
            tickerB: dataB.symbol,
            longNameA: dataA.longName || dataA.shortName,
            longNameB: dataB.longName || dataB.shortName,
            hypotheticalPriceA: hypotheticalPriceA.toFixed(2),
            currentPriceA: dataA.regularMarketPrice,
            currentPriceB: dataB.regularMarketPrice,
            logoA: dataA.logo,
            logoB: dataB.logo,
            websiteA: dataA.website,
            websiteB: dataB.website
        });

    } catch (error) {
        console.error("Erro no /api/compare:", error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend rodando na porta ${PORT}`);
    // O log de "Baixando lista..." aparecerá logo em seguida
});