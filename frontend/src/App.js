import React, { useState, useRef } from 'react';
import axios from 'axios';
import AsyncSelect from 'react-select/async'; 
import './App.css'; 
import { FiTrendingUp, FiRefreshCw, FiShare2, FiArrowRight, FiAlertTriangle } from 'react-icons/fi'; 
import html2canvas from 'html2canvas';

// ==============================================================================
// ⚠️ IMPORTANTE: COLE A URL DO SEU RENDER ABAIXO (SEM A BARRA NO FINAL)
// Exemplo correto: const API_URL = 'https://backend-compapp.onrender.com';
// ==============================================================================
const API_URL = 'https://compapp-gl49.onrender.com'; 
// ==============================================================================


// Helper de domínio
const getDomainFromUrl = (url) => {
    if (!url) return null;
    try {
        const domain = new URL(url).hostname;
        return domain.replace(/^www\./, '');
    } catch (error) {
        return null; 
    }
};

// Componente de Logo para a BUSCA
const formatOptionLabel = ({ label, logo, website }) => {
    const tickerInitial = label[label.indexOf('(') + 1] || '?'; 
    const domain = getDomainFromUrl(website);
    const finalLogoSrc = logo || (domain ? `https://logo.clearbit.com/${domain}` : null);

    return (
        <div className="search-option-label">
            {finalLogoSrc ? (
                <img src={finalLogoSrc} alt={label} className="search-option-logo" crossOrigin="anonymous" />
            ) : (
                <div className="search-option-placeholder">{tickerInitial}</div>
            )}
            <span>{label}</span>
        </div>
    );
};

