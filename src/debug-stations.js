// Script para debug da API getStationList
const axios = require('axios');
const crypto = require('crypto');

async function testStationList() {
  // Substitua pelas suas credenciais
  const userName = 'SoltechAPI';
  const systemCode = 'Wapsolar2024'; // Complete aqui
  const baseURL = 'https://intl.fusionsolar.huawei.com/thirdData';

  console.log('🔐 Fazendo login...');
  
  // Login
  const loginTimestamp = Date.now().toString();
  const loginBody = JSON.stringify({ userName, systemCode });
  const loginSignature = crypto.createHmac('sha256', systemCode).update(loginBody + loginTimestamp).digest('hex');

  try {
    const loginResponse = await axios.post(`${baseURL}/login`, { userName, systemCode }, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': loginSignature,
        'timeStamp': loginTimestamp
      }
    });

    if (!loginResponse.data.success) {
      console.error('❌ Login falhou:', loginResponse.data);
      return;
    }

    const token = loginResponse.data.data;
    console.log('✅ Login bem-sucedido!');
    console.log('Token completo:', token);
    console.log('Token tipo:', typeof token);
    
    if (!token) {
      console.error('❌ Token é null ou undefined!');
      return;
    }

    // Testar getStationList
    console.log('\n🏭 Buscando lista de usinas...');
    
    const stationTimestamp = Date.now().toString();
    const stationData = {};
    const stationBody = JSON.stringify(stationData);
    
    console.log('Request details:', {
      url: `${baseURL}/getStationList`,
      token: token.substring(0, 20) + '...',
      timestamp: stationTimestamp,
      body: stationBody
    });

    const stationResponse = await axios.post(`${baseURL}/getStationList`, stationData, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': token,
        'timeStamp': stationTimestamp
      }
    });

    console.log('Response:', {
      status: stationResponse.status,
      success: stationResponse.data.success,
      failCode: stationResponse.data.failCode,
      message: stationResponse.data.message,
      dataType: typeof stationResponse.data.data,
      dataLength: Array.isArray(stationResponse.data.data) ? stationResponse.data.data.length : 'not-array'
    });

    if (stationResponse.data.success) {
      console.log('✅ Usinas encontradas:', stationResponse.data.data.length);
      if (stationResponse.data.data.length > 0) {
        console.log('Primeira usina:', {
          name: stationResponse.data.data[0].stationName,
          code: stationResponse.data.data[0].stationCode,
          capacity: stationResponse.data.data[0].capacity
        });
      }
    } else {
      console.error('❌ Erro ao buscar usinas:', stationResponse.data);
    }

  } catch (error) {
    console.error('❌ Erro:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
  }
}

testStationList();