const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // FusionSolar API methods
  fusionSolar: {
    login: (credentials) => ipcRenderer.invoke('fusionsolar-login', credentials),
    getPlants: () => ipcRenderer.invoke('fusionsolar-get-plants'),
    getPlantDetail: (stationCodes) => ipcRenderer.invoke('fusionsolar-get-plant-detail', stationCodes),
    getDailyData: (params) => ipcRenderer.invoke('fusionsolar-get-daily-data', params),
    getMonthlyData: (params) => ipcRenderer.invoke('fusionsolar-get-monthly-data', params),
    getDevices: (stationCodes) => ipcRenderer.invoke('fusionsolar-get-devices', stationCodes)
  }
});