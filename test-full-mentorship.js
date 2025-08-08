const fetch = require('node-fetch');

async function testMentorshipVideos() {
  console.log('1. Logging in to get fresh token...');
  
  // Login first
  const loginResponse = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'admin@test.com',
      password: 'admin123'
    })
  });
  
  if (!loginResponse.ok) {
    console.error('Login failed:', await loginResponse.text());
    return;
  }
  
  const loginData = await loginResponse.json();
  const token = loginData.access_token;
  console.log('✅ Login successful, got token\n');
  
  // Test mentorship videos endpoint
  console.log('2. Testing mentorship videos endpoint...');
  const videosResponse = await fetch('http://localhost:4000/api/v1/videos/mentorshipVideos', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!videosResponse.ok) {
    console.error('Failed to get videos:', videosResponse.status, await videosResponse.text());
    return;
  }
  
  const videos = await videosResponse.json();
  
  console.log(`\n=== Mentorship Videos Result ===`);
  console.log(`✅ Total videos returned: ${videos.length}`);
  
  // Expected list
  const expectedMentorias = [
    'mentoria_1',
    'mentoria_2_iwm',
    'mentoria_contexto_general',
    'mentoria_de_refuerzos',
    'mentoria_entradas_parte_1',
    'mentoria_entradas_parte_2',
    'mentoria_entradas_parte_3',
    'mentoria_entradas_parte_4',
    'mentoria_entradas_parte_5',
    'mentoria_entradas_parte_6_a',
    'mentoria_entradas_parte_6_b',
    'mentoria_entradas_parte_6_c',
    'mentoria_entradas_parte_7',
    'mentoria_entradas_parte_8',
    'mentoria_medias_moviles',
    'mentoria_para_manejar_cuentas',
    'mentoria_para_manejar_cuentas_2',
    'mentoria_preguntas_respuestas'
  ];
  
  // Extract mentorship names from returned videos
  const returnedMentorias = videos.map(v => {
    const parts = v.key.split('/');
    return parts[2]; // Get the mentoria folder name
  });
  
  console.log('\n📹 Videos returned:');
  returnedMentorias.forEach((name, index) => {
    console.log(`  ${index + 1}. ${name}`);
  });
  
  // Check for missing ones
  const missingMentorias = expectedMentorias.filter(m => !returnedMentorias.includes(m));
  
  if (missingMentorias.length > 0) {
    console.log(`\n⚠️  Missing ${missingMentorias.length} mentorships:`);
    missingMentorias.forEach(m => console.log(`  - ${m}`));
  } else {
    console.log('\n🎉 SUCCESS! All 18 mentorship videos are being returned!');
  }
  
  // Show sample video data
  if (videos.length > 0) {
    console.log('\n📝 Sample video data:');
    const sample = videos[0];
    console.log(`  Key: ${sample.key}`);
    console.log(`  Size: ${sample.size || 'N/A'}`);
    console.log(`  Last Modified: ${sample.lastModified || 'N/A'}`);
    console.log(`  Signed URL: ${sample.signedUrl ? sample.signedUrl.substring(0, 100) + '...' : 'N/A'}`);
  }
}

testMentorshipVideos().catch(console.error);