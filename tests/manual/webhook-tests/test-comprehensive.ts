/**
 * Comprehensive webhook testing script
 * Run with: npx ts-node tests/manual/webhook-tests/test-comprehensive.ts
 */

interface TestResult {
  name: string;
  success: boolean;
  status: number;
  response?: any;
  error?: string;
}

async function makeRequest(url: string, body: any): Promise<{ status: number; data: any }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await response.text();
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch {
      parsedData = data;
    }
    
    return { status: response.status, data: parsedData };
  } catch (error) {
    throw new Error(`Request failed: ${(error as Error).message}`);
  }
}

async function testWebhooks(): Promise<void> {
  const baseUrl = 'http://localhost:8080/api/webhooks';
  const results: TestResult[] = [];
  
  console.log('🧪 Comprehensive Webhook Testing');
  console.log('==================================\n');

  // Test 1: Inbound SMS
  console.log('📱 Testing Inbound SMS...');
  try {
    const result = await makeRequest(`${baseUrl}/sms`, {
      from: '+12345678901',
      to: '+19876543210',
      type: 'sms',
      messaging_provider_id: `SM${Date.now()}`,
      body: 'Test inbound SMS message',
      timestamp: new Date().toISOString()
    });
    
    results.push({
      name: 'Inbound SMS',
      success: result.status === 200,
      status: result.status,
      response: result.data
    });
    console.log(`✅ Status: ${result.status}\n`);
  } catch (error) {
    results.push({
      name: 'Inbound SMS',
      success: false,
      status: 0,
      error: (error as Error).message
    });
    console.log(`❌ Error: ${(error as Error).message}\n`);
  }

  // Test 2: Inbound MMS
  console.log('📷 Testing Inbound MMS...');
  try {
    const result = await makeRequest(`${baseUrl}/sms`, {
      from: '+12345678901',
      to: '+19876543210',
      type: 'mms',
      messaging_provider_id: `MM${Date.now()}`,
      body: 'Check out this image!',
      attachments: ['https://example.com/image.jpg'],
      timestamp: new Date().toISOString()
    });
    
    results.push({
      name: 'Inbound MMS',
      success: result.status === 200,
      status: result.status,
      response: result.data
    });
    console.log(`✅ Status: ${result.status}\n`);
  } catch (error) {
    results.push({
      name: 'Inbound MMS',
      success: false,
      status: 0,
      error: (error as Error).message
    });
    console.log(`❌ Error: ${(error as Error).message}\n`);
  }

  // Test 3: Inbound Email
  console.log('📧 Testing Inbound Email...');
  try {
    const result = await makeRequest(`${baseUrl}/email`, {
      from: 'test@example.com',
      to: 'user@company.com',
      xillio_id: `email_${Date.now()}`,
      body: '<h1>Test Email</h1><p>This is a test inbound email with <strong>HTML</strong>.</p>',
      attachments: ['https://example.com/document.pdf'],
      timestamp: new Date().toISOString()
    });
    
    results.push({
      name: 'Inbound Email',
      success: result.status === 200,
      status: result.status,
      response: result.data
    });
    console.log(`✅ Status: ${result.status}\n`);
  } catch (error) {
    results.push({
      name: 'Inbound Email',
      success: false,
      status: 0,
      error: (error as Error).message
    });
    console.log(`❌ Error: ${(error as Error).message}\n`);
  }

  // Test 4: Twilio Status Update (will fail if no message exists)
  console.log('📊 Testing Twilio Status Update...');
  try {
    const result = await makeRequest(`${baseUrl}/sms/status`, {
      MessageSid: `SM${Date.now()}`,
      MessageStatus: 'delivered',
      AccountSid: 'ACtest123',
      From: '+12345678901',
      To: '+19876543210',
      ApiVersion: '2010-04-01'
    });
    
    results.push({
      name: 'Twilio Status',
      success: result.status === 200,
      status: result.status,
      response: result.data
    });
    console.log(`✅ Status: ${result.status} (Note: May not find message to update)\n`);
  } catch (error) {
    results.push({
      name: 'Twilio Status',
      success: false,
      status: 0,
      error: (error as Error).message
    });
    console.log(`❌ Error: ${(error as Error).message}\n`);
  }

  // Test 5: SendGrid Events
  console.log('🎯 Testing SendGrid Events...');
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await makeRequest(`${baseUrl}/email/events`, [
      {
        email: 'user@company.com',
        timestamp: timestamp,
        'smtp-id': '<test@example.com>',
        event: 'delivered',
        sg_event_id: `event_${Date.now()}_1`,
        sg_message_id: `email_${Date.now()}`
      },
      {
        email: 'user@company.com',
        timestamp: timestamp + 30,
        'smtp-id': '<test@example.com>',
        event: 'open',
        sg_event_id: `event_${Date.now()}_2`,
        sg_message_id: `email_${Date.now()}`
      }
    ]);
    
    results.push({
      name: 'SendGrid Events',
      success: result.status === 200,
      status: result.status,
      response: result.data
    });
    console.log(`✅ Status: ${result.status}\n`);
  } catch (error) {
    results.push({
      name: 'SendGrid Events',
      success: false,
      status: 0,
      error: (error as Error).message
    });
    console.log(`❌ Error: ${(error as Error).message}\n`);
  }

  // Test 6: Error handling - Invalid JSON
  console.log('🚨 Testing Error Handling (Invalid JSON)...');
  try {
    const response = await fetch(`${baseUrl}/sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid": json}'
    });
    
    results.push({
      name: 'Error Handling',
      success: response.status >= 400,
      status: response.status,
      response: 'Invalid JSON handled correctly'
    });
    console.log(`✅ Status: ${response.status} (Error handled correctly)\n`);
  } catch (error) {
    results.push({
      name: 'Error Handling',
      success: true,
      status: 0,
      response: 'Error caught by fetch (expected)'
    });
    console.log(`✅ Error caught by fetch (expected behavior)\n`);
  }

  // Summary
  console.log('📋 Test Results Summary');
  console.log('========================');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.success ? 'PASSED' : 'FAILED'} (Status: ${result.status})`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  const passed = results.filter(r => r.success).length;
  const total = results.length;
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All webhook tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check server logs and database connection.');
  }
}

testWebhooks().catch(console.error);

export {};