function App() {
    const [selectedA, setSelectedA] = useState(null); 
    const [selectedB, setSelectedB] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const resultRef = useRef(null);

    const loadOptions = (inputValue, callback) => {
        if (!inputValue || inputValue.length < 2) { 
            callback([]);
            return;
        }
        // Agora usa a variável API_URL
        axios.get(`${API_URL}/api/search`, { params: { q: inputValue } })
            .then(response => {
                callback(response.data);
            })
            .catch(() => {
                callback([]); 
            });
    };

    const handleCompare = async () => {
        if (!selectedA || !selectedB) {
            setError('Você precisa selecionar as duas empresas.');
            return;
        }
        setLoading(true);
        setError('');
        setResult(null);

        try {
            // Agora usa a variável API_URL
            const response = await axios.get(`${API_URL}/api/compare`, {
                params: { tickerA: selectedA.value, tickerB: selectedB.value }
            });

            setResult({
                ...response.data, 
                logoA: selectedA.logo, 
                logoB: selectedB.logo,
                websiteA: selectedA.website, 
                websiteB: selectedB.website
            });

        } catch (err) {
            if (err.response && err.response.data && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError('Não foi possível conectar ao servidor.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleNewSearch = () => {
        setResult(null);
        setError('');
        setSelectedA(null);
        setSelectedB(null);
    };

    const handleShareImage = async () => {
        if (!resultRef.current) return;

        const element = resultRef.current;
        const originalBg = element.style.backgroundColor;
        element.style.backgroundColor = '#222'; 

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true, 
                backgroundColor: '#222',
            });

            element.style.backgroundColor = originalBg; 

            const image = canvas.toDataURL('image/png');
            
            if (navigator.share) {
                const blob = await (await fetch(image)).blob();
                const file = new File([blob], `comparacao_${result.tickerA}_vs_${result.tickerB}.png`, { type: 'image/png' });
                await navigator.share({
                    title: `Comparação ${result.tickerA} vs ${result.tickerB}`,
                    files: [file],
                });
            } else {
                const link = document.createElement('a');
                link.href = image;
                link.download = `comparacao_${result.tickerA}_vs_${result.tickerB}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

        } catch (err) {
            console.error("Erro ao compartilhar/gerar imagem:", err);
            if (err.name !== 'AbortError') {
                setError("Falha ao compartilhar. Tentando baixar a imagem...");
            }
        }
    };

    const ResultLogo = ({ logo, website, ticker }) => {
        const domain = getDomainFromUrl(website);
        const finalLogoSrc = logo || (domain ? `https://logo.clearbit.com/${domain}` : null);

        if (finalLogoSrc) {
            return <img src={finalLogoSrc} alt={ticker} className="logo-img" crossOrigin="anonymous" />;
        }
        
        return <div className="logo-placeholder">{ticker[0] || '?'}</div>;
    };

    return (
        <div className="app-container">
            <div className="card">
                <h1>Comparador de Valor de Mercado</h1>

                {/* AVISO DE SERVIDOR */}
                <div className="server-warning">
                    <FiAlertTriangle className="warning-icon" />
                    <span>
                        <strong>Nota:</strong> No primeiro acesso, a busca pode demorar cerca de 40s para iniciar (Servidor Gratuito).
                    </span>
                </div>
                
                <div className="form-group">
                    <label>Se a Empresa A:</label>
                    <AsyncSelect
                        key={selectedA ? selectedA.value : 'select-a'}
                        placeholder="Nome ou Ticker (ex: Petrobras)"
                        loadOptions={loadOptions}
                        onChange={setSelectedA}
                        value={selectedA}
                        formatOptionLabel={formatOptionLabel}
                        className="search-select"
                        classNamePrefix="select"
                        loadingMessage={() => "Carregando..."}
                        noOptionsMessage={() => "Nenhuma opção encontrada"}
                    />
                </div>

                <div className="form-group">
                    <label>tivesse o valor de mercado da Empresa B:</label>
                    <AsyncSelect
                        key={selectedB ? selectedB.value : 'select-b'}
                        placeholder="Nome ou Ticker (ex: Vale)"
                        loadOptions={loadOptions}
                        onChange={setSelectedB}
                        value={selectedB}
                        formatOptionLabel={formatOptionLabel}
                        className="search-select"
                        classNamePrefix="select"
                        loadingMessage={() => "Carregando..."}
                        noOptionsMessage={() => "Nenhuma opção encontrada"}
                    />
                </div>
                
                <button onClick={handleCompare} disabled={loading} className="calculate-btn">
                    {loading ? 'Calculando...' : 'Calcular'}
                </button>

                {error && (
                    <div className="error-message">
                        <strong>Erro:</strong> {error}
                    </div>
                )}

                {result && (
                    <div className="result-container-wrapper">
                        <div className="result-container" ref={resultRef}> 
                            
                            <div className="result-logos">
                                <ResultLogo logo={result.logoA} website={result.websiteA} ticker={result.tickerA} />
                                <FiArrowRight className="logo-divider icon-base-color" /> 
                                <ResultLogo logo={result.logoB} website={result.websiteB} ticker={result.tickerB} />
                            </div>

                            <h2>{result.longNameA} ({result.tickerA})</h2>
                            <h2 className="vs">vs</h2>
                            <h2>{result.longNameB} ({result.tickerB})</h2>
                            
                            <div className="price-info">
                                <div>
                                    <span className="price-label">Preço Atual ({result.tickerA})</span>
                                    <strong className="price-value">{Number(result.currentPriceA).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                                </div>
                                <div>
                                    <span className="price-label">Preço Atual ({result.tickerB})</span>
                                    <strong className="price-value">{Number(result.currentPriceB).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                                </div>
                            </div>

                            <hr />

                            <div className="hypothetical-result">
                                <span className="result-label">Preço de {result.tickerA} com Market Cap de {result.tickerB}:</span>
                                
                                <div className="result-final-price">
                                    <strong className="hypothetical-price">
                                        {Number(result.hypotheticalPriceA).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </strong>
                                    
                                    {(() => {
                                        const currentPrice = result.currentPriceA;
                                        const hypotheticalPrice = parseFloat(result.hypotheticalPriceA);
                                        const percentChange = ((hypotheticalPrice / currentPrice) - 1) * 100;
                                        const formattedPercent = percentChange.toFixed(2);
                                        const percentClass = percentChange >= 0 ? 'percent-positive' : 'percent-negative';
                                        
                                        const icon = <FiTrendingUp style={{ transform: percentChange < 0 ? 'rotate(180deg)' : 'none' }} />;

                                        return (
                                            <span className={`percent-change ${percentClass}`}>
                                                {icon} {formattedPercent}%
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                        <div className="result-actions">
                            <button onClick={handleShareImage} className="share-image-btn">
                                <FiShare2 className="button-icon" /> Compartilhar
                            </button>
                            <button onClick={handleNewSearch} className="nova-comparacao-btn">
                                <FiRefreshCw className="button-icon" /> Nova Comparação
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;