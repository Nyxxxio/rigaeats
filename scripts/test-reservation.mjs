const url = 'http://localhost:9002/api/reservations';
const payload = {
  name: 'Sync Test',
  email: 'guest@example.com',
  phone: '+37120000000',
  guests: 2,
  date: '2025-11-01',
  time: '19:00',
};

async function main() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (e) {
    console.error('Request failed:', e);
    process.exit(1);
  }
}

main();
