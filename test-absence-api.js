import axios from 'axios';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Configuration
const API_URL = 'http://localhost:3002/api/absencerequests';
const OUTPUT_FILE = 'absence_response.json';
const DB_PATH = './src/db/database.sqlite';

// Main function
async function testAbsenceAPI() {
  console.log('Testing absence request API...');
  
  try {
    // First, try the API
    console.log(`URL: ${API_URL}`);
    const params = {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      limit: 10,
      start: 0
    };
    console.log(`Parameters: ${JSON.stringify(params)}`);
    
    try {
      const response = await axios.get(API_URL, { params });
      
      // Save the response to a file
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(response.data, null, 2));
      
      console.log('API test successful!');
      console.log(`Total records: ${response.data[0].result.count}`);
      console.log(`Records returned: ${response.data[0].result.rows.length}`);
      
      if (response.data[0].result.rows.length > 0) {
        const firstRecord = response.data[0].result.rows[0];
        console.log('\nSample data (first record):');
        console.log(`Employee: ${firstRecord.employee.searchname} (ID: ${firstRecord.employee.id})`);
        console.log(`Description: ${firstRecord.description}`);
        console.log(`Absence type: ${firstRecord.absencetype.searchname}`);
        console.log(`Number of absence lines: ${firstRecord.absencerequestline.length}`);
      }
    } catch (apiError) {
      console.log('Error testing absence API:');
      if (apiError.response) {
        console.log(`Status: ${apiError.response.status}`);
        console.log(`Data: ${JSON.stringify(apiError.response.data)}`);
      } else {
        console.log(`Error: ${apiError.message}`);
      }
      
      // If API fails, try direct database query
      console.log('\nTrying direct database query instead...');
      await queryDatabase();
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Function to query the database directly
async function queryDatabase() {
  try {
    // Open the database
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    
    console.log('Connected to database');
    
    // Check if the absence_requests table exists
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables in database:', tables.map(t => t.name));
    
    // Get the schema of the absence_requests table
    const schema = await db.all("PRAGMA table_info(absence_requests)");
    console.log('Schema of absence_requests table:', schema.map(col => col.name));
    
    // Query the absence_requests table
    const absenceRequests = await db.all(
      `SELECT 
         id, description, comment, createdon, updatedon, searchname,
         employee_id, employee_searchname, employee_discr,
         absencetype_id, absencetype_searchname
       FROM absence_requests
       LIMIT 10`
    );
    
    console.log(`\nFound ${absenceRequests.length} absence requests in the database:`);
    
    // Display the results
    absenceRequests.forEach(request => {
      console.log(`\nID: ${request.id}`);
      console.log(`Description: ${request.description}`);
      console.log(`Employee: ${request.employee_searchname} (ID: ${request.employee_id})`);
      console.log(`Created on: ${request.createdon}`);
      console.log(`Absence type: ${request.absencetype_searchname}`);
    });
    
    // Close the database
    await db.close();
    console.log('\nDatabase connection closed');
  } catch (dbError) {
    console.error('Database error:', dbError.message);
  }
}

// Run the test
testAbsenceAPI(); 