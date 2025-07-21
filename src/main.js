const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const isDev = process.env.ELECTRON_IS_DEV === 'true' || !app.isPackaged;

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    titleBarStyle: 'default',
    show: false
  });

  // Determinar URL corretamente
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Interceptar tentativas de navegação externa
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
};

// FusionSolar API Class para o main process
class FusionSolarAPI {
  constructor() {
    // Usar apenas o servidor que sabemos que funciona
    this.baseURLs = [
      'https://intl.fusionsolar.huawei.com/thirdData'  // Este é o único que funciona
    ];
    this.currentBaseURL = this.baseURLs[0];
    this.userName = '';
    this.systemCode = '';
    this.token = '';
    this.tokenExpiry = null;
    
    // Criar instância axios com cookies
    this.axiosInstance = axios.create({
      withCredentials: true,
      timeout: 30000
    });
  }

  setCredentials(userName, systemCode) {
    this.userName = userName;
    this.systemCode = systemCode;
  }

  getTimestamp() {
    return Date.now().toString();
  }

  generateSignature(body, timestamp) {
    const message = body + timestamp;
    return crypto.createHmac('sha256', this.systemCode).update(message).digest('hex');
  }

  async login() {
    // Limpar token existente antes de tentar login
    this.token = '';
    this.tokenExpiry = null;
    
    for (let i = 0; i < this.baseURLs.length; i++) {
      const baseURL = this.baseURLs[i];
      console.log(`Tentando login em: ${baseURL}`);
      
      try {
        const result = await this.tryLoginWithURL(baseURL);
        if (result.success) {
          this.currentBaseURL = baseURL;
          console.log(`✅ Login bem-sucedido em: ${baseURL}`);
          return result;
        }
      } catch (error) {
        console.log(`❌ Falha em ${baseURL}:`, error.message);
        
        // Se for o último servidor, lance o erro
        if (i === this.baseURLs.length - 1) {
          throw error;
        }
      }
    }
    
    throw new Error('Não foi possível conectar a nenhum servidor FusionSolar');
  }

