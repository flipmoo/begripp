import { employeeService, contractService, hourService } from './services';

async function testApiCalls() {
  try {
    console.log('Testing API calls...');

    // Test getting employees
    console.log('\nTesting getAll employees...');
    const employeesResponse = await employeeService.getAll();
    console.log('Employees response:', employeesResponse);

    if (employeesResponse?.result?.rows?.length > 0) {
      const employeeIds = employeesResponse.result.rows
        .filter(employee => employee.active)
        .map(employee => employee.id);

      // Test getting contracts
      console.log('\nTesting getByEmployeeIds contracts...');
      const contractsResponse = await contractService.getByEmployeeIds(employeeIds);
      console.log('Contracts response:', contractsResponse);

      // Test getting hours for week 5
      const startDate = '2024-01-29'; // Week 5 start
      const endDate = '2024-02-04';   // Week 5 end
      
      console.log('\nTesting getByEmployeeIdsAndPeriod hours...');
      const hoursResponse = await hourService.getByEmployeeIdsAndPeriod(
        employeeIds,
        startDate,
        endDate
      );
      console.log('Hours response:', hoursResponse);
    }

    console.log('\nAll API tests completed successfully!');
  } catch (error) {
    console.error('API test failed:', error);
  }
}

// Run the tests
testApiCalls(); 