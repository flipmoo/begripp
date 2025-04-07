import os from 'os';
import { FRONTEND_PORT, API_PORT } from '../config/ports';

// Functie om alle netwerkinterfaces te tonen
function showNetworkInterfaces() {
  const networkInterfaces = os.networkInterfaces();
  console.log('Beschikbare netwerkinterfaces:');
  console.log('-----------------------------');
  
  // Houd externe IP-adressen bij
  const externalIPs: string[] = [];
  
  // Loop door alle interfaces
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    const interfaces = networkInterfaces[interfaceName];
    if (!interfaces) return;
    
    interfaces.forEach((iface) => {
      // Negeer localhost en IPv6 adressen voor eenvoud
      if (!iface.internal && iface.family === 'IPv4') {
        externalIPs.push(iface.address);
        console.log(`Interface: ${interfaceName}`);
        console.log(`IP-adres: ${iface.address}`);
        console.log(`Masker: ${iface.netmask}`);
        console.log('-----------------------------');
      }
    });
  });
  
  // Toon toegangsadressen
  if (externalIPs.length > 0) {
    console.log('\nDe applicatie is toegankelijk op:');
    externalIPs.forEach(ip => {
      console.log(`Frontend: http://${ip}:${FRONTEND_PORT}`);
      console.log(`API: http://${ip}:${API_PORT}`);
    });
    console.log('\nDeel deze adressen met je collega\'s om toegang te krijgen tot de applicatie.');
  } else {
    console.log('\nGeen externe netwerkinterfaces gevonden.');
    console.log('Controleer je netwerkverbinding of gebruik localhost voor lokale toegang:');
    console.log(`Frontend: http://localhost:${FRONTEND_PORT}`);
    console.log(`API: http://localhost:${API_PORT}`);
  }
}

// Toon informatie
console.log('=== Netwerk Informatie ===');
showNetworkInterfaces(); 