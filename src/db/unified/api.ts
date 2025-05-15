/**
 * Unified API Module
 * 
 * This module provides a unified API for accessing data from the database.
 */

import express, { Router } from 'express';
import { Database } from 'sqlite';
import { IUnitOfWork } from './interfaces';
import apiConfig from './api/index.json';

/**
 * Gripp API Client
 * 
 * Provides methods for interacting with the Gripp API.
 */
export class GrippApiClient {
  private apiKey: string;
  private baseUrl: string;
  
  /**
   * Constructor
   * @param apiKey Gripp API key
   * @param baseUrl Gripp API base URL
   */
  constructor(apiKey: string, baseUrl = 'https://api.gripp.com/public/api3.php') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  /**
   * Make a request to the Gripp API
   * @param method API method to call
   * @param params Parameters to pass to the method
   * @returns API response
   */
  async request(method: string, params: any[] = []) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey
        },
        body: JSON.stringify({
          method,
          params,
          id: Date.now()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Gripp API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error calling Gripp API method ${method}:`, error);
      throw error;
    }
  }
  
  /**
   * Get employees from Gripp
   * @returns List of employees
   */
  async getEmployees() {
    const response = await this.request('employee.get', [{ active: true }]);
    return response.result;
  }
  
  /**
   * Get projects from Gripp
   * @returns List of projects
   */
  async getProjects() {
    const response = await this.request('project.get');
    return response.result;
  }
  
  /**
   * Get invoices from Gripp
   * @returns List of invoices
   */
  async getInvoices() {
    const response = await this.request('invoice.get');
    return response.result;
  }
}

/**
 * Create an API router
 * @param unitOfWork Unit of work instance
 * @returns Express router
 */
export function createApiRouter(unitOfWork: IUnitOfWork): Router {
  const router = express.Router();
  
  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  });
  
  // Get all employees
  router.get('/employees', async (req, res) => {
    try {
      const employees = await unitOfWork.employeeRepository.getAll();
      
      res.json({
        success: true,
        data: employees,
        meta: {
          count: employees.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting employees:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  });
  
  // Get employee by ID
  router.get('/employees/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid employee ID',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
      
      const employee = await unitOfWork.employeeRepository.getById(id);
      
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'Employee not found',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
      
      res.json({
        success: true,
        data: employee,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting employee:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  });
  
  // Get all projects
  router.get('/projects', async (req, res) => {
    try {
      const projects = await unitOfWork.projectRepository.getAll();
      
      res.json({
        success: true,
        data: projects,
        meta: {
          count: projects.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting projects:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  });
  
  // Get project by ID
  router.get('/projects/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid project ID',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
      
      const project = await unitOfWork.projectRepository.getById(id);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
      
      res.json({
        success: true,
        data: project,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting project:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  });
  
  // Get all invoices
  router.get('/invoices', async (req, res) => {
    try {
      const invoices = await unitOfWork.invoiceRepository.getAll();
      
      res.json({
        success: true,
        data: invoices,
        meta: {
          count: invoices.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting invoices:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  });
  
  // Get invoice by ID
  router.get('/invoices/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid invoice ID',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
      
      const invoice = await unitOfWork.invoiceRepository.getById(id);
      
      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
      
      res.json({
        success: true,
        data: invoice,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting invoice:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  });
  
  return router;
}
