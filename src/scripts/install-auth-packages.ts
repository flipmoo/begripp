/**
 * Install Authentication Packages Script
 * 
 * Dit script installeert de benodigde packages voor het authenticatiesysteem.
 */
import { execSync } from 'child_process';

/**
 * Installeer de benodigde packages
 */
function installPackages(): void {
  console.log('Installing authentication packages...');
  
  try {
    // Installeer productie dependencies
    console.log('\nInstalling production dependencies...');
    execSync('npm install jsonwebtoken bcrypt cookie-parser', { stdio: 'inherit' });
    
    // Installeer development dependencies
    console.log('\nInstalling development dependencies...');
    execSync('npm install --save-dev @types/jsonwebtoken @types/bcrypt @types/cookie-parser', { stdio: 'inherit' });
    
    // Installeer node-fetch voor het test script
    console.log('\nInstalling node-fetch for testing...');
    execSync('npm install --save-dev node-fetch @types/node-fetch', { stdio: 'inherit' });
    
    console.log('\nAll packages installed successfully!');
  } catch (error) {
    console.error('Error installing packages:', error);
    throw error;
  }
}

// Als dit script direct wordt uitgevoerd (niet geïmporteerd)
if (require.main === module) {
  try {
    installPackages();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// Exporteer de functie voor gebruik in andere scripts
export { installPackages };
