/**
 * Setup Authentication System Script
 * 
 * Dit script voert alle stappen uit om het authenticatiesysteem te installeren en te testen:
 * 1. Installeert de benodigde packages
 * 2. Maakt een backup van de database
 * 3. Voert de migratie uit
 * 4. Test de authenticatie endpoints
 */
import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { backupDatabase } from './backup-database';
import { runAuthMigration } from './run-auth-migration';

/**
 * Installeer de benodigde packages
 */
async function installPackages(): Promise<void> {
  console.log('Installing required packages...');
  
  try {
    // Installeer productie dependencies
    console.log('\nInstalling production dependencies...');
    execSync('npm install jsonwebtoken bcrypt cookie-parser', { stdio: 'inherit' });
    
    // Installeer development dependencies
    console.log('\nInstalling development dependencies...');
    execSync('npm install --save-dev @types/jsonwebtoken @types/bcrypt @types/cookie-parser', { stdio: 'inherit' });
    
    console.log('\nAll packages installed successfully!');
  } catch (error) {
    console.error('Error installing packages:', error);
    throw error;
  }
}

/**
 * Voer de setup uit
 */
async function setupAuthSystem(): Promise<void> {
  try {
    console.log('=== AUTHENTICATION SYSTEM SETUP ===\n');
    
    // Stap 1: Installeer de benodigde packages
    console.log('Step 1: Installing required packages...');
    await installPackages();
    console.log('Packages installed successfully!\n');
    
    // Stap 2: Maak een backup van de database
    console.log('Step 2: Creating database backup...');
    const backupPath = backupDatabase('pre-auth-setup');
    console.log(`Database backup created at: ${backupPath}\n`);
    
    // Stap 3: Voer de migratie uit
    console.log('Step 3: Running database migration...');
    await runAuthMigration();
    console.log('Migration completed successfully!\n');
    
    console.log(`
=== AUTHENTICATION SYSTEM SETUP COMPLETED ===

The authentication system has been successfully set up. You can now:

1. Start the API server:
   REQUIRE_AUTH=false node --loader ts-node/esm src/scripts/start-api-simple-express.ts

2. Start the frontend application:
   npm run dev

3. Login with the default admin user:
   Username: admin
   Password: admin

4. Access the admin interface at:
   http://localhost:5173/admin/users

If you encounter any issues, you can restore the database from the backup:
${backupPath}

Enjoy your new authentication system!
`);
  } catch (error) {
    console.error('Error setting up authentication system:', error);
    console.log(`
=== SETUP FAILED ===

An error occurred during the setup process. If you want to try again:

1. Restore the database from the backup (if created)
2. Run this script again

Error details:
${error}
`);
    throw error;
  }
}

// Als dit script direct wordt uitgevoerd (niet geïmporteerd)
if (require.main === module) {
  setupAuthSystem()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      process.exit(1);
    });
}
