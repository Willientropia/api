// API Service que usa o Electron IPC para evitar problemas de CORS
class FusionSolarAPI {
  constructor() {
    this.isElectron = window.electronAPI && window.electronAPI.fusionSolar;
  }

  async login(userName, systemCode) {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI.fusionSolar.login({ userName, systemCode });
        return result.data;
      } catch (error) {
        throw new Error(`Erro no login: ${error.message}`);
      }
    } else {
      throw new Error('Esta aplicação deve ser executada no Electron para acessar a API FusionSolar');
    }
  }

  async getPlantList() {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI.fusionSolar.getPlants();
        return result.data;
      } catch (error) {
        throw new Error(`Erro ao buscar usinas: ${error.message}`);
      }
    } else {
      throw new Error('Esta aplicação deve ser executada no Electron');
    }
  }

  async getPlantDetail(stationCodes) {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI.fusionSolar.getPlantDetail(stationCodes);
        return result.data;
      } catch (error) {
        throw new Error(`Erro ao buscar detalhes da usina: ${error.message}`);
      }
    } else {
      throw new Error('Esta aplicação deve ser executada no Electron');
    }
  }

  async getPlantDailyData(stationCodes, startTime, endTime) {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI.fusionSolar.getDailyData({
          stationCodes,
          startTime,
          endTime
        });
        return result.data;
      } catch (error) {
        throw new Error(`Erro ao buscar dados diários: ${error.message}`);
      }
    } else {
      throw new Error('Esta aplicação deve ser executada no Electron');
    }
  }

  async getPlantMonthlyData(stationCodes, startTime, endTime) {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI.fusionSolar.getMonthlyData({
          stationCodes,
          startTime,
          endTime
        });
        return result.data;
      } catch (error) {
        throw new Error(`Erro ao buscar dados mensais: ${error.message}`);
      }
    } else {
      throw new Error('Esta aplicação deve ser executada no Electron');
    }
  }

  async getDeviceList(stationCodes) {
    if (this.isElectron) {
      try {
        const result = await window.electronAPI.fusionSolar.getDevices(stationCodes);
        return result.data;
      } catch (error) {
        throw new Error(`Erro ao buscar dispositivos: ${error.message}`);
      }
    } else {
      throw new Error('Esta aplicação deve ser executada no Electron');
    }
  }
}

// Criar uma instância singleton
const fusionSolarAPI = new FusionSolarAPI();

export default fusionSolarAPI;