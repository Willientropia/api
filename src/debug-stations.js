// Teste específico para debug do endpoint de dados diários
const axios = require('axios');
const crypto = require('crypto');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const userName = 'willieAPI'; // Novo usuário
const systemCode = 'Wapsolar10*';
const baseURL = 'https://intl.fusionsolar.huawei.com/thirdData';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDailyDataEndpoint() {
  console.log('🔍 TESTE ESPECÍFICO: Endpoint de dados diários');
  console.log('═'.repeat(50));
  
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
    console.log('📡 Buscando lista de plantas...');
    
    const plantsResponse = await client.post(`${baseURL}/getStationList`, {}, {
      headers: {
        'Content-Type': 'application/json',
        'XSRF-TOKEN': serverXsrfToken,
        'timeStamp': Date.now().toString()
      }
    });

    if (!plantsResponse.data.success) {
      console.log('❌ Erro ao buscar plantas:', plantsResponse.data);
      return;
    }

    const plants = plantsResponse.data.data;
    console.log(`✅ ${plants.length} plantas encontradas`);
    
    // Pegar a primeira planta para teste
    const firstPlant = plants[0];
    console.log(`📋 Testando com planta: ${firstPlant.stationName} (${firstPlant.stationCode})`);

    // PASSO 3: Testar diferentes períodos de tempo
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const testPeriods = [
      {
        name: 'Hoje',
        startTime: formatDate(today),
        endTime: formatDate(today)
      },
      {
        name: 'Ontem',
        startTime: formatDate(yesterday),
        endTime: formatDate(yesterday)
      },
      {
        name: 'Últimos 7 dias',
        startTime: formatDate(lastWeek),
        endTime: formatDate(today)
      },
      {
        name: 'Último mês',
        startTime: formatDate(lastMonth),
        endTime: formatDate(today)
      }
    ];

    // PASSO 4: Testar cada período
    for (const period of testPeriods) {
      console.log(`\n📅 Testando período: ${period.name} (${period.startTime} - ${period.endTime})`);
      
      await sleep(3000); // Aguardar entre requisições
      
      try {
        const dailyDataResponse = await client.post(`${baseURL}/getKpiStationDay`, {
          stationCodes: firstPlant.stationCode,
          startTime: period.startTime,
          endTime: period.endTime
        }, {
          headers: {
            'Content-Type': 'application/json',
            'XSRF-TOKEN': serverXsrfToken,
            'timeStamp': Date.now().toString()
          }
        });

        console.log('📋 Resultado:', {
          success: dailyDataResponse.data.success,
          failCode: dailyDataResponse.data.failCode,
          message: dailyDataResponse.data.message,
          hasData: !!dailyDataResponse.data.data,
          dataLength: Array.isArray(dailyDataResponse.data.data) ? dailyDataResponse.data.data.length : 'N/A'
        });

        if (dailyDataResponse.data.success) {
          console.log('✅ SUCESSO! Período que funciona:', period.name);
          
          if (dailyDataResponse.data.data && dailyDataResponse.data.data.length > 0) {
            console.log('📊 Amostra de dados:');
            const sample = dailyDataResponse.data.data[0];
            console.log('   Estrutura:', Object.keys(sample));
            console.log('   Primeiro item:', JSON.stringify(sample, null, 2));
          }
          
          // Se encontrou um período que funciona, não precisa testar outros
          break;
        } else {
          console.log(`❌ Falha no período ${period.name}:`, {
            failCode: dailyDataResponse.data.failCode,
            message: dailyDataResponse.data.message
          });
          
          // Analisar códigos de erro específicos
          if (dailyDataResponse.data.failCode === 20004) {
            console.log('   💡 Erro 20004: Pode ser bloqueio por muitas requisições ou permissões limitadas');
          } else if (dailyDataResponse.data.failCode === 20001) {
            console.log('   💡 Erro 20001: Parâmetros inválidos - talvez formato de data incorreto');
          }
        }
        
      } catch (error) {
        console.log(`❌ Erro na requisição: ${error.message}`);
      }
    }

    // PASSO 5: Testar outros endpoints relacionados a dados históricos
    console.log('\n🔍 Testando outros endpoints de dados históricos...');
    
    const otherEndpoints = [
      {
        name: 'Dados Mensais',
        endpoint: '/getKpiStationMonth',
        params: {
          stationCodes: firstPlant.stationCode,
          startTime: formatDate(lastMonth).substring(0, 6), // YYYYMM
          endTime: formatDate(today).substring(0, 6)        // YYYYMM
        }
      },
      {
        name: 'Dados Horários',
        endpoint: '/getKpiStationHour',
        params: {
          stationCodes: firstPlant.stationCode,
          startTime: formatDate(today),
          endTime: formatDate(today)
        }
      }
    ];

    for (const test of otherEndpoints) {
      console.log(`\n📡 Testando: ${test.name}`);
      await sleep(3000);
      
      try {
        const response = await client.post(`${baseURL}${test.endpoint}`, test.params, {
          headers: {
            'Content-Type': 'application/json',
            'XSRF-TOKEN': serverXsrfToken,
            'timeStamp': Date.now().toString()
          }
        });

        console.log('📋 Resultado:', {
          success: response.data.success,
          failCode: response.data.failCode,
          hasData: !!response.data.data
        });

        if (response.data.success) {
          console.log(`✅ ${test.name} funciona!`);
        }
        
      } catch (error) {
        console.log(`❌ Erro em ${test.name}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

async function main() {
  console.log('🚀 Iniciando análise específica de dados diários...\n');
  await testDailyDataEndpoint();
  
  console.log('\n🏁 ANÁLISE CONCLUÍDA!');
  console.log('💡 Se nenhum período funcionou, pode ser:');
  console.log('   1. Conta sem permissão para dados históricos');
  console.log('   2. Rate limiting específico para esse endpoint');
  console.log('   3. Necessário aguardar mais tempo entre requisições');
}

main().catch(console.error);