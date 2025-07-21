// Script para debug da API getStationList
const axios = require('axios');
const crypto = require('crypto');

async function testStationList() {
  // Substitua pelas suas credenciais
  const userName = 'SoltechAPI';
  const systemCode = 'Wapsolar10*';
  const baseURL = 'https://intl.fusionsolar.huawei.com/thirdData';

  console.log('🔐 Fazendo login...');
  
  // Criar uma instância axios com cookies habilitados
  const apiClient = axios.create({
    withCredentials: true,
    jar: true // Para manter cookies entre requisições
  });

  // Login
  const loginTimestamp = Date.now().toString();
  const loginBody = JSON.stringify({ userName, systemCode });
  const loginSignature = crypto.createHmac('sha256', systemCode).update(loginBody + loginTimestamp).digest('hex');

  try {
    const loginResponse = await apiClient.post(`${baseURL}/login`, { userName, systemCode }, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': loginSignature,
        'timeStamp': loginTimestamp,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('Login Response:', {
      status: loginResponse.status,
      success: loginResponse.data.success,
      failCode: loginResponse.data.failCode,
      cookies: loginResponse.headers['set-cookie'],
      data: loginResponse.data
    });

    if (!loginResponse.data.success) {
      console.error('❌ Login falhou:', loginResponse.data);
      return;
    }

    // Extrair cookies da resposta
    const cookies = loginResponse.headers['set-cookie'];
    console.log('Cookies recebidos:', cookies);

    console.log('✅ Login bem-sucedido!');

    // Aguardar um pouco antes da próxima requisição
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Testar getStationList usando os cookies da sessão
    console.log('\n🏭 Buscando lista de usinas...');
    
    const stationTimestamp = Date.now().toString();
    const stationData = {};
    const stationBody = JSON.stringify(stationData);
    
    // Para requisições autenticadas, usar os cookies da sessão
    const stationSignature = crypto.createHmac('sha256', systemCode).update(stationBody + stationTimestamp).digest('hex');
    
    console.log('Request details:', {
      url: `${baseURL}/getStationList`,
      timestamp: stationTimestamp,
      body: stationBody,
      signature: stationSignature.substring(0, 20) + '...',
      hasCookies: !!cookies
    });

    // Fazer a requisição usando a mesma instância do axios (com cookies)
    const stationResponse = await apiClient.post(`${baseURL}/getStationList`, stationData, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': stationSignature,
        'timeStamp': stationTimestamp,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('Station Response:', {
      status: stationResponse.status,
      success: stationResponse.data.success,
      failCode: stationResponse.data.failCode,
      message: stationResponse.data.message,
      dataType: typeof stationResponse.data.data,
      dataLength: Array.isArray(stationResponse.data.data) ? stationResponse.data.data.length : 'not-array',
      fullResponse: stationResponse.data
    });

    if (stationResponse.data.success) {
      console.log('✅ Usinas encontradas:', stationResponse.data.data?.length || 0);
      if (stationResponse.data.data && stationResponse.data.data.length > 0) {
        console.log('Primeira usina:', {
          name: stationResponse.data.data[0].stationName,
          code: stationResponse.data.data[0].stationCode,
          capacity: stationResponse.data.data[0].capacity
        });
        
        console.log('Todas as usinas:');
        stationResponse.data.data.forEach((plant, index) => {
          console.log(`  ${index + 1}. ${plant.stationName} (${plant.stationCode}) - ${plant.capacity}kWp`);
        });
      }
    } else {
      console.error('❌ Erro ao buscar usinas:', stationResponse.data);
      
      // Se ainda der erro 305, tentar com diferentes abordagens
      if (stationResponse.data.failCode === 305) {
        console.log('\n🔄 Tentando com abordagem alternativa...');
        
        // Tentar novamente após um delay maior
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const retryTimestamp = Date.now().toString();
        const retrySignature = crypto.createHmac('sha256', systemCode).update('{}' + retryTimestamp).digest('hex');
        
        const retryResponse = await apiClient.post(`${baseURL}/getStationList`, {}, {
          headers: {
            'Content-Type': 'application/json',
            'XSRF-TOKEN': retrySignature,
            'timeStamp': retryTimestamp,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': baseURL,
            'Origin': 'https://intl.fusionsolar.huawei.com'
          }
        });
        
        console.log('Retry Response:', retryResponse.data);
      }
    }

  } catch (error) {
    console.error('❌ Erro:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
  }
}

testStationList();