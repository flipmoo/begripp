"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = declarabilityRoutes;
const declarability_service_1 = require("../../services/declarability.service");
/**
 * Register declarability API endpoints
 */
function declarabilityRoutes(app, baseUrl = '') {
    app.get(`${baseUrl}/declarability`, async (req, res) => {
        try {
            const startDate = req.query.startDate;
            const endDate = req.query.endDate;
            // Validate dates
            if (!startDate || !endDate) {
                return res.status(400).json({
                    error: 'Missing required parameters: startDate and endDate'
                });
            }
            console.log(`Calculating department declarability from ${startDate} to ${endDate}`);
            // Calculate declarability data
            const data = await (0, declarability_service_1.calculateDeclarabilityByDepartment)(startDate, endDate);
            return res.json(data);
        }
        catch (error) {
            console.error('Error in declarability endpoint:', error);
            return res.status(500).json({
                error: 'An error occurred while calculating declarability data'
            });
        }
    });
    app.get(`${baseUrl}/projectline/:id`, async (req, res) => {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({
                    error: 'Missing required parameter: id'
                });
            }
            // Here we would normally fetch from Gripp API
            // For now, this is a stub that will be implemented later
            // as we don't yet have a projectline.get service
            // Placeholder implementation that simulates fetching a project line
            const projectLine = {
                id: id,
                invoicebasis: {
                    id: Math.random() > 0.3 ? 1 : 4, // Randomly assign as declarable (70%) or non-declarable (30%)
                    searchname: Math.random() > 0.3 ? 'Declarabel' : 'Niet Declarabel'
                }
            };
            return res.json(projectLine);
        }
        catch (error) {
            console.error(`Error fetching project line ${req.params.id}:`, error);
            return res.status(500).json({
                error: 'An error occurred while fetching project line data'
            });
        }
    });
}
