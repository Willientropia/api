import React, { useState, useEffect } from 'react';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import {
  Sun,
  Zap,
  TrendingUp,
  Settings,
  RefreshCw,
  Calendar,
  MapPin,
  Battery,
  AlertTriangle
} from 'lucide-react';
import fusionSolarAPI from './services/fusionSolarAPI';
import './App.css';

function App() {
  const [isElectron, setIsElectron] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [plants, setPlants] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [plantDetails, setPlantDetails] = useState(null);
  const [generationData, setGenerationData] = useState([]);
  const [credentials, setCredentials] = useState({
    userName: '',
    systemCode: ''
  });
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [error, setError] = useState('');

  // Verificar se está rodando no Electron
  useEffect(() => {
    const checkElectron = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const hasElectronAPI = typeof window !== 'undefined' && window.electronAPI;
      const isElectronUA = userAgent.indexOf('electron') !== -1;
      
      setIsElectron(hasElectronAPI && isElectronUA);
    };

    checkElectron();
  }, []);

  // Se não estiver no Electron, mostrar aviso
  if (!isElectron) {
    return (
      <div className="app">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <AlertTriangle className="icon-large" style={{ color: '#f59e0b' }} />
              <h1>FusionSolar Monitor</h1>
              <p>Esta aplicação deve ser executada no Electron</p>
            </div>
            
            <div className="error-message">
              <strong>Aviso:</strong> Para acessar a API do FusionSolar e evitar problemas de CORS, 
              este aplicativo deve ser executado através do Electron.
            </div>
            
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>Como executar:</h3>
              <ol style={{ margin: 0, paddingLeft: '1.5rem', color: '#374151' }}>
                <li>Abra o terminal na pasta do projeto</li>
                <li>Execute: <code style={{ background: '#e5e7eb', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>npm run dev</code></li>
                <li>O Electron abrirá automaticamente</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Login na API
  const handleLogin = async () => {
    if (!credentials.userName || !credentials.systemCode) {
      setError('Por favor, preencha usuário e código do sistema');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await fusionSolarAPI.login(credentials.userName, credentials.systemCode);
      setIsAuthenticated(true);
      await loadPlants();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Carregar lista de usinas
  const loadPlants = async () => {
    try {
      setLoading(true);
      const plantsData = await fusionSolarAPI.getPlantList();
      setPlants(plantsData || []);
      
      if (plantsData && plantsData.length > 0) {
        setSelectedPlant(plantsData[0]);
        await loadPlantDetails(plantsData[0].stationCode);
      }
    } catch (err) {
      setError(`Erro ao carregar usinas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Carregar detalhes da usina selecionada
  const loadPlantDetails = async (stationCode) => {
    try {
      setLoading(true);
      const details = await fusionSolarAPI.getPlantDetail([stationCode]);
      setPlantDetails(details?.[0] || null);
    } catch (err) {
      setError(`Erro ao carregar detalhes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados de geração por período
  const loadGenerationData = async () => {
    if (!selectedPlant) return;

    try {
      setLoading(true);
      const data = await fusionSolarAPI.getPlantDailyData(
        [selectedPlant.stationCode],
        dateRange.startDate.replace(/-/g, ''),
        dateRange.endDate.replace(/-/g, '')
      );

      const formattedData = data?.map(item => ({
        date: format(parseISO(`${item.collectTime.slice(0,4)}-${item.collectTime.slice(4,6)}-${item.collectTime.slice(6,8)}`), 'dd/MM', { locale: ptBR }),
        fullDate: item.collectTime,
        generation: parseFloat(item.dataItemMap?.inverter_power || 0),
        irradiation: parseFloat(item.dataItemMap?.irradiation || 0),
        temperature: parseFloat(item.dataItemMap?.theory_power || 0)
      })) || [];

      setGenerationData(formattedData);
    } catch (err) {
      setError(`Erro ao carregar dados de geração: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar dados quando a usina ou período mudar
  useEffect(() => {
    if (selectedPlant && isAuthenticated) {
      loadGenerationData();
    }
  }, [selectedPlant, dateRange, isAuthenticated]);

  // Selecionar usina
  const handlePlantChange = async (plant) => {
    setSelectedPlant(plant);
    await loadPlantDetails(plant.stationCode);
  };

  // Atualizar dados
  const handleRefresh = async () => {
    await loadPlants();
    if (selectedPlant) {
      await loadGenerationData();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <Sun className="icon-large" />
              <h1>FusionSolar Monitor</h1>
              <p>Conecte-se à sua conta FusionSolar</p>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="login-form">
              <div className="form-group">
                <label>Usuário</label>
                <input
                  type="text"
                  value={credentials.userName}
                  onChange={(e) => setCredentials(prev => ({ ...prev, userName: e.target.value }))}
                  placeholder="Seu usuário FusionSolar"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Código do Sistema</label>
                <input
                  type="password"
                  value={credentials.systemCode}
                  onChange={(e) => setCredentials(prev => ({ ...prev, systemCode: e.target.value }))}
                  placeholder="Código do sistema"
                  required
                />
              </div>
              
              {error && <div className="error-message">{error}</div>}
              
              <button type="submit" className="login-button" disabled={loading}>
                {loading ? <RefreshCw className="icon spinning" /> : <Zap className="icon" />}
                {loading ? 'Conectando...' : 'Conectar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <Sun className="icon" />
          <h1>FusionSolar Monitor</h1>
        </div>
        <div className="header-right">
          <button onClick={handleRefresh} className="refresh-button" disabled={loading}>
            <RefreshCw className={`icon ${loading ? 'spinning' : ''}`} />
          </button>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="plant-selector">
            <h3>Usinas</h3>
            <div className="plants-list">
              {plants.map(plant => (
                <div
                  key={plant.stationCode}
                  className={`plant-item ${selectedPlant?.stationCode === plant.stationCode ? 'selected' : ''}`}
                  onClick={() => handlePlantChange(plant)}
                >
                  <MapPin className="icon-small" />
                  <div>
                    <div className="plant-name">{plant.stationName}</div>
                    <div className="plant-capacity">{plant.capacity || 0} kWp</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="date-range">
            <h3>Período</h3>
            <div className="date-inputs">
              <div className="form-group">
                <label>De</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Até</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </aside>

        <main className="content">
          {error && <div className="error-banner">{error}</div>}
          
          {plantDetails && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <Zap />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{plantDetails.dataItemMap?.real_power || '0'} kW</div>
                  <div className="stat-label">Potência Atual</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <TrendingUp />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{plantDetails.dataItemMap?.day_power || '0'} kWh</div>
                  <div className="stat-label">Geração Hoje</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <Battery />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{plantDetails.dataItemMap?.total_power || '0'} MWh</div>
                  <div className="stat-label">Geração Total</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <Sun />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{plantDetails.dataItemMap?.theory_power || '0'} kW</div>
                  <div className="stat-label">Potência Teórica</div>
                </div>
              </div>
            </div>
          )}

          <div className="charts-section">
            <div className="chart-card">
              <h3>Geração Diária (kWh)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={generationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => `Data: ${value}`}
                    formatter={(value) => [`${value} kWh`, 'Geração']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="generation" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    name="Geração"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h3>Comparativo Diário</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={generationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="generation" 
                    fill="#10b981" 
                    name="Geração (kWh)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;