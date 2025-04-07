import os from 'os';
import { FRONTEND_PORT, API_PORT } from '../config/ports';
import fs from 'fs';
import path from 'path';

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
      const frontendUrl = `http://${ip}:${FRONTEND_PORT}`;
      const apiUrl = `http://${ip}:${API_PORT}`;
      
      console.log(`Frontend: ${frontendUrl}`);
      console.log(`API: ${apiUrl}`);
      
      // Schrijf URL naar een bestand zodat het later gemakkelijk kan worden gedeeld
      try {
        const networkInfoDir = path.join(process.cwd(), 'network-info');
        if (!fs.existsSync(networkInfoDir)) {
          fs.mkdirSync(networkInfoDir, { recursive: true });
        }
        
        const networkInfoFile = path.join(networkInfoDir, 'urls.txt');
        fs.appendFileSync(
          networkInfoFile, 
          `${new Date().toISOString()}\nFrontend: ${frontendUrl}\nAPI: ${apiUrl}\n\n`
        );
        
        console.log(`\nURLs zijn opgeslagen in ${networkInfoFile}`);
      } catch (error: unknown) {
        console.log('URLs opslaan mislukt:', error instanceof Error ? error.message : 'Onbekende fout');
      }
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