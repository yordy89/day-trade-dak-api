const fetch = require('node-fetch');

async function testMentorshipEndpoint() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3M2I2ZWM3ZDM1YjU2YmY1OGQzYmE0YiIsImVtYWlsIjoieW9yZHlAZ21haWwuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3MzM0MDU5NjAsImV4cCI6MTczNDAxMDc2MH0.AzIL7d9bVm9mDLMRJBb4DXrwQqCOxtR-YkPo61ZnBSA';
  
  try {
    const response = await fetch('http://localhost:4000/api/v1/videos/mentorshipVideos', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.log('Response status:', response.status);
      const text = await response.text();
      console.log('Response:', text);
      return;
    }
    
    const videos = await response.json();
    
    console.log('=== Mentorship Videos API Response ===');
    console.log(`Total videos returned: ${videos.length}`);
    
    if (videos.length > 0) {
      console.log('\nVideos returned:');
      videos.forEach((video, index) => {
        const mentoriaName = video.key.split('/')[2];
        console.log(`${index + 1}. ${mentoriaName}`);
      });
    }
    
    // Check which ones are missing
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
    
    const returnedMentorias = videos.map(v => v.key.split('/')[2]);
    const missingMentorias = expectedMentorias.filter(m => !returnedMentorias.includes(m));
    
    if (missingMentorias.length > 0) {
      console.log(`\n⚠️  Missing ${missingMentorias.length} mentorships:`);
      missingMentorias.forEach(m => console.log(`  - ${m}`));
    } else {
      console.log('\n✅ All 18 mentorships are being returned!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMentorshipEndpoint();