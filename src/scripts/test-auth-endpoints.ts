/**
 * Test Authentication Endpoints Script
 * 
 * Dit script test de authenticatie endpoints om te controleren of ze correct werken.
 * Het gebruikt fetch om HTTP requests te maken naar de API server.
 */
import fetch from 'node-fetch';

// Configuratie
const API_URL = 'http://localhost:3001/api/v1';
let authToken: string | null = null;
let refreshToken: string | null = null;

/**
 * Voer een HTTP request uit
 * 
 * @param method HTTP method
 * @param endpoint API endpoint
 * @param body Request body
 * @param token Auth token
 * @returns Response data
 */
async function request(method: string, endpoint: string, body?: any, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} - ${JSON.stringify(data)}`);
  }
  
  return data;
}

/**
 * Test login endpoint
 */
async function testLogin(): Promise<void> {
  console.log('\n--- Testing Login Endpoint ---');
  
  try {
    // Test login met correcte credentials
    console.log('Testing login with correct credentials...');
    const loginResponse = await request('POST', '/auth/login', {
      username: 'admin',
      password: 'admin'
    });
    
    console.log('Login successful!');
    console.log('User:', loginResponse.data.user.username);
    console.log('Roles:', loginResponse.data.user.roles.map((r: any) => r.name).join(', '));
    
    // Sla tokens op voor later gebruik
    authToken = loginResponse.data.token;
    refreshToken = loginResponse.data.refreshToken;
    
    // Test login met incorrecte credentials
    console.log('\nTesting login with incorrect credentials...');
    try {
      await request('POST', '/auth/login', {
        username: 'admin',
        password: 'wrong-password'
      });
      console.log('ERROR: Login with incorrect credentials succeeded, but should have failed!');
    } catch (error) {
      console.log('Login with incorrect credentials failed as expected.');
    }
  } catch (error) {
    console.error('Error testing login:', error);
  }
}

/**
 * Test me endpoint
 */
async function testMe(): Promise<void> {
  console.log('\n--- Testing Me Endpoint ---');
  
  if (!authToken) {
    console.log('Skipping test: No auth token available');
    return;
  }
  
  try {
    // Test me endpoint met token
    console.log('Testing me endpoint with token...');
    const meResponse = await request('GET', '/auth/me', undefined, authToken);
    
    console.log('Me endpoint successful!');
    console.log('User:', meResponse.data.username);
    
    // Test me endpoint zonder token
    console.log('\nTesting me endpoint without token...');
    try {
      await request('GET', '/auth/me');
      console.log('ERROR: Me endpoint without token succeeded, but should have failed!');
    } catch (error) {
      console.log('Me endpoint without token failed as expected.');
    }
  } catch (error) {
    console.error('Error testing me endpoint:', error);
  }
}

/**
 * Test users endpoints
 */
async function testUsers(): Promise<void> {
  console.log('\n--- Testing Users Endpoints ---');
  
  if (!authToken) {
    console.log('Skipping test: No auth token available');
    return;
  }
  
  try {
    // Test get all users
    console.log('Testing get all users...');
    const usersResponse = await request('GET', '/users', undefined, authToken);
    
    console.log('Get all users successful!');
    console.log('Number of users:', usersResponse.data.length);
    
    // Test create user
    console.log('\nTesting create user...');
    const createUserResponse = await request('POST', '/auth/register', {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password',
      first_name: 'Test',
      last_name: 'User'
    }, authToken);
    
    console.log('Create user successful!');
    console.log('New user ID:', createUserResponse.data.id);
    
    // Test get user by ID
    const userId = createUserResponse.data.id;
    console.log(`\nTesting get user by ID (${userId})...`);
    const getUserResponse = await request('GET', `/users/${userId}`, undefined, authToken);
    
    console.log('Get user by ID successful!');
    console.log('User:', getUserResponse.data.username);
    
    // Test update user
    console.log('\nTesting update user...');
    const updateUserResponse = await request('PUT', `/users/${userId}`, {
      first_name: 'Updated',
      last_name: 'User',
      roles: [3] // user role
    }, authToken);
    
    console.log('Update user successful!');
    console.log('Updated user:', updateUserResponse.data.first_name, updateUserResponse.data.last_name);
  } catch (error) {
    console.error('Error testing users endpoints:', error);
  }
}

/**
 * Test roles endpoints
 */
async function testRoles(): Promise<void> {
  console.log('\n--- Testing Roles Endpoints ---');
  
  if (!authToken) {
    console.log('Skipping test: No auth token available');
    return;
  }
  
  try {
    // Test get all roles
    console.log('Testing get all roles...');
    const rolesResponse = await request('GET', '/roles', undefined, authToken);
    
    console.log('Get all roles successful!');
    console.log('Number of roles:', rolesResponse.data.length);
    console.log('Roles:', rolesResponse.data.map((r: any) => r.name).join(', '));
    
    // Test get role by ID
    const roleId = 1; // admin role
    console.log(`\nTesting get role by ID (${roleId})...`);
    const getRoleResponse = await request('GET', `/roles/${roleId}`, undefined, authToken);
    
    console.log('Get role by ID successful!');
    console.log('Role:', getRoleResponse.data.name);
    console.log('Permissions:', getRoleResponse.data.permissions?.length || 0);
    
    // Test create custom role
    console.log('\nTesting create custom role...');
    const createRoleResponse = await request('POST', '/roles', {
      name: 'custom-role',
      description: 'Een aangepaste rol',
      permissions: [1, 2, 3] // Enkele permissies
    }, authToken);
    
    console.log('Create custom role successful!');
    console.log('New role ID:', createRoleResponse.data.id);
    console.log('Role:', createRoleResponse.data.name);
  } catch (error) {
    console.error('Error testing roles endpoints:', error);
  }
}

/**
 * Test permissions endpoints
 */
async function testPermissions(): Promise<void> {
  console.log('\n--- Testing Permissions Endpoints ---');
  
  if (!authToken) {
    console.log('Skipping test: No auth token available');
    return;
  }
  
  try {
    // Test get all permissions
    console.log('Testing get all permissions...');
    const permissionsResponse = await request('GET', '/permissions', undefined, authToken);
    
    console.log('Get all permissions successful!');
    console.log('Number of permissions:', permissionsResponse.data.length);
    console.log('Permissions:', permissionsResponse.data.slice(0, 5).map((p: any) => p.name).join(', '), '...');
  } catch (error) {
    console.error('Error testing permissions endpoints:', error);
  }
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
  console.log('Starting authentication endpoints tests...');
  
  await testLogin();
  await testMe();
  await testUsers();
  await testRoles();
  await testPermissions();
  
  console.log('\nAll tests completed!');
}

// Als dit script direct wordt uitgevoerd (niet geïmporteerd)
if (require.main === module) {
  runTests()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Error running tests:', error);
      process.exit(1);
    });
}

// Exporteer de functie voor gebruik in andere scripts
export { runTests };