  async tryLoginWithURL(baseURL) {
    const timestamp = this.getTimestamp();
    const bodyObj = {
      userName: this.userName,
      systemCode: this.systemCode
    };
    const body = JSON.stringify(bodyObj);
    
    const signature = this.generateSignature(body, timestamp);

    const response = await this.axiosInstance.post(`${baseURL}/login`, bodyObj, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': signature,
        'timeStamp': timestamp,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('API Response:', {
      url: baseURL,
      status: response.status,
      success: response.data.success,
      failCode: response.data.failCode,
      tokenReceived: !!response.data.data,
      tokenType: typeof response.data.data,
      hasCookies: !!response.headers['set-cookie']
    });

    if (response.data.success) {
      // Login bem-sucedido - a sessão está nos cookies
      this.token = signature; // Manter a assinatura como referência
      this.tokenExpiry = Date.now() + (30 * 60 * 1000);
      console.log('✅ Login bem-sucedido - sessão estabelecida via cookies');
      return { success: true, data: 'session_established' };
    } else {
      const errorMsg = this.getErrorMessage(response.data.failCode);
      throw new Error(`${response.data.failCode}: ${errorMsg}`);
    }
  }

  getErrorMessage(failCode) {
    const errorMessages = {
      '20001': 'Parâmetros inválidos',
      '20002': 'Usuário não existe',
      '20003': 'Senha incorreta',
      '20004': 'Conta bloqueada',
      '20005': 'Conta expirada',
      '20006': 'Token inválido',
      '20007': 'Token expirado',
      '20008': 'Muitas tentativas de login',
      '20009': 'Sistema em manutenção',
      '20010': 'Permissão negada',
      '20400': 'Dados de requisição inválidos ou mal formatados',
      '20401': 'Não autorizado - verifique usuário e systemCode',
      '20403': 'Acesso negado',
      '20404': 'Recurso não encontrado',
      '20500': 'Erro interno do servidor',
      '20503': 'Serviço indisponível',
      '305': 'Token inválido ou expirado - fazendo novo login',
      '407': 'Token expirado - renovando automaticamente'
    };
    
    return errorMessages[failCode] || `Erro desconhecido (${failCode})`;
  }

  isTokenValid() {
    return this.token && this.tokenExpiry && Date.now() < this.tokenExpiry;
  }

  async ensureValidToken() {
    if (!this.isTokenValid()) {
      console.log('Token inválido ou expirado, fazendo novo login...');
      await this.login();
    } else {
      console.log('Token ainda válido, usando token existente');
    }
  }

  async makeAuthenticatedRequest(endpoint, data = {}) {
    await this.ensureValidToken();
    
    const timestamp = this.getTimestamp();
    const body = JSON.stringify(data);
    
    // Para requisições autenticadas, sempre gerar nova assinatura
    const signature = this.generateSignature(body, timestamp);
    
    console.log(`Making request to ${endpoint}:`, {
      url: `${this.currentBaseURL}${endpoint}`,
      data: data,
      timestamp: timestamp
    });

    try {
      // Usar a instância axios com cookies para manter a sessão
      const response = await this.axiosInstance.post(`${this.currentBaseURL}${endpoint}`, data, {
        headers: {
          'Content-Type': 'application/json',
          'XSRF-TOKEN': signature,
          'timeStamp': timestamp,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      console.log(`Response from ${endpoint}:`, {
        status: response.status,
        success: response.data.success,
        failCode: response.data.failCode,
        dataType: typeof response.data.data,
        dataLength: Array.isArray(response.data.data) ? response.data.data.length : 'not-array'
      });

      if (response.data.success) {
        return { success: true, data: response.data.data };
      } else {
        // Se for erro de token (305 ou 407), invalidar token e tentar novamente
        if (response.data.failCode === 305 || response.data.failCode === 407) {
          console.log('Sessão inválida, fazendo novo login...');
          this.token = '';
          this.tokenExpiry = null;
          
          // Tentar login novamente
          await this.ensureValidToken();
          
          // Aguardar um pouco antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const retryTimestamp = this.getTimestamp();
          const retrySignature = this.generateSignature(body, retryTimestamp);
          
          const retryResponse = await this.axiosInstance.post(`${this.currentBaseURL}${endpoint}`, data, {
            headers: {
              'Content-Type': 'application/json',
              'XSRF-TOKEN': retrySignature,
              'timeStamp': retryTimestamp,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (retryResponse.data.success) {
            return { success: true, data: retryResponse.data.data };
          } else {
            const errorMsg = this.getErrorMessage(retryResponse.data.failCode);
            throw new Error(`${retryResponse.data.failCode}: ${errorMsg}`);
          }
        }
        
        const errorMsg = this.getErrorMessage(response.data.failCode);
        throw new Error(`${response.data.failCode}: ${errorMsg}`);
      }
    } catch (error) {
      console.error(`Error in ${endpoint}:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      if (error.response?.data?.failCode) {
        const errorMsg = this.getErrorMessage(error.response.data.failCode);
        throw new Error(`${error.response.data.failCode}: ${errorMsg}`);
      }
      
      throw error;
    }
  }

  async getPlantList() {
    return await this.makeAuthenticatedRequest('/getStationList', {});
  }

  async getPlantDetail(stationCodes) {
    return await this.makeAuthenticatedRequest('/getStationRealKpi', {
      stationCodes: Array.isArray(stationCodes) ? stationCodes.join(',') : stationCodes
    });
  }

  async getPlantDailyData(stationCodes, startTime, endTime) {
    return await this.makeAuthenticatedRequest('/getKpiStationDay', {
      stationCodes: Array.isArray(stationCodes) ? stationCodes.join(',') : stationCodes,
      startTime: startTime,
      endTime: endTime
    });
  }

  async getPlantMonthlyData(stationCodes, startTime, endTime) {
    return await this.makeAuthenticatedRequest('/getKpiStationMonth', {
      stationCodes: Array.isArray(stationCodes) ? stationCodes.join(',') : stationCodes,
      startTime: startTime,
      endTime: endTime
    });
  }

  async getDeviceList(stationCodes) {
    return await this.makeAuthenticatedRequest('/getDevList', {
      stationCodes: Array.isArray(stationCodes) ? stationCodes.join(',') : stationCodes
    });
  }
}

// Instância da API
const fusionSolarAPI = new FusionSolarAPI();

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers para a API FusionSolar
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

ipcMain.handle('fusionsolar-login', async (event, { userName, systemCode }) => {
  try {
    fusionSolarAPI.setCredentials(userName, systemCode);
    const result = await fusionSolarAPI.login();
    return result;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fusionsolar-get-plants', async (event) => {
  try {
    const result = await fusionSolarAPI.getPlantList();
    return result;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fusionsolar-get-plant-detail', async (event, stationCodes) => {
  try {
    const result = await fusionSolarAPI.getPlantDetail(stationCodes);
    return result;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fusionsolar-get-daily-data', async (event, { stationCodes, startTime, endTime }) => {
  try {
    const result = await fusionSolarAPI.getPlantDailyData(stationCodes, startTime, endTime);
    return result;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fusionsolar-get-monthly-data', async (event, { stationCodes, startTime, endTime }) => {
  try {
    const result = await fusionSolarAPI.getPlantMonthlyData(stationCodes, startTime, endTime);
    return result;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fusionsolar-get-devices', async (event, stationCodes) => {
  try {
    const result = await fusionSolarAPI.getDeviceList(stationCodes);
    return result;
  } catch (error) {
    throw error;
  }
});