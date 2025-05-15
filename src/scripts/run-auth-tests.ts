/**
 * Run Authentication Tests Script
 * 
 * Dit script voert alle stappen uit om het authenticatiesysteem te testen:
 * 1. Bereid de testdatabase voor
 * 2. Voer de migratie uit op de testdatabase
 * 3. Test de authenticatie endpoints
 */
import { prepareTestDatabase } from './prepare-test-database';
import { runAuthMigration } from './run-auth-migration';
import { runTests } from './test-auth-endpoints';
import { execSync } from 'child_process';

/**
 * Voer alle tests uit
 */
async function runAllTests(): Promise<void> {
  try {
    console.log('=== AUTHENTICATION SYSTEM TESTS ===\n');
    
    // Stap 1: Bereid de testdatabase voor
    console.log('Step 1: Preparing test database...');
    prepareTestDatabase();
    console.log('Test database prepared successfully!\n');
    
    // Stap 2: Voer de migratie uit op de testdatabase
    console.log('Step 2: Running migration on test database...');
    process.env.TEST_MODE = 'true';
    await runAuthMigration();
    console.log('Migration completed successfully!\n');
    
    // Stap 3: Start de API server met de testdatabase
    console.log('Step 3: Starting API server with test database...');
    console.log('Starting API server in the background...');
    
    // Start de API server in een apart proces
    const serverProcess = execSync(
      'TEST_MODE=true REQUIRE_AUTH=false node --loader ts-node/esm src/scripts/start-api-simple-express.ts &',
      { stdio: 'inherit' }
    );
    
    // Wacht even tot de server is opgestart
    console.log('Waiting for API server to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stap 4: Test de authenticatie endpoints
    console.log('\nStep 4: Testing authentication endpoints...');
    await runTests();
    
    // Stap 5: Stop de API server
    console.log('\nStep 5: Stopping API server...');
    execSync('pkill -f "node --loader ts-node/esm src/scripts/start-api-simple-express.ts"');
    
    console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY ===');
  } catch (error) {
    console.error('Error running tests:', error);
    
    // Probeer de API server te stoppen als er een fout optreedt
    try {
      execSync('pkill -f "node --loader ts-node/esm src/scripts/start-api-simple-express.ts"');
    } catch (e) {
      // Negeer fouten bij het stoppen van de server
    }
    
    throw error;
  }
}

// Als dit script direct wordt uitgevoerd (niet geïmporteerd)
if (require.main === module) {
  runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Tests failed:', error);
      process.exit(1);
    });
}
