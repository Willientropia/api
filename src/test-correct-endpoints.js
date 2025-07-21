// Teste com endpoints corretos da API FusionSolar
const axios = require('axios');
const crypto = require('crypto');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const userName = 'willieAPI';
const systemCode = 'Wapsolar10*';
const baseURL = 'https://intl.fusionsolar.huawei.com/thirdData';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCorrectEndpoints() {
  console.log('🔍 TESTE COM ENDPOINTS CORRETOS');
  console.log('═'.repeat(40));
  
  try {
    const cookieJar = new CookieJar();
    const client = wrapper(axios.create({
      jar: cookieJar,
      withCredentials: true,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }));

    // PASSO 1: Login
    console.log('🔐 Fazendo login...');
    const timestamp = Date.now().toString();
    const bodyObj = { userName, systemCode };
    const body = JSON.stringify(bodyObj);
    const signature = crypto.createHmac('sha256', systemCode).update(body + timestamp).digest('hex');

    let loginResponse = await client.post(`${baseURL}/login`, bodyObj, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': signature,
        'timeStamp': timestamp
      }
    });

    // Retry se necessário
    if (loginResponse.data.failCode === 407) {
      console.log('⏰ Rate limiting, aguardando 30 segundos...');
      await sleep(30000);
      
      const retryTimestamp = Date.now().toString();
      const retrySignature = crypto.createHmac('sha256', systemCode).update(JSON.stringify(bodyObj) + retryTimestamp).digest('hex');
      
      loginResponse = await client.post(`${baseURL}/login`, bodyObj, {
        headers: {
          'Content-Type': 'application/json',
          'XSRF-TOKEN': retrySignature,
          'timeStamp': retryTimestamp
        }
      });
    }

    if (!loginResponse.data.success) {
      console.log('❌ Login falhou:', loginResponse.data);
      return;
    }

    console.log('✅ Login bem-sucedido!');
    const serverXsrfToken = loginResponse.headers['xsrf-token'];
    
    // PASSO 2: Buscar lista de plantas
    await sleep(5000);
    console.log('\n📡 1. Testando getStationList...');
    
    const plantsResponse = await client.post(`${baseURL}/getStationList`, {}, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': serverXsrfToken,
        'timeStamp': Date.now().toString()
      }
    });

    console.log('✅ getStationList:', {
      success: plantsResponse.data.success,
      count: plantsResponse.data.data?.length || 0
    });

    const plants = plantsResponse.data.data;
    const firstPlant = plants[0];
    console.log(`📋 Primeira planta: ${firstPlant.stationName} (${firstPlant.stationCode})`);

    // PASSO 3: Testar getStationRealKpi
    await sleep(3000);
    console.log('\n📡 2. Testando getStationRealKpi...');
    
    const realKpiResponse = await client.post(`${baseURL}/getStationRealKpi`, {
      stationCodes: firstPlant.stationCode
    }, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': serverXsrfToken,
        'timeStamp': Date.now().toString()
      }
    });

    console.log('✅ getStationRealKpi:', {
      success: realKpiResponse.data.success,
      failCode: realKpiResponse.data.failCode,
      hasData: !!realKpiResponse.data.data
    });

    if (realKpiResponse.data.success && realKpiResponse.data.data) {
      const stationData = realKpiResponse.data.data[0];
      console.log('📊 Dados da planta:');
      console.log(`   Potência atual: ${stationData.dataItemMap?.real_power || 'N/A'} kW`);
      console.log(`   Geração hoje: ${stationData.dataItemMap?.day_power || 'N/A'} kWh`);
      console.log(`   Geração total: ${stationData.dataItemMap?.total_power || 'N/A'} kWh`);
    }

    // PASSO 4: Testar getDevList
    await sleep(3000);
    console.log('\n📡 3. Testando getDevList...');
    
    const devListResponse = await client.post(`${baseURL}/getDevList`, {
      stationCodes: firstPlant.stationCode
    }, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': serverXsrfToken,
        'timeStamp': Date.now().toString()
      }
    });

    console.log('✅ getDevList:', {
      success: devListResponse.data.success,
      failCode: devListResponse.data.failCode,
      deviceCount: Array.isArray(devListResponse.data.data) ? devListResponse.data.data.length : 0
    });

    if (devListResponse.data.success && devListResponse.data.data) {
      console.log('📱 Dispositivos encontrados:');
      devListResponse.data.data.forEach((device, index) => {
        console.log(`   ${index + 1}. ${device.devName || device.devAlias || 'Sem nome'} (ID: ${device.id}, Tipo: ${device.devTypeId})`);
      });

      // PASSO 5: Testar getDevRealKpi com primeiro dispositivo
      const firstDevice = devListResponse.data.data[0];
      if (firstDevice) {
        await sleep(3000);
        console.log(`\n📡 4. Testando getDevRealKpi para dispositivo ${firstDevice.devName || firstDevice.id}...`);
        
        const devRealKpiResponse = await client.post(`${baseURL}/getDevRealKpi`, {
          devIds: firstDevice.id.toString(),
          devTypeId: firstDevice.devTypeId.toString()
        }, {
          headers: {
            'Content-Type': 'application/json',
            'XSRF-TOKEN': serverXsrfToken,
            'timeStamp': Date.now().toString()
          }
        });

        console.log('✅ getDevRealKpi:', {
          success: devRealKpiResponse.data.success,
          failCode: devRealKpiResponse.data.failCode,
          hasData: !!devRealKpiResponse.data.data
        });

        if (devRealKpiResponse.data.success && devRealKpiResponse.data.data) {
          const deviceData = devRealKpiResponse.data.data[0];
          console.log('📊 Dados do dispositivo:');
          if (deviceData.dataItemMap) {
            Object.entries(deviceData.dataItemMap).slice(0, 5).forEach(([key, value]) => {
              console.log(`   ${key}: ${value}`);
            });
          }
        }
      }
    }

    // PASSO 6: Testar endpoints históricos com parâmetros diferentes
    console.log('\n📡 5. Testando endpoints históricos com parâmetros corretos...');
    
    const today = new Date();
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const formatMonth = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}${month}`;
    };

    // Testar com diferentes formatos de parâmetros
    const historicalTests = [
      {
        name: 'getKpiStationHour (hoje)',
        endpoint: '/getKpiStationHour',
        params: {
          stationCodes: firstPlant.stationCode,
          startTime: formatDate(today),
          endTime: formatDate(today)
        }
      },
      {
        name: 'getKpiStationDay (hoje)',
        endpoint: '/getKpiStationDay', 
        params: {
          stationCodes: firstPlant.stationCode,
          startTime: formatDate(today),
          endTime: formatDate(today)
        }
      },
      {
        name: 'getKpiStationMonth (mês atual)',
        endpoint: '/getKpiStationMonth',
        params: {
          stationCodes: firstPlant.stationCode,
          startTime: formatMonth(today),
          endTime: formatMonth(today)
        }
      }
    ];

    for (const test of historicalTests) {
      await sleep(5000); // Aguardar mais tempo para endpoints históricos
      console.log(`\n📡 Testando ${test.name}...`);
      
      try {
        const response = await client.post(`${baseURL}${test.endpoint}`, test.params, {
          headers: {
            'Content-Type': 'application/json',
            'XSRF-TOKEN': serverXsrfToken,
            'timeStamp': Date.now().toString()
          }
        });

        console.log(`   Resultado: ${response.data.success ? '✅ Sucesso' : '❌ Falha'} (${response.data.failCode || 0})`);
        
        if (response.data.success && response.data.data) {
          console.log(`   Dados: ${Array.isArray(response.data.data) ? response.data.data.length : 1} registro(s)`);
          
          if (Array.isArray(response.data.data) && response.data.data.length > 0) {
            const sample = response.data.data[0];
            console.log('   Amostra:', Object.keys(sample).slice(0, 3).join(', '));
          }
        } else if (response.data.failCode) {
          console.log(`   Erro: ${getErrorMessage(response.data.failCode)}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Erro na requisição: ${error.message}`);
      }
    }

    console.log('\n🎉 TESTE CONCLUÍDO!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

function getErrorMessage(failCode) {
  const errorMessages = {
    '20001': 'Parâmetros inválidos',
    '20004': 'Acesso negado/Conta bloqueada',
    '20012': 'Sem dados disponíveis ou período inválido',
    '305': 'Sessão expirada',
    '407': 'Rate limiting'
  };
  
  return errorMessages[failCode] || `Erro ${failCode}`;
}

async function main() {
  console.log('🚀 Testando endpoints corretos da API FusionSolar...\n');
  await testCorrectEndpoints();
}

main().catch(console.error);