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
    this.baseURL = 'https://intl.fusionsolar.huawei.com/thirdData';
    this.userName = '';
    this.systemCode = '';
    this.token = '';
    this.tokenExpiry = null;
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
    const timestamp = this.getTimestamp();
    const body = JSON.stringify({
      userName: this.userName,
      systemCode: this.systemCode
    });

    const signature = this.generateSignature(body, timestamp);

    try {
      const response = await axios.post(`${this.baseURL}/login`, JSON.parse(body), {
        headers: {
          'Content-Type': 'application/json',
          'XSRF-TOKEN': signature,
          'timeStamp': timestamp
        }
      });

      if (response.data.success) {
        this.token = response.data.data;
        this.tokenExpiry = Date.now() + (30 * 60 * 1000);
        return { success: true, data: response.data.data };
      } else {
        throw new Error(response.data.failCode || 'Falha no login');
      }
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  isTokenValid() {
    return this.token && this.tokenExpiry && Date.now() < this.tokenExpiry;
  }

  async ensureValidToken() {
    if (!this.isTokenValid()) {
      await this.login();
    }
  }

  async makeAuthenticatedRequest(endpoint, data = {}) {
    await this.ensureValidToken();
    
    const timestamp = this.getTimestamp();
    const body = JSON.stringify(data);
    const signature = this.generateSignature(body, timestamp);

    try {
      const response = await axios.post(`${this.baseURL}${endpoint}`, JSON.parse(body), {
        headers: {
          'Content-Type': 'application/json',
          'XSRF-TOKEN': this.token,
          'timeStamp': timestamp
        }
      });

      if (response.data.success) {
        return { success: true, data: response.data.data };
      } else {
        throw new Error(response.data.failCode || 'Erro na requisição');
      }
    } catch (error) {
      console.error(`Erro em ${endpoint}:`, error);
